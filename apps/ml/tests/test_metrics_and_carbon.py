"""Model-metrics caching and the carbon endpoint.

These two are grouped because both are about an endpoint returning a number it
did not compute freshly, which is where the old service was slow.
"""

import time

import pytest
from fastapi.testclient import TestClient

from app import models as ml
from app.main import app

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def trained(trained_models):
    ml.load_models()


def test_metrics_are_served_from_a_cache_not_recomputed():
    """`/model/metrics` must not refit models on every request.

    Regression: the metrics endpoint used to call `evaluate()`, which retrained
    two classifiers, a StandardScaler and an IsolationForest every single time it
    was called — seconds of CPU per request, for numbers that never change
    between training runs.
    """
    first = client.get("/model/metrics")
    assert first.status_code == 200, first.text
    before = ml.fit_count()

    for _ in range(5):
        response = client.get("/model/metrics")
        assert response.status_code == 200

    assert ml.fit_count() == before

    # And the numbers are stable, not merely fetched repeatedly.
    for _ in range(3):
        assert client.get("/model/metrics").json() == first.json()


def test_metrics_report_the_expected_models():
    metrics = client.get("/model/metrics").json()
    assert metrics["logistic_regression"]
    assert metrics["gradient_boosting"]
    assert metrics["anomaly_detector"]

    for section in ("logistic_regression", "gradient_boosting"):
        for metric in ("accuracy", "precision", "recall", "auc_roc"):
            assert metric in metrics[section]
            assert 0.0 <= metrics[section][metric] <= 1.0


def test_metrics_state_that_the_underlying_data_is_synthetic():
    """The disclosure is part of the artefact, not a nicety.

    A number shown to a user has to carry its provenance with it, or the
    interface ends up asserting something the data cannot support.
    """
    note = client.get("/model/metrics").json().get("trained_on", "").lower()
    assert "synthetic" in note


@pytest.mark.parametrize(
    ("category", "amount", "expected"),
    [
        ("FUEL", 2000, 50.0),
        ("FUEL", 1000, 25.0),
        ("GROCERIES", 100, round(100 / 100 * 0.45, 4)),
        ("SALARY", 5000, 0.0),
    ],
)
def test_carbon_matches_the_documented_formula(category, amount, expected):
    """The worked example from the project proposal, verbatim.

    INR 2,000 of fuel at 2.5 kg per INR 100 must be 50 kg CO2e. If the units or
    the arithmetic move, every figure the product shows a user is wrong.
    """
    response = client.post("/ml/carbon", json={"category": category, "amount": amount})
    assert response.status_code == 200, response.text
    assert response.json()["co2e_kg"] == pytest.approx(expected)


def test_offsets_are_negative():
    response = client.post("/ml/carbon", json={"category": "OFFSET", "amount": 1000})
    assert response.json()["co2e_kg"] < 0


def test_carbon_falls_back_to_other_for_an_unknown_category():
    response = client.post("/ml/carbon", json={"category": "NOT_A_CATEGORY", "amount": 100})
    assert response.status_code == 200
    assert "co2e_kg" in response.json()


def test_every_category_is_labelled():
    from app.emission_factors import CATEGORY_LABELS, EMISSION_FACTORS

    for category in EMISSION_FACTORS:
        response = client.post("/ml/carbon", json={"category": category, "amount": 10})
        assert response.json()["label"]


def test_negative_amount_is_rejected():
    response = client.post("/ml/carbon", json={"category": "FUEL", "amount": -100})
    assert response.status_code == 422


def test_carbon_response_declares_its_provenance():
    response = client.post("/ml/carbon", json={"category": "FUEL", "amount": 100}).json()
    assert response["source"]
    assert "disclaimer" in response  # the API contract keeps this for clients
    assert "estimate" in response["disclaimer"].lower()
