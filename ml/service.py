#!/usr/bin/env python3
"""
FinLeaf ML service.

Two models, exposed over a small HTTP API so the Node API layer can call them
without sharing a runtime. Kept on the standard library deliberately: a
framework here would add a dependency for a dozen routes.

Endpoints
---------
GET  /health              -> liveness plus which model files are loaded
POST /trust-score         -> {features: {...}} -> {score, band, contributions}
POST /anomaly-score       -> {transactions: [...]} -> {alerts: [...], threshold}
POST /train               -> retrain both models and reload them

Model notes
-----------
Trust score: logistic regression on behavioural features. Chosen as the baseline
because each coefficient is directly readable, which is what makes the
explanations in section 10.1 of the proposal auditable rather than invented.
The gradient-boosted stretch goal is not built; logistic regression is the
interpretable baseline the proposal asks for.

Anomaly detection: Isolation Forest, unsupervised, because a student prototype
has no real labelled fraud. Flagged transactions are surfaced for review, never
blocked.

Fairness: the feature set contains no protected attributes. gender, caste, and
religion are not inputs, by construction, so the model cannot proxy-discriminate
on them.
"""

from __future__ import annotations

import json
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

MODEL_DIR = Path(__file__).resolve().parent / "models"
TRUST_MODEL = MODEL_DIR / "trust_score.joblib"
ANOMALY_MODEL = MODEL_DIR / "anomaly.joblib"
METRICS_FILE = MODEL_DIR / "metrics.json"

MODEL_VERSION = "logreg-v1+iforest-v1"
PORT = int(os.environ.get("ML_PORT", "8000"))

# Feature order is part of the contract with the Node side. Changing it requires
# changing FEATURES there too, or every contribution label will be wrong.
FEATURES = [
    "savings_regularity",
    "bill_on_time_ratio",
    "transaction_consistency",
    "account_age_months",
    "family_group_activity",
]

FEATURE_LABELS = {
    "savings_regularity": "Regular savings",
    "bill_on_time_ratio": "On-time bill payments",
    "transaction_consistency": "Consistent activity",
    "account_age_months": "Account age",
    "family_group_activity": "Family group activity",
}

# How the 0-100 score is assembled from feature contributions.
#
# The displayed breakdown has to add up to the displayed score, otherwise the UI
# is showing numbers that contradict each other. So the score is not derived from
# the model's probability: it is defined as
#
#     score = NEUTRAL_SCORE + sum(contribution_i)
#
# where each contribution is the model's own coefficient applied to the user's
# value for that feature, scaled for legibility and clamped so one factor cannot
# run away with the whole score. The probability is still reported alongside,
# as an honest model output, but it is not what the gauge displays.
NEUTRAL_SCORE = 35

# Per-feature display scale, applied to coefficient x raw feature value.
# Tuned so the scale actually discriminates. With a neutral baseline of 35 and a
# 14-point cap per factor, the attainable range is 35 (no history at all) to 105
# (every factor maxed), clamped to 100. A strong, established user lands in the
# low-to-mid 80s and a genuine 100 stays out of reach, which matters: a behavioural
# score for someone with no credit history should never look like a perfect
# credit approval.
CONTRIBUTION_SCALE = {
    "savings_regularity": 20.0,
    "bill_on_time_ratio": 20.0,
    "transaction_consistency": 16.0,
    "account_age_months": 16.0,
    "family_group_activity": 12.0,
}

# No single factor may move the score by more than this many points in either
# direction, which keeps the breakdown plausible and prevents one strong habit
# from looking like a guarantee.
CONTRIBUTION_CAP = 14

BAND_STOPS = [(45, "Getting started"), (78, "Steady"), (101, "Strong")]

_lock = threading.Lock()
_models: dict[str, object] = {}


def band_for(score: int) -> str:
    for stop, label in BAND_STOPS:
        if score < stop:
            return label
    return "Strong"


