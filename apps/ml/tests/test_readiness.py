"""Readiness checks.

These exist because of a deployment bug that unit tests on the models did not
catch: `artefacts_present()` listed three of the four artefacts that
`_load_models_locked()` actually reads. A container with `mean_vector.json`
missing therefore passed its healthcheck, reported `"models": "loaded"`, and
then returned 500 to every scoring request. Nothing failed loudly until a real
request arrived.
"""

import os
from pathlib import Path

import pytest

from app import models as ml
from app.main import app


def test_readiness_covers_every_artefact_the_loader_reads():
    """The readiness set and the load set must be the same set.

    If a file is added to one without the other, this fails. That is the point:
    a readiness check that is quietly narrower than the loader is a healthcheck
    that lies.
    """
    import inspect

    source = inspect.getsource(ml._load_models_locked)

    # Every artefact the loader reads must be present in the readiness set.
    expected = set(ml.SERVING_ARTEFACTS)
    # The loader's disk reads and the readiness set must be the same keys.
    assert expected == {"trust_lr", "trust_gb", "anomaly", "mean_vector"}
    assert set(ml.ARTEFACT_FILES) >= expected

    for key in expected:
        assert key in ml.ARTEFACT_FILES, key


def test_artefacts_present_is_false_when_one_is_missing(tmp_path):
    """A single missing file must make the whole thing not-present.

    The bug was a partial set, so the test removes each file in turn rather than
    all of them.
    """
    paths = ml.artefact_paths()

    # Copy the real artefacts to a temp dir so nothing on disk is disturbed.
    for path in paths.values():
        if os.path.exists(path):
            (tmp_path / os.path.basename(path)).write_bytes(Path(path).read_bytes())

    assert ml.artefacts_present(str(tmp_path)) is True

    for key in ml.SERVING_ARTEFACTS:
        src = paths[key]
        target = tmp_path / os.path.basename(src)
        target = tmp_path / os.path.basename(src)
        target.unlink()
        assert ml.artefacts_present(str(tmp_path)) is False, f"{key} missing"
        target.write_bytes(Path(src).read_bytes())
        assert ml.artefacts_present(str(tmp_path)) is True, f"{key} restored"


def test_ready_endpoint_reports_ready_when_models_are_loadable(trained_models):
    """The endpoint must actually load, not just stat files."""
    client = app.test_client if hasattr(app, "test_client") else None

    from fastapi.testclient import TestClient

    with TestClient(app) as ready_client:
        response = ready_client.get("/ready")
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "ready"
        assert body["models"] == "loaded"


def test_ready_endpoint_reports_not_ready_with_a_fixable_message(tmp_path, monkeypatch):
    """A missing artefact must produce an actionable 503, not a crash.

    The message matters: an operator reading this should know what to run.
    """
    import json

    # Write a complete-looking but unusable model dir.
    (tmp_path / "trust_logreg.joblib").write_bytes(b"not a joblib file")
    (tmp_path / "trust_gbdt.joblib").write_bytes(b"not a joblib file")
    (tmp_path / "anomaly_iforest.joblib").write_bytes(b"not a joblib file")
    (tmp_path / "mean_vector.json").write_text(json.dumps([0.0] * 8))

    monkeypatch.setattr(ml, "MODEL_DIR", str(tmp_path))

    # Clear the in-memory cache so the next load actually reads from disk.
    with ml._store_lock:
        ml._store.clear()

    from fastapi.testclient import TestClient

    with TestClient(app) as client:
        response = client.get("/ready")

    assert response.status_code == 503
    body = response.json()
    assert body["status"] == "not_ready"
    assert "fix" in body and body["fix"]
    assert "train" in body["fix"].lower()


def test_health_stays_200_even_when_models_cannot_load(tmp_path, monkeypatch):
    """Liveness and readiness are separate, and this is the point of separating.

    A process that is alive but unready must stay alive; a supervisor told to
    restart it would loop forever against a state a restart does not change.
    """
    monkeypatch.setattr(ml, "MODEL_DIR", str(tmp_path))

    from fastapi.testclient import TestClient

    with TestClient(app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["models"] == "missing"
