"""Anomaly-detection endpoint tests."""

import pytest
from fastapi.testclient import TestClient

from app import models as ml
from app.main import app

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def trained(trained_models):
    ml.load_models()


NORMAL = {
    "amount_log": 6.2,
    "hour_of_day": 12,
    "rapid_repeat": 0.0,
    "new_counterparty": 0.0,
    "category_rarity": 0.3,
}


def anomaly(**overrides) -> dict:
    response = client.post("/ml/anomaly-score", json={**NORMAL, **overrides})
    assert response.status_code == 200, response.text
    return response.json()


def test_the_request_schema_exposes_every_model_feature():
    """The API contract and the model must not drift apart.

    The web app is a separate service that builds the feature dict from the
    user's own ledger rows. If a feature were added to the model without
    appearing here, that service would keep sending the old set and every score
    would be silently wrong. The OpenAPI schema is checked because it is what a
    client can actually read at runtime.
    """
    from app.features import ANOMALY_FEATURE_SPECS

    schema = client.get("/openapi.json").json()

    assert set(schema["components"]["schemas"]["AnomalyRequest"]["properties"]) == set(
        ANOMALY_FEATURE_SPECS
    )


def test_score_is_bounded_and_ordered():
    usual = anomaly()
    extreme = anomaly(amount_log=14.0, hour_of_day=3, rapid_repeat=1.0,
                      new_counterparty=1.0, category_rarity=1.0)

    assert 0.0 <= usual["anomaly_score"] <= 1.0
    assert extreme["anomaly_score"] >= usual["anomaly_score"]
    assert extreme["is_anomalous"] or extreme["anomaly_score"] > 0.5


def test_reasons_is_never_empty():
    """A user-facing screen is driven by this list.

    An empty `reasons` for a flagged payment would render "was this you?" with
    no explanation, which is the least useful version of the feature.
    """
    for features in (
        NORMAL,
        dict(NORMAL, amount_log=16.0, hour_of_day=3),
        dict(NORMAL, rapid_repeat=1.0, new_counterparty=1.0),
    ):
        result = anomaly(**features)
        assert result["reasons"]
        assert isinstance(result["reasons"], list)
        assert all(isinstance(reason, str) for reason in result["reasons"])


def test_action_matches_the_flag():
    result = anomaly()
    assert result["action"] == ("review" if result["is_anomalous"] else "auto_cleared")


def test_out_of_range_hour_is_rejected():
    response = client.post("/ml/anomaly-score", json={**NORMAL, "hour_of_day": 30})
    assert response.status_code == 422


def test_out_of_range_probability_is_rejected():
    response = client.post("/ml/anomaly-score", json={**NORMAL, "rapid_repeat": 2.0})
    assert response.status_code == 422
