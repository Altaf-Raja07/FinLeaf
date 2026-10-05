#!/usr/bin/env python3
"""
Train the FinLeaf models and write evaluation metrics.

Run directly (  python ml/scripts/train.py  ) or through `npm run ml:train`.
Reports accuracy, precision, recall, ROC-AUC for the trust score, and flag rate
plus injected-anomaly recall for the Isolation Forest.

Every reported number comes from a held-out slice of synthetic data and is
labelled as illustrative. Nothing here is a claim about real creditworthiness.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

# Allow `python ml/scripts/train.py` from the repo root.
ML_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ML_DIR))

from service import METRICS_FILE, MODEL_VERSION, train  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Train the FinLeaf ML models.")
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="only print the summary table, not the full metric dump",
    )
    args = parser.parse_args()

    metrics = train()
    metrics["trained_at"] = datetime.now(timezone.utc).isoformat()

    with METRICS_FILE.open("w") as handle:
        json.dump(metrics, handle, indent=2)

    trust = metrics["trust_score"]
    anomaly = metrics["anomaly_detection"]

    if not args.quiet:
        print(json.dumps(metrics, indent=2))

    print(f"\n[{MODEL_VERSION}] evaluation on held-out synthetic data")
    print("  trust score (logistic regression)")
    print(f"    accuracy   {trust['accuracy']:.4f}")
    print(f"    precision  {trust['precision']:.4f}")
    print(f"    recall     {trust['recall']:.4f}")
    print(f"    roc_auc    {trust['roc_auc']:.4f}")
    print("  anomaly detection (isolation forest)")
    print(f"    flag rate  {anomaly['flag_rate']:.4f}")
    print(f"    precision  {anomaly['precision']}")
    print(f"    recall     {anomaly['recall']}")
    print(
        f"    caught     {anomaly['caught_injected_anomalies']}"
        f"/{anomaly['injected_anomalies']} injected anomalies"
    )
    print(f"\n  models written to {ML_DIR / 'models'}")
    print("  NOTE: synthetic data only. Illustrative, not a real-world result.")


if __name__ == "__main__":
    main()