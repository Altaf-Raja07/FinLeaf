"""
FastAPI ML service for FinLeaf.

Exposes the trust-score model (Section 11.1), the anomaly detector
(Section 11.2), and the emission-factor helper (Section 7). Kept as its own
service so models can be retrained or swapped without touching the main API.

Two rules shape this module:

  * Every number that crosses the HTTP boundary is validated by Pydantic using
    the ranges declared in app/features.py, so malformed input is a 422 with a
    field-level error rather than a 500 from deep inside scikit-learn.
  * No endpoint trains anything. Models are loaded (and memoised) on first use;
    if they are missing the caller gets a 503 that says how to fix it, not a
    multi-second stall. See app/models.py.
"""

import logging
from typing import Annotated, Literal

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from . import models as ml
from .emission_factors import (
    CATEGORY_LABELS,
    EMISSION_FACTORS,
    co2e_for,
    points_for,
)
from .features import ANOMALY_FEATURE_SPECS, TRUST_FEATURE_SPECS

logger = logging.getLogger("finleaf.ml")

app = FastAPI(
    title="FinLeaf ML Service",
    description="Trust scoring, anomaly detection and carbon estimation.",
    version="1.0.0",
)


def _bounded(specs, name: str) -> Annotated[float, Field]:
    """A float constrained to the documented range of one model feature.

    Built from app/features.py so the API contract, the training data and the
    scorer can never drift apart.
    """
    spec = specs[name]
    return Annotated[
        float,
        Field(
            ge=spec.low,
            le=spec.high,
            description=spec.description,
            allow_inf_nan=False,
        ),
    ]


class TrustRequest(BaseModel):
    # Declared field-by-field rather than built dynamically so the schema
    # stays greppable and shows up properly in /openapi.json.
    savings_regularity: _bounded(TRUST_FEATURE_SPECS, "savings_regularity") = 0.0
    on_time_bill_ratio: _bounded(TRUST_FEATURE_SPECS, "on_time_bill_ratio") = 0.0
    txn_consistency: _bounded(TRUST_FEATURE_SPECS, "txn_consistency") = 0.0
    account_age_days: _bounded(TRUST_FEATURE_SPECS, "account_age_days") = 0.0
    group_activity: _bounded(TRUST_FEATURE_SPECS, "group_activity") = 0.0
    avg_balance_stability: _bounded(TRUST_FEATURE_SPECS, "avg_balance_stability") = 0.0
    monthly_txn_count: _bounded(TRUST_FEATURE_SPECS, "monthly_txn_count") = 0.0
    repayment_history: _bounded(TRUST_FEATURE_SPECS, "repayment_history") = 0.0
    # Literal, not str: an unrecognised model name used to fall through to the
    # logistic regression while still reporting the caller had asked for
    # something else. Now it is a 422.
    model: Literal["gb", "lr"] = Field(
        default="gb",
        description='"gb" for the boosted model, "lr" for the linear scorecard',
    )


class AnomalyRequest(BaseModel):
    amount_log: _bounded(ANOMALY_FEATURE_SPECS, "amount_log") = 0.0
    hour_of_day: _bounded(ANOMALY_FEATURE_SPECS, "hour_of_day") = 12.0
    rapid_repeat: _bounded(ANOMALY_FEATURE_SPECS, "rapid_repeat") = 0.0
    new_counterparty: _bounded(ANOMALY_FEATURE_SPECS, "new_counterparty") = 0.0
    category_rarity: _bounded(ANOMALY_FEATURE_SPECS, "category_rarity") = 0.0


class CarbonRequest(BaseModel):
    category: str = Field(
        min_length=1,
        max_length=64,
        pattern=r"^[A-Za-z][A-Za-z _-]*$",
        description="Spending category key; unknown keys fall back to OTHER",
        examples=["FUEL"],
    )
    amount: float = Field(
        ge=0.0,
        le=1e12,
        description="Rupee amount of the transaction",
        examples=[2000.0],
    )


class FactorExplanation(BaseModel):
    factor: str
    label: str
    points: float
    detail: str


class TrustResponse(BaseModel):
    score: int = Field(ge=0, le=100, description="Trust score on a 0-100 scale")
    probability: float = Field(ge=0.0, le=1.0)
    model: Literal["HistGradientBoostingClassifier", "LogisticRegression"]
    explanation_method: str
    top_factors: list[FactorExplanation]
    all_factors: list[FactorExplanation]


class AnomalyResponse(BaseModel):
    anomaly_score: float = Field(ge=0.0, le=1.0)
    is_anomalous: bool
    reasons: list[str] = Field(description="Always at least one entry")
    algorithm: Literal["IsolationForest"]
    action: Literal["review", "auto_cleared"]
    decision_basis: str


class CarbonResponse(BaseModel):
    category: str
    label: str
    amount: float
    co2e_kg: float
    factor_per_100_inr: float
    green_points: int
    source: str = "static-table"
    disclaimer: str = "Estimated CO2e from category-based factors, not a measured value."