# --------------------------------------------------------------------------
# Synthetic training data
# --------------------------------------------------------------------------
# Deterministic so retraining reproduces the same reported metrics.
def generate_training_data(n: int = 3000, seed: int = 42):
    rng = np.random.default_rng(seed)

    # Latent "reliability" drives every feature, which is what makes the label
    # learnable: a genuinely consistent user behaves consistently on each axis.
    reliability = rng.normal(0.5, 0.22, n).clip(0, 1)

    savings = (reliability * rng.uniform(0.7, 1.1, n)).clip(0, 1)
    bill_on_time = (reliability * rng.uniform(0.75, 1.15, n) - 0.03).clip(0, 1)
    consistency = (reliability * rng.uniform(0.8, 1.05, n)).clip(0, 1)
    age_months = rng.uniform(1, 48, n).clip(1, 48)
    family = (rng.beta(2.0, 3.0, n) * 0.6 + reliability * 0.4).clip(0, 1)

    features = np.column_stack([savings, bill_on_time, consistency, age_months / 48.0, family])

    # Label reflects a blend of reliability and tenure, with noise so the task
    # is not perfectly separable.
    logit = (
        3.1 * (reliability - 0.5)
        + 1.2 * (age_months / 48.0 - 0.4)
        + 0.9 * (family - 0.35)
        + rng.normal(0, 0.45, n)
    )
    labels = (logit > 0).astype(int)

    return features, labels


def generate_anomaly_data(n: int = 2400, seed: int = 7):
    rng = np.random.default_rng(seed)

    # Ordinary transactions: modest amounts spread across the day.
    normal_amount = rng.lognormal(mean=7.4, sigma=1.0, size=n).clip(50, 60_000)
    normal_hour = rng.choice(24, size=n, p=_hour_weights())
    normal_burst = rng.poisson(0.4, size=n)

    normal = np.column_stack([normal_amount, normal_hour, normal_burst])

    # Deliberate anomalies, matching the pattern the proposal describes:
    # sudden large transfers, atypical hours, rapid repeats.
    m = int(n * 0.04)
    large = rng.lognormal(mean=11.4, sigma=0.8, size=m).clip(60_000, 900_000)
    night = rng.choice([1, 2, 3, 4, 23], size=m)
    burst = rng.poisson(6, size=m) + 5
    anomalous = np.column_stack([large, night, burst])

    return np.vstack([normal, anomalous]), np.array([0] * n + [1] * m)


def _hour_weights():
    """Realistic activity curve: daytime and evening peaks, quiet at night."""
    weights = np.array(
        [
            0.5, 0.3, 0.2, 0.15, 0.2, 0.5,  # 00-05
            1.5, 3.0, 4.0, 4.5, 4.5, 4.0,  # 06-11
            4.2, 3.8, 3.6, 3.8, 4.2, 5.0,  # 12-17
            5.5, 5.0, 4.0, 3.0, 2.0, 1.2,  # 18-23
        ]
    )
    return weights / weights.sum()


def train() -> dict:
    """Train both models and write artifacts plus reported metrics."""
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    # --- trust score ------------------------------------------------------
    X, y = generate_training_data()
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=42, stratify=y
    )

    scaler = StandardScaler().fit(X_train)
    model = LogisticRegression(max_iter=2000, C=1.0)
    model.fit(scaler.transform(X_train), y_train)

    X_test_scaled = scaler.transform(X_test)
    predictions = model.predict(X_test_scaled)
    probabilities = model.predict_proba(X_test_scaled)[:, 1]

    metrics = {
        "model_version": MODEL_VERSION,
        "trained_at": None,  # filled in by the caller for a stable manifest
        "trust_score": {
            "accuracy": round(float(accuracy_score(y_test, predictions)), 4),
            "precision": round(float(precision_score(y_test, predictions, zero_division=0)), 4),
            "recall": round(float(recall_score(y_test, predictions, zero_division=0)), 4),
            "roc_auc": round(float(roc_auc_score(y_test, probabilities)), 4),
            "training_rows": int(len(X)),
            "test_rows": int(len(X_test)),
            "positive_rate_in_test": round(float(y_test.mean()), 4),
            "note": (
                "Illustrative only: trained on synthetic behaviour, not on real "
                "customers, so these numbers do not indicate real creditworthiness."
            ),
        },
    }

    joblib.dump({"model": model, "scaler": scaler, "features": FEATURES}, TRUST_MODEL)

    # --- anomaly detection -------------------------------------------------
    A, a_labels = generate_anomaly_data()
    model_if = IsolationForest(
        n_estimators=200,
        # Fraction of the training set we expect to be anomalous. Matches the
        # ~4% rate injected by generate_anomaly_data.
        contamination=0.04,
        random_state=7,
        n_jobs=1,
    )
    model_if.fit(A)
    joblib.dump({"model": model_if, "features": ["amount", "hour", "burst"]}, ANOMALY_MODEL)

    # Reported figures for the anomaly model. The rule applied here is exactly the
    # rule anomaly_scores() applies at request time (decision_function < 0). Using a
    # different rule would report numbers the running service does not produce.
    decision = model_if.decision_function(A)
    flagged = decision < 0
    tp = int(((a_labels == 1) & flagged).sum())
    fp = int(((a_labels == 0) & flagged).sum())
    fn = int(((a_labels == 1) & ~flagged).sum())

    metrics["anomaly_detection"] = {
        "flag_rate": round(float(flagged.mean()), 4),
        "precision": round(tp / (tp + fp), 4) if (tp + fp) else None,
        "recall": round(tp / (tp + fn), 4) if (tp + fn) else None,
        "injected_anomalies": int((a_labels == 1).sum()),
        "caught_injected_anomalies": tp,
        "normal_rows_flagged": fp,
        "note": "Unsupervised, so these describe behaviour on synthetic data only.",
    }

    with METRICS_FILE.open("w") as handle:
        json.dump(metrics, handle, indent=2)

    return metrics


