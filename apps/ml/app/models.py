"""
Trust-score model, anomaly detection, and the artefacts that hold them.

Trust score: two models fitted on the same behavioural features.
  - Logistic regression "scorecard" (baseline, directly interpretable).
  - HistGradientBoostingClassifier (stronger model, captures the non-linear
    interaction between saving and bill payment that the proposal calls out).

Anomaly detection: Isolation Forest. We have no labelled fraud, so
classification would suffer from severe class imbalance; an unsupervised forest
is the honest choice.

HOW ARTEFACTS ARE MANAGED
-------------------------
Training is an explicit, offline step: `python -m app.train`. It writes five
files into MODEL_DIR:

    trust_logreg.joblib   logistic regression + the scaler it was fitted with
    trust_gbdt.joblib     gradient boosting model
    anomaly_iforest.joblib  IsolationForest + the score range to normalise by
    metrics.json          held-out metrics, written once at training time
    mean_vector.json      population-mean feature vector for the explanation

This module only *loads* those files. It never trains inside a request: a
request that needs a model that is not there gets a `ModelsUnavailableError`
and the API turns that into a 503, rather than the service quietly spending
several CPU-seconds fitting two models while the caller waits. Metrics are read
from metrics.json and memoised in-process, so `/model/metrics` is a dictionary
lookup, not a retrain.
"""

import json
import logging
import math
import os
import threading
from dataclasses import dataclass
from typing import Any

import numpy as np

from .features import (
    ANOMALY_FEATURE_SPECS,
    ANOMALY_FEATURES,
    ANOMALY_LABELS,
    FEATURE_LABELS,
    FEATURES,
    TRUST_FEATURE_SPECS,
)

logger = logging.getLogger("finleaf.ml")

# ML_MODEL_DIR lets a deployment point at a mounted volume (docker-compose does
# this) without editing code.
MODEL_DIR = os.environ.get("ML_MODEL_DIR") or os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models"
)

# Artefact name -> what it holds. Resolved through artefact_paths() rather than
# baked into constants, so changing MODEL_DIR at runtime (the --model-dir flag,
# the tests) moves every artefact together instead of leaving half of them
# pointing at the old directory.
ARTEFACT_FILES = {
    "trust_lr": "trust_logreg.joblib",
    "trust_gb": "trust_gbdt.joblib",
    "anomaly": "anomaly_iforest.joblib",
    "metrics": "metrics.json",
    "mean_vector": "mean_vector.json",
}

TRUST_MODELS = ("gb", "lr")

# The artefacts `_load_models_locked()` reads to be able to serve traffic.
# `metrics.json` is deliberately absent: it is a reporting artefact, and its
# absence must degrade `/model/metrics` alone rather than making the service
# unready. Keeping this as a named set, rather than an inline list inside
# `artefacts_present`, means the readiness check and the loader share one
# definition and cannot drift apart again.
SERVING_ARTEFACTS = ("trust_lr", "trust_gb", "anomaly", "mean_vector")

_store: dict[str, Any] = {}
_store_lock = threading.Lock()

# Number of times this process has actually fitted a model. Metrics are
# computed once at training time; a counter that never moves on the request
# path is the cheapest possible proof of that, and the test suite asserts it.
_fit_count = 0


def artefact_paths(model_dir: str | None = None) -> dict[str, str]:
    """Absolute paths of every artefact, derived from MODEL_DIR."""
    base = model_dir or MODEL_DIR
    return {key: os.path.join(base, name) for key, name in ARTEFACT_FILES.items()}


class ModelsUnavailableError(RuntimeError):
    """Raised when a model artefact is missing or unreadable.

    The API layer maps this to 503: the request is fine, the service is not
    ready. Silently training here would turn a misconfigured deploy into an
    N-second stall on every call while hiding the real problem in the logs.
    """


@dataclass
class ScoreExplanation:
    factor: str
    label: str
    contribution: float  # points on the 0-100 scale
    detail: str


