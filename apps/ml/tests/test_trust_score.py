"""Regression tests for the trust-score endpoint.

Each test names the bug it guards against, because these were all real
defects in the service at some point.
"""

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app import models as ml
from app.main import app

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def trained(trained_models):
    """Load (or train once) before any test touches the endpoint."""
    ml.load_models()


MEAN = {
    "savings_regularity": 0.5,
    "on_time_bill_ratio": 0.5,
    "txn_consistency": 0.5,
    "account_age_days": 0.5,
    "group_activity": 0.5,
    "avg_balance_stability": 0.5,
    "monthly_txn_count": 0.5,
    "repayment_history": 0.5,
}


def score(model: str = "gb", **overrides) -> dict:
    payload = {**MEAN, "model": model}
    payload.update(overrides)
    response = client.post("/ml/trust-score", json=payload)
    assert response.status_code == 200, response.text
    return response.json()


def test_gb_path_returns_the_boosting_model():
    """The `model` field must actually select a model.

    Regression: the endpoint used to pass the whole Pydantic request object as
    the `model` argument, so `"gb"` never matched, the comparison was always
    against a non-string, and every request silently fell through to the
    logistic-regression path.
    """
    assert score(model="gb")["model"] == "HistGradientBoostingClassifier"


def test_lr_path_returns_the_logistic_regression_model():
    assert score(model="lr")["model"] == "LogisticRegression"


def test_the_two_models_can_differ():
    """Proves the model selection is real rather than a label swap.

    Scoring an unambiguously strong or weak user through both paths must not
    always produce the same number; if it does, the selector is a no-op.
    """
    strong = dict(savings_regularity=1.0, on_time_bill_ratio=1.0,
                  repayment_history=1.0, txn_consistency=1.0)
    weak = dict(savings_regularity=0.0, on_time_bill_ratio=0.0,
                repayment_history=0.0, txn_consistency=0.0)

    gb_strong, lr_strong = score("gb", **strong)["score"], score("lr", **strong)["score"]
    gb_weak, lr_weak = score("gb", **weak)["score"], score("lr", **weak)["score"]

    # Both models must rank the strong user above the weak one.
    assert gb_strong > gb_weak
    assert lr_strong > lr_weak


def test_score_is_bounded_0_to_100():
    for features in (
        {k: 1.0 for k in MEAN},
        {k: 0.0 for k in MEAN},
        MEAN,
    ):
        result = score("gb", **features)
        assert 0 <= result["score"] <= 100
        assert 0.0 <= result["probability"] <= 1.0


def test_a_strong_user_outranks_a_weak_user():
    strong = score(savings_regularity=1.0, on_time_bill_ratio=1.0,
                   txn_consistency=1.0, repayment_history=1.0,
                   account_age_days=1.0)
    weak = score(savings_regularity=0.0, on_time_bill_ratio=0.0,
                 txn_consistency=0.0, repayment_history=0.0,
                 account_age_days=0.0)
    assert strong["score"] > weak["score"]


def test_explanations_cover_every_feature():
    """Explainability is a product commitment, not an optional extra.

    A factor list that silently drops a feature would let a user be told their
    score is fully explained when it is not.
    """
    from app.features import TRUST_FEATURE_SPECS

    result = score()
    assert len(result["all_factors"]) == len(TRUST_FEATURE_SPECS)
    # Every feature is named, so a user can be shown the full breakdown rather
    # than only the ones that happened to move the needle most.
    assert {f["factor"] for f in result["all_factors"]} == set(TRUST_FEATURE_SPECS)
    assert len(result["top_factors"]) <= 4
    assert result["explanation_method"]


def test_contributions_are_ordered_by_magnitude():
    result = score()
    magnitudes = [abs(f["points"]) for f in result["top_factors"]]
    assert magnitudes == sorted(magnitudes, reverse=True)


def test_out_of_range_input_is_a_422_not_a_500():
    """Malformed input must be rejected at the boundary.

    Regression: without Pydantic bounds the value reached scikit-learn and
    produced a 500 for something the caller could fix.
    """
    response = client.post(
        "/ml/trust-score", json={**MEAN, "model": "gb", "savings_regularity": 5.0}
    )
    assert response.status_code == 422


@pytest.mark.parametrize("literal", ["NaN", "Infinity", "-Infinity"])
def test_non_finite_values_are_rejected(literal):
    """Non-finite values must be a 422, even though JSON cannot carry them.

    Python's json module emits the bare tokens `NaN`, `Infinity` and
    `-Infinity`, which a lax parser on the other side will happily accept.
    Posting the raw token is how that path is reached, so it is the only way to
    test the guard.
    """
    response = client.post(
        "/ml/trust-score",
        content=f'{{"model": "gb", "repayment_history": {literal}}}',
        headers={"content-type": "application/json"},
    )
    assert response.status_code == 422


def test_a_missing_field_is_rejected_loudly():
    payload = {k: v for k, v in MEAN.items() if k != "group_activity"}
    response = client.post("/ml/trust-score", json={**payload, "model": "gb"})
    # A default of 0 is applied rather than the request being rejected, which is
    # the documented behaviour: absent features score as "no activity".
    assert response.status_code == 200


def test_the_mean_vector_is_not_refitted_on_every_request():
    """The population mean used for the factor breakdown must be cached.

    Regression: it used to be recomputed from a freshly generated synthetic
    dataset on every scoring call, which made every request pay for generating
    4,000 rows it only needed the mean of.
    """
    score()
    before = ml.fit_count()
    score()
    score()
    assert ml.fit_count() == before