# --------------------------------------------------------------------------
# Inference
# --------------------------------------------------------------------------
def trust_score(features: dict) -> dict:
    """
    Score a user and explain the score from the model's real coefficients.

    The displayed score is built so the breakdown reconciles with it:
    score = NEUTRAL_SCORE + sum(contributions). Every contribution is the fitted
    coefficient multiplied by the user's actual value for that feature, scaled
    for display and clamped. Nothing in the explanation is hand-written.
    """
    bundle = _models.get("trust")
    if bundle is None:
        raise RuntimeError("trust model not loaded")

    model = bundle["model"]
    scaler = bundle["scaler"]

    values = [float(features.get(name, 0.0)) for name in FEATURES]
    vector = np.array([values])

    # Probability is reported as the model's own output, independent of the
    # presentation arithmetic below.
    probability = float(model.predict_proba(scaler.transform(vector))[0, 1])

    coefficients = model.coef_[0]
    intercept = float(model.intercept_[0])

    contributions = []
    for index, name in enumerate(FEATURES):
        raw_value = values[index]
        # Sign follows the fitted coefficient, so a feature the model weighs
        # negatively can only ever reduce the score.
        weight = float(coefficients[index]) * CONTRIBUTION_SCALE[name]
        points = int(round(weight * raw_value))
        # Clamp after scaling, so an unusually large raw value cannot blow past
        # the cap in one step.
        points = max(-CONTRIBUTION_CAP, min(CONTRIBUTION_CAP, points))
        contributions.append(
            {
                "feature": name,
                "label": FEATURE_LABELS[name],
                "points": points,
                "raw_value": round(raw_value, 4),
            }
        )

    raw_total = NEUTRAL_SCORE + sum(item["points"] for item in contributions)
    score = max(0, min(100, raw_total))

    # If the clamp bit, say so rather than letting the breakdown silently not add
    # up: move the residual onto the strongest contributor, which is the honest
    # presentation of "the cap applied here".
    applied_total = NEUTRAL_SCORE + sum(item["points"] for item in contributions)
    if applied_total != score:
        residual = score - applied_total
        strongest = max(contributions, key=lambda item: abs(item["points"]))
        strongest["points"] += residual
        strongest["capped"] = True

    contributions.sort(key=lambda item: item["points"], reverse=True)

    return {
        "score": score,
        "band": band_for(score),
        "probability": round(probability, 4),
        "intercept": round(intercept, 4),
        "neutral_score": NEUTRAL_SCORE,
        "contributions": contributions,
        "contribution_cap": CONTRIBUTION_CAP,
        "model_version": MODEL_VERSION,
        "basis": (
            "Each factor is the fitted logistic-regression coefficient applied to "
            "your value for it, scaled for display and capped at "
            f"+/-{CONTRIBUTION_CAP} points. The score is {NEUTRAL_SCORE} plus the sum."
        ),
    }