def fit_count() -> int:
    """How many model fits this process has performed. Diagnostics only."""
    return _fit_count


def artefacts_present(model_dir: str | None = None) -> bool:
    """True when every artefact needed to *serve traffic* exists on disk.

    The set is the files `_load_models_locked()` actually reads, not a subset of
    them. An earlier version omitted `mean_vector`, which meant `/health`
    reported "loaded" while every scoring request then failed on the missing
    cache — a healthcheck that lies is worse than no healthcheck, because the
    operator sees green and the user sees a 500.

    `metrics.json` is deliberately excluded: it is an artefact for reporting, not
    for scoring. Its absence degrades `/model/metrics` alone and should not make
    the service unready.
    """
    paths = artefact_paths(model_dir)
    return all(os.path.exists(paths[k]) for k in SERVING_ARTEFACTS)


def load_models() -> dict[str, Any]:
    """Load and memoise the model artefacts. Never trains.

    Safe to call from several request threads: the first caller does the work,
    the rest block on the lock and then hit the cache.
    """
    if _store:
        return _store
    with _store_lock:
        if _store:  # another thread won the race while we waited
            return _store
        _load_models_locked()
        return _store


def _load_models_locked() -> None:
    import joblib  # local import: keeps module import cheap for non-scoring paths

    paths = artefact_paths()
    missing = [paths[k] for k in ("trust_lr", "trust_gb", "anomaly")
               if not os.path.exists(paths[k])]
    if missing:
        logger.error(
            "Model artefacts missing from %s: %s. Run `python -m app.train` (add "
            "--force to retrain) before serving traffic.",
            MODEL_DIR,
            ", ".join(os.path.basename(p) for p in missing),
        )
        raise ModelsUnavailableError(
            f"model artefacts missing from {MODEL_DIR}; run `python -m app.train`"
        )

    try:
        _store["lr"] = joblib.load(paths["trust_lr"])
        _store["gb"] = joblib.load(paths["trust_gb"])
        _store["anomaly"] = joblib.load(paths["anomaly"])
        _store["mean_vector"] = _load_mean_vector(paths["mean_vector"])
    except ModelsUnavailableError:
        raise
    except Exception as exc:  # corrupt/truncated artefact, version skew, ...
        logger.error("Failed to load model artefacts from %s: %s", MODEL_DIR, exc)
        raise ModelsUnavailableError(f"could not load model artefacts: {exc}") from exc

    logger.info(
        "Loaded model artefacts from %s (features: %s)", MODEL_DIR, ", ".join(FEATURES)
    )


def _load_mean_vector(path: str) -> np.ndarray:
    """Population-mean feature vector used by the per-factor explanation.

    Written once at training time and read from disk, because computing it
    means materialising the whole synthetic population - far too much work to
    repeat on every scored request.
    """
    if os.path.exists(path):
        try:
            with open(path, encoding="utf-8") as handle:
                payload = json.load(handle)
            values = [float(v) for v in payload["values"]]
            if list(payload.get("features", FEATURES)) != FEATURES:
                raise ValueError("feature order does not match the model")
            return np.asarray(values, dtype=float)
        except Exception as exc:
            logger.warning("%s unreadable (%s); recomputing once", path, exc)

    logger.info("%s not found; computing the mean vector once at load time", path)
    from .training_data import generate  # imported here: only needed on this path

    return generate()[FEATURES].mean().to_numpy(dtype=float)


def get_metrics() -> dict[str, Any]:
    """Held-out metrics, read once from disk and then served from memory.

    These numbers describe a model fitted to SYNTHETIC data and are therefore
    illustrative only - see app/training_data.py. They are computed during
    training precisely so that a request never has to.
    """
    if "metrics" in _store:
        return _store["metrics"]
    with _store_lock:
        if "metrics" in _store:
            return _store["metrics"]
        path = artefact_paths()["metrics"]
        if not os.path.exists(path):
            logger.error(
                "%s not found. Run `python -m app.train --force` to compute held-out metrics.",
                path,
            )
            raise ModelsUnavailableError(
                "model metrics have not been computed; run `python -m app.train --force`"
            )
        try:
            with open(path, encoding="utf-8") as handle:
                _store["metrics"] = json.load(handle)
        except Exception as exc:
            logger.error("%s unreadable: %s", path, exc)
            raise ModelsUnavailableError(f"model metrics are unreadable: {exc}") from exc
        return _store["metrics"]