class MetricsResponse(BaseModel):
    logistic_regression: dict[str, float]
    gradient_boosting: dict[str, float]
    anomaly_detector: dict[str, float | int | str | list[float]]
    trained_on: str
    trained_at: str
    feature_space: dict[str, object]
    disclaimer: str


@app.exception_handler(ml.ModelsUnavailableError)
def models_unavailable_handler(request: Request, exc: ml.ModelsUnavailableError) -> JSONResponse:
    """503, not 500: the request was fine, the service is not ready.

    The detail says which artefact is missing and how to produce it, because
    the two things that cause this (artefacts never trained, or a volume not
    mounted) are both fixable in seconds by whoever is on call.
    """
    logger.error("Models unavailable for %s: %s", request.url.path, exc)
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"detail": str(exc), "service": "finleaf-ml"},
    )


@app.exception_handler(ValueError)
def invalid_feature_handler(request: Request, exc: ValueError) -> JSONResponse:
    """422 for a feature value the scorer refuses (NaN, inf, non-numeric).

    Pydantic already rejects these before a handler runs, so reaching this
    handler means something bypassed the request model - a NaN reaching a
    scikit-learn estimator does not raise, it silently returns a meaningless
    score, which is far worse than a refused request.
    """
    logger.warning("Invalid feature input on %s: %s", request.url.path, exc)
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": str(exc)},
    )


@app.get("/health")
def health():
    """Liveness. Always 200 while the process is up.

    Liveness and readiness are deliberately separate signals, and this is the
    liveness one. A process that is up but missing model artefacts is *alive*;
    it should stay serving (and reporting) so an operator can see and fix the
    cause. Reporting 503 from here would let a supervisor restart a container in
    a loop against a state a restart cannot fix, and would take the whole stack
    down with it.

    Use `/ready` to gate traffic.
    """
    return {
        "status": "ok",
        "service": "finleaf-ml",
        "models": "loaded" if ml.artefacts_present() else "missing",
    }


@app.get("/ready")
def readiness():
    """Readiness. 200 only when the service can actually score.

    This is what a container healthcheck should call, and it is the endpoint
    that caught a real deployment bug: `artefacts_present()` used to omit
    `mean_vector.json`, so a container could pass its healthcheck while every
    scoring request failed. It loads the artefacts for real rather than
    checking for files, so a corrupt or version-skewed artefact is caught here
    too rather than on the first user request.
    """
    try:
        ml.load_models()
    except ml.ModelsUnavailableError:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "not_ready",
                "service": "finleaf-ml",
                "models": "missing",
                "fix": "Run `python -m app.train --force` in apps/ml before serving traffic.",
            },
        )
    except Exception as exc:  # a broken artefact must be visible, not swallowed
        logger.exception("ML service failed its readiness check")
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "not_ready",
                "service": "finleaf-ml",
                "models": "unreadable",
                "fix": f"The model artefacts could not be loaded: {exc}",
            },
        )

    return {
        "status": "ready",
        "service": "finleaf-ml",
        "models": "loaded",
    }


@app.get("/model/metrics")
def model_metrics() -> MetricsResponse:
    """Held-out metrics for both trust models and the anomaly detector.

    Computed once during training and read from models/metrics.json since, so
    this is a cache read. The numbers describe a model fitted to synthetic data
    and are illustrative only.
    """
    return MetricsResponse(**ml.get_metrics(), disclaimer=(
        "Measured on a held-out slice of SYNTHETIC data. These models have not "
        "been validated on real borrowers."
    ))


@app.post("/ml/trust-score", response_model=TrustResponse)
def trust_score(req: TrustRequest) -> TrustResponse:
    return TrustResponse(
        **ml.score_trust(req.model_dump(exclude={"model"}), model=req.model)
    )


@app.post("/ml/anomaly-score", response_model=AnomalyResponse)
def anomaly_score(req: AnomalyRequest) -> AnomalyResponse:
    return AnomalyResponse(**ml.score_anomaly(req.model_dump()))


@app.post("/ml/carbon", response_model=CarbonResponse)
def carbon(req: CarbonRequest) -> CarbonResponse:
    factor = EMISSION_FACTORS.get(req.category.upper(), EMISSION_FACTORS["OTHER"])
    return CarbonResponse(
        category=req.category.upper(),
        label=CATEGORY_LABELS.get(req.category.upper(), req.category),
        amount=req.amount,
        co2e_kg=co2e_for(req.category, req.amount),
        factor_per_100_inr=factor,
        green_points=points_for(req.category),
    )


@app.get("/carbon/factors")
def carbon_factors():
    return {
        "factors_per_100_inr": EMISSION_FACTORS,
        "labels": CATEGORY_LABELS,
        "methodology": "GHG Protocol Scope 3.1 category-based estimation",
    }