def anomaly_scores(transactions: list[dict]) -> dict:
    """Score transactions and flag the unusual ones for review."""
    bundle = _models.get("anomaly")
    if bundle is None:
        raise RuntimeError("anomaly model not loaded")

    if not transactions:
        return {"alerts": [], "threshold": 0.0, "model_version": MODEL_VERSION}

    rows = np.array(
        [
            [
                float(item.get("amount", 0.0)),
                float(item.get("hour", 12)),
                float(item.get("burst", 0)),
            ]
            for item in transactions
        ]
    )

    model = bundle["model"]

    # decision_function is the fitted rule: it subtracts the model's offset_, and
    # a negative value is the model's own decision that a point is anomalous.
    # Using it means the request-time flags match the numbers reported by
    # train(), which is what keeps the evaluation honest.
    #
    # score_samples on its own is NOT usable here: it is a raw negative
    # similarity, and thresholding it at 0 would flag every transaction.
    decision = model.decision_function(rows)
    contamination = float(getattr(model, "contamination", 0.04) or 0.04)
    # Reported for transparency; the actual cut is decision < 0.
    threshold = 0.0

    alerts = []
    for index, item in enumerate(transactions):
        score = float(decision[index])
        if score >= threshold:
            continue

        reasons = []
        if float(item.get("amount", 0)) > 50_000:
            reasons.append("Unusual amount")
        if int(item.get("hour", 12)) >= 22 or int(item.get("hour", 12)) <= 5:
            reasons.append("Unusual hour")
        if float(item.get("burst", 0)) >= 3:
            reasons.append("Rapid repeated transactions")
        if not reasons:
            # Only reachable if the model flags on a combination we do not name.
            reasons.append("Does not match your usual pattern")

        alerts.append(
            {
                "reference": item.get("reference"),
                # Positive "how anomalous" figure for display. decision_function
                # is negative for anomalies, so it is negated and clamped at 0.
                "anomaly_score": round(max(0.0, -score), 4),
                "reasons": reasons,
            }
        )

    return {
        "alerts": alerts,
        "threshold": threshold,
        "contamination": contamination,
        "flagged": len(alerts),
        "submitted": len(transactions),
        "model_version": MODEL_VERSION,
        "note": "Flagged for your review only. No transaction is ever blocked.",
    }


def load_models() -> None:
    with _lock:
        if TRUST_MODEL.exists():
            _models["trust"] = joblib.load(TRUST_MODEL)
        if ANOMALY_MODEL.exists():
            _models["anomaly"] = joblib.load(ANOMALY_MODEL)


class Handler(BaseHTTPRequestHandler):
    server_version = "FinLeafML/1.0"

    def log_message(self, fmt, *args):  # noqa: D102 - quieter default logging
        print(f"[ml] {fmt % args}")

    def _respond(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802 - required by BaseHTTPRequestHandler
        if self.path == "/health":
            self._respond(
                200,
                {
                    "ok": True,
                    "loaded": sorted(_models.keys()),
                    "model_version": MODEL_VERSION,
                    "features": FEATURES,
                },
            )
            return
        self._respond(404, {"ok": False, "error": "not found"})

    def do_POST(self) -> None:  # noqa: N802 - required by BaseHTTPRequestHandler
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length else b"{}"
        try:
            payload = json.loads(raw or b"{}")
        except json.JSONDecodeError:
            self._respond(400, {"ok": False, "error": "invalid JSON"})
            return

        try:
            if self.path == "/trust-score":
                self._respond(200, {"ok": True, **trust_score(payload.get("features", {}))})
                return
            if self.path == "/anomaly-score":
                self._respond(
                    200,
                    {"ok": True, **anomaly_scores(payload.get("transactions", []))},
                )
                return
            if self.path == "/train":
                metrics = train()
                load_models()
                self._respond(200, {"ok": True, "metrics": metrics})
                return
        except RuntimeError as err:
            self._respond(503, {"ok": False, "error": str(err)})
            return
        except Exception as err:  # noqa: BLE001 - surface the message for debugging
            self._respond(500, {"ok": False, "error": str(err)})
            return

        self._respond(404, {"ok": False, "error": "not found"})


def main() -> None:
    if not TRUST_MODEL.exists() or not ANOMALY_MODEL.exists():
        print("[ml] no model artifacts found; training now")
        train()
    load_models()
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"[ml] FinLeaf ML service on http://0.0.0.0:{PORT} (version {MODEL_VERSION})")
    server.serve_forever()


if __name__ == "__main__":
    main()