def _metrics(y_true, y_pred, y_proba) -> dict[str, float]:
    from sklearn.metrics import (
        accuracy_score,
        precision_score,
        recall_score,
        roc_auc_score,
    )

    return {
        "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
        "precision": round(float(precision_score(y_true, y_pred, zero_division=0)), 4),
        "recall": round(float(recall_score(y_true, y_pred, zero_division=0)), 4),
        "auc_roc": round(float(roc_auc_score(y_true, y_proba)), 4),
    }


def train_models(force: bool = False) -> dict[str, Any]:
    """Fit the models and write every artefact. The offline training step.

    Refuses to do nothing silently: if artefacts already exist it returns their
    recorded metrics, and `force=True` is how you actually retrain.
    """
    global _fit_count

    if not force and artefacts_present() and os.path.exists(artefact_paths()["metrics"]):
        logger.info("Artefacts already present in %s; nothing to do", MODEL_DIR)
        return get_metrics()

    from sklearn.ensemble import HistGradientBoostingClassifier, IsolationForest
    from sklearn.linear_model import LogisticRegression
    from sklearn.model_selection import train_test_split
    from sklearn.preprocessing import StandardScaler

    import joblib

    from .training_data import generate, generate_normal_transactions

    os.makedirs(MODEL_DIR, exist_ok=True)

    df = generate()
    X = df[FEATURES].to_numpy()
    y = df["target"].to_numpy()
    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    scaler = StandardScaler().fit(X_tr)
    _fit_count += 1
    lr = LogisticRegression(max_iter=2000, C=1.0).fit(scaler.transform(X_tr), y_tr)
    _fit_count += 1
    gb = HistGradientBoostingClassifier(
        max_depth=4, max_iter=250, learning_rate=0.06, random_state=42
    ).fit(X_tr, y_tr)

    lr_metrics = _metrics(
        y_te,
        lr.predict(scaler.transform(X_te)),
        lr.predict_proba(scaler.transform(X_te))[:, 1],
    )
    gb_metrics = _metrics(y_te, gb.predict(X_te), gb.predict_proba(X_te)[:, 1])

    # Anomaly detector fitted on normal-looking transactions only.
    normal_rows = generate_normal_transactions()
    iso = IsolationForest(
        n_estimators=200, contamination=0.05, random_state=42
    ).fit(normal_rows)
    _fit_count += 1
    # Fraction of the fitted population the forest calls anomalous. With
    # contamination=0.05 this is 5% by construction, and it is reported so the
    # assumption is visible rather than hidden.
    flagged_fraction = float((iso.predict(normal_rows) == -1).mean())
    # Normalisation range for the 0-1 anomaly score. Without it, raw
    # score_samples sits around 0.4-0.7 for everything and the number tells a
    # user nothing; scaled against the fitted population, 1.0 means "the most
    # anomalous transaction this model has ever seen".
    train_scores = -iso.score_samples(normal_rows)
    score_range = [float(train_scores.min()), float(train_scores.max())]

    mean_vector = df[FEATURES].mean().to_numpy(dtype=float)
    metrics = {
        "logistic_regression": lr_metrics,
        "gradient_boosting": gb_metrics,
        "anomaly_detector": {
            "n_normal_samples": int(normal_rows.shape[0]),
            "flagged_fraction": round(flagged_fraction, 4),
            "algorithm": "IsolationForest",
            "contamination": 0.05,
            "score_range": [round(v, 6) for v in score_range],
        },
        "trained_on": (
            "SYNTHETIC behavioural data generated by app/training_data.py - "
            "illustrative only, not validated on real borrowers"
        ),
        "trained_at": _utc_now(),
        "feature_space": {
            "features": list(FEATURES),
            "normalisation": "account_age_days = days/365, monthly_txn_count = count/30",
        },
    }

    # Artefacts are written before the metrics file: if this process dies
    # half-way the service reports "metrics missing" (a clear, fixable error)
    # rather than serving numbers that describe different models.
    paths = artefact_paths()
    joblib.dump({"model": lr, "scaler": scaler, "features": FEATURES}, paths["trust_lr"])
    joblib.dump({"model": gb, "features": FEATURES}, paths["trust_gb"])
    joblib.dump(
        {
            "model": iso,
            "features": ANOMALY_FEATURES,
            "score_range": score_range,
        },
        paths["anomaly"],
    )
    _write_json(
        paths["mean_vector"],
        {
            "features": list(FEATURES),
            "values": [round(float(v), 10) for v in mean_vector],
            "note": "Population mean of the synthetic training data; baseline for the per-factor explanation.",
        },
    )
    _write_json(paths["metrics"], metrics)

    # A retrain must not leave the process scoring the models it loaded earlier.
    with _store_lock:
        _store.clear()
    logger.info("Wrote model artefacts and metrics to %s", MODEL_DIR)
    return metrics


