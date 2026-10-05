#!/usr/bin/env bash
# Creates ml/.venv and installs the pinned dependencies.
# Uses a venv because the system Python is externally managed (PEP 668).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

if [ ! -d .venv ]; then
  echo "[ml] creating .venv"
  python3 -m venv .venv
fi

./.venv/bin/pip install --quiet --disable-pip-version-check -r requirements.txt
echo "[ml] dependencies installed"
./.venv/bin/python -c "import sklearn, numpy, joblib; print('[ml] scikit-learn', sklearn.__version__, '| numpy', numpy.__version__)"
