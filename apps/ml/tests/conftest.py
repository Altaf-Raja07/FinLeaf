"""Shared fixtures for the ML service tests.

The tests exercise the real service, so they need real model artefacts. Rather
than committing a second copy of the models or requiring a training step before
`pytest` will run, the session fixture trains once if - and only if - the
artefacts are missing. If training cannot run at all (scikit-learn unavailable,
read-only checkout) the tests skip rather than fail for the wrong reason.
"""

import os
import sys

import pytest

# The service is imported as `app.*`, so the package root (apps/ml) has to be
# importable regardless of where pytest was invoked from.
APP_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if APP_ROOT not in sys.path:
    sys.path.insert(0, APP_ROOT)

from app import models as ml  # noqa: E402  (after the sys.path fix above)


@pytest.fixture(scope="session")
def trained_models() -> dict:
    """Guarantee model artefacts exist, training once if necessary."""
    paths = ml.artefact_paths()
    if ml.artefacts_present() and os.path.exists(paths["metrics"]):
        return paths

    try:
        ml.train_models(force=True)
    except Exception as exc:  # pragma: no cover - environment dependent
        pytest.skip(f"could not train model artefacts: {exc}")

    if not ml.artefacts_present() or not os.path.exists(paths["metrics"]):
        pytest.skip("model artefacts unavailable after training")
    return paths


@pytest.fixture(scope="session")
def client(trained_models):
    """A TestClient bound to the real ASGI app."""
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as test_client:
        yield test_client