def _write_json(path: str, payload: dict[str, Any]) -> None:
    tmp = f"{path}.tmp"
    with open(tmp, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, sort_keys=False)
        handle.write("\n")
    os.replace(tmp, path)  # atomic: a reader never sees a half-written file


def _utc_now() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def score_trust(features: dict[str, float], model: str = "gb") -> dict[str, Any]:
    """Score a borrower 0-100 and explain the score.

    `model` selects the estimator and must be "gb" or "lr"; anything else is a
    programming error, not a silent fallback to the other model.

    Explanations come from re-scoring the borrower with one feature reset to
    the population mean, which keeps every contribution on the same 0-100 scale
    as the score itself - so the UI can show honest "+15 / -10" values instead
    of raw log-odds.
    """
    if model not in TRUST_MODELS:
        raise ValueError(f"unknown trust model {model!r}; expected one of {TRUST_MODELS}")

    m = load_models()
    use_gb = model == "gb"

    values = _clean_features(features, TRUST_FEATURE_SPECS, FEATURES)
    X = np.array([[values[f] for f in FEATURES]], dtype=float)

    proba = _predict_proba(m, X, use_gb)
    score = int(round(proba * 100))

    baseline = _mean_vector()
    contributions: list[ScoreExplanation] = []
    for i, feat in enumerate(FEATURES):
        perturbed = X.copy()
        perturbed[0, i] = baseline[i]
        delta_points = (proba - _predict_proba(m, perturbed, use_gb)) * 100.0
        contributions.append(
            ScoreExplanation(
                factor=feat,
                label=FEATURE_LABELS[feat],
                contribution=round(delta_points, 1),
                detail=_detail_for(feat, values[feat]),
            )
        )

    contributions.sort(key=lambda c: abs(c.contribution), reverse=True)
    return {
        "score": max(0, min(100, score)),
        "probability": round(proba, 4),
        "model": "HistGradientBoostingClassifier" if use_gb else "LogisticRegression",
        "explanation_method": "per-factor contribution in probability points",
        "top_factors": [_factor_dict(c) for c in contributions[:4]],
        "all_factors": [_factor_dict(c) for c in contributions],
    }


def _predict_proba(m: dict[str, Any], X: np.ndarray, use_gb: bool) -> float:
    if use_gb:
        return float(m["gb"]["model"].predict_proba(X)[0, 1])
    return float(m["lr"]["model"].predict_proba(m["lr"]["scaler"].transform(X))[0, 1])


def _factor_dict(c: ScoreExplanation) -> dict[str, Any]:
    return {
        "factor": c.factor,
        "label": c.label,
        "points": c.contribution,
        "detail": c.detail,
    }


def _mean_vector() -> np.ndarray:
    """Population-mean feature vector in the model's input space."""
    return load_models()["mean_vector"]


def _clean_features(
    features: dict[str, float],
    specs: dict[str, Any],
    order: list[str],
) -> dict[str, float]:
    """Validate, clamp and order the caller-supplied features.

    The API validates these ranges with Pydantic already; this repeats the
    check so the module is safe to call directly (batch jobs, scripts, tests)
    and so a NaN can never reach a scikit-learn estimator - a NaN does not
    raise a useful error, it silently poisons the prediction.
    """
    cleaned: dict[str, float] = {}
    for name in order:
        low, high, _ = specs[name]
        raw = features.get(name, 0.0)
        try:
            value = float(raw)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"{name} must be a number") from exc
        if not math.isfinite(value):
            raise ValueError(f"{name} must be a finite number")
        if not low <= value <= high:
            # Out-of-contract values are clamped, not rejected: the API has
            # already refused them with a 422, and anything reaching this point
            # is from an in-process caller we would rather score sensibly than
            # crash on.
            logger.warning("Clamping out-of-range %s=%s to [%s, %s]", name, value, low, high)
            value = min(high, max(low, value))
        cleaned[name] = value
    return cleaned


def _detail_for(feat: str, value: float) -> str:
    if feat == "account_age_days":
        return f"{int(round(value * 365))} days old"
    if feat == "monthly_txn_count":
        return f"{int(round(value * 30))} transactions this month"
    pct = int(round(value * 100))
    if pct >= 75:
        return f"Strong ({pct}%)"
    if pct >= 45:
        return f"Fair ({pct}%)"
    if pct > 0:
        return f"Limited ({pct}%)"
    return "No activity yet"


def score_anomaly(features: dict[str, float]) -> dict[str, Any]:
    """Unsupervised anomaly score in 0-1, plus human-readable reasons.

    The flag itself comes from the forest's own decision boundary (fitted with
    contamination=0.05, so ~5% of ordinary transactions are routed to review),
    while the score is normalised against the fitted population so it means
    something to a user. Flagged transactions are surfaced for review, never
    auto-blocked.
    """
    m = load_models()["anomaly"]
    iso = m["model"]
    values = _clean_features(features, ANOMALY_FEATURE_SPECS, ANOMALY_FEATURES)
    X = np.array([[values[f] for f in ANOMALY_FEATURES]], dtype=float)

    lo, hi = (m.get("score_range") or (0.0, 1.0))
    span = float(hi) - float(lo)
    raw = float(-iso.score_samples(X)[0])
    score = float(np.clip((raw - float(lo)) / span if span > 0 else raw, 0.0, 1.0))
    is_anomalous = int(iso.predict(X)[0]) == -1

    reasons = [
        ANOMALY_LABELS[feat] for feat in ANOMALY_FEATURES if _is_reason(feat, values[feat])
    ]

    return {
        "anomaly_score": round(score, 4),
        "is_anomalous": is_anomalous,
        "reasons": reasons or ["Pattern differs slightly from your usual activity"],
        "algorithm": "IsolationForest",
        "action": "review" if is_anomalous else "auto_cleared",
        "decision_basis": "IsolationForest contamination boundary",
    }


def _is_reason(feat: str, value: float) -> bool:
    """Rule-based reasons shown alongside the model score.

    These thresholds are the published part of the contract - the web app's
    rule-based fallback mirrors them exactly so a degraded system still explains
    itself the same way.
    """
    if feat == "amount_log":
        return value > 7.5
    if feat == "hour_of_day":
        # The API constrains the hour to 0-23, so only the small-hours end of
        # the day can be unusual.
        return value < 5
    if feat == "rapid_repeat":
        return value > 0.6
    if feat == "new_counterparty":
        return value > 0.5
    if feat == "category_rarity":
        return value > 0.65
    return False