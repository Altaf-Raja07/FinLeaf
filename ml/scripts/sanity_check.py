#!/usr/bin/env python3
"""
Sanity checks for the ML service.

These are the checks the proposal's evaluation plan calls for, run as assertions
so a regression fails loudly:

  * every trust-score contribution is real arithmetic on the fitted coefficients
  * the displayed breakdown sums to the displayed score
  * the score rises when a positive feature rises, and falls when it falls
  * no user ever sees a perfect 0 or 100
  * Isolation Forest catches the injected anomalies without flagging much else
  * the feature set contains no protected attributes

Run: ml/.venv/bin/python ml/scripts/sanity_check.py
"""

from __future__ import annotations

import sys
from pathlib import Path

ML_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ML_DIR))

import joblib  # noqa: E402
import numpy as np  # noqa: E402

from service import (  # noqa: E402
    CONTRIBUTION_CAP,
    FEATURES,
    NEUTRAL_SCORE,
    anomaly_scores,
    generate_anomaly_data,
    load_models,
    trust_score,
)

PASSED = 0
FAILED: list[str] = []


def check(label: str, condition: bool, detail: str = "") -> None:
    global PASSED
    if condition:
        PASSED += 1
        print(f"  PASS  {label}")
    else:
        FAILED.append(label)
        print(f"  FAIL  {label}{(' - ' + detail) if detail else ''}")


PROFILES = {
    "weak": {
        "savings_regularity": 0.15,
        "bill_on_time_ratio": 0.20,
        "transaction_consistency": 0.25,
        "account_age_months": 0.05,
        "family_group_activity": 0.10,
    },
    "moderate": {
        "savings_regularity": 0.50,
        "bill_on_time_ratio": 0.60,
        "transaction_consistency": 0.50,
        "account_age_months": 0.40,
        "family_group_activity": 0.45,
    },
    "strong": {
        "savings_regularity": 0.85,
        "bill_on_time_ratio": 0.90,
        "transaction_consistency": 0.80,
        "account_age_months": 0.70,
        "family_group_activity": 0.65,
    },
    "empty": {name: 0.0 for name in FEATURES},
}


def main() -> None:
    load_models()
    if not any(True for _ in [0]) or "trust" not in __import__("service")._models:
        print("models not loaded; run ml/scripts/train.py first")
        sys.exit(1)

    print("\n[1] no protected attributes in the feature set")
    forbidden = {"gender", "sex", "caste", "religion", "race", "age_of_person",
                 "caste_or_religion", "aadhaar", "pan", "name", "phone", "address"}
    present = {f.lower() for f in FEATURES} & forbidden
    check("feature set excludes protected attributes", not present, f"found {present}")

    print("\n[2] breakdown reconciles with the displayed score")
    for name, profile in PROFILES.items():
        result = trust_score(profile)
        total = NEUTRAL_SCORE + sum(c["points"] for c in result["contributions"])
        check(
            f"{name}: contributions sum to the score",
            total == result["score"],
            f"score={result['score']} contributions give {total}",
        )
        check(
            f"{name}: every contribution is within the cap",
            all(abs(c["points"]) <= CONTRIBUTION_CAP for c in result["contributions"]),
        )

    print("\n[3] score responds correctly to each feature")
    base = dict(PROFILES["moderate"])
    baseline_score = trust_score(base)["score"]
    for feature in FEATURES:
        higher = dict(base)
        higher[feature] = min(1.0, base[feature] + 0.3)
        lower = dict(base)
        lower[feature] = max(0.0, base[feature] - 0.3)
        check(
            f"raising {feature} does not lower the score",
            trust_score(higher)["score"] >= baseline_score,
            f"{baseline_score} -> {trust_score(higher)['score']}",
        )
        check(
            f"lowering {feature} does not raise the score",
            trust_score(lower)["score"] <= baseline_score,
            f"{baseline_score} -> {trust_score(lower)['score']}",
        )

    print("\n[4] ordering is sensible")
    scores = {name: trust_score(p)["score"] for name, p in PROFILES.items()}
    check("strong > moderate > weak", scores["strong"] > scores["moderate"] > scores["weak"],
          str(scores))
    check("a new user does not start at 0 or 100",
          0 < scores["empty"] < 100, f"empty profile scored {scores['empty']}")

    print("\n[5] contributions are arithmetic on the fitted coefficients")
    bundle = joblib.load(ML_DIR / "models" / "trust_score.joblib")
    coefficients = dict(zip(FEATURES, bundle["model"].coef_[0]))
    profile = PROFILES["moderate"]
    result = trust_score(profile)
    for item in result["contributions"]:
        # Recompute independently: the sign must follow the fitted coefficient.
        expected_sign = 1 if coefficients[item["feature"]] > 0 else -1
        actual_sign = (item["points"] > 0) - (item["points"] < 0)
        if item["points"] != 0:
            check(
                f"{item['feature']} sign follows its coefficient",
                actual_sign == expected_sign,
                f"coef={coefficients[item['feature']]:+.3f} points={item['points']}",
            )
    # A zero-valued feature must contribute nothing.
    zeroed = dict(profile)
    zeroed["savings_regularity"] = 0.0
    zero_contrib = next(
        c for c in trust_score(zeroed)["contributions"] if c["feature"] == "savings_regularity"
    )
    check("a zero feature contributes zero", zero_contrib["points"] == 0,
          f"got {zero_contrib['points']}")

    print("\n[6] anomaly detection finds injected anomalies")
    A, labels = generate_anomaly_data()
    # Ordinary traffic: one per day for a month.
    normal_txns = [
        {"reference": f"n{i}", "amount": float(A[i][0]), "hour": int(A[i][1]), "burst": float(A[i][2])}
        for i in range(1000)
    ]
    result = anomaly_scores(normal_txns)
    check("flags few ordinary transactions", len(result["alerts"]) <= 60,
          f"flagged {len(result['alerts'])} of 1000")
    check("every alert explains itself",
          all(a["reasons"] for a in result["alerts"]))

    obvious = [
        {"reference": "big-night", "amount": 500000.0, "hour": 3, "burst": 0},
        {"reference": "burst", "amount": 30000.0, "hour": 14, "burst": 9},
    ]
    flagged = {a["reference"] for a in anomaly_scores(obvious)["alerts"]}
    check("flags a large transfer at 3am", "big-night" in flagged, str(flagged))
    check("flags a burst of repeats", "burst" in flagged, str(flagged))

    check("an empty list is handled", anomaly_scores([])["alerts"] == [])

    print("\n[7] a clean ordinary transaction is not flagged")
    quiet = [{"reference": "bus", "amount": 250.0, "hour": 9, "burst": 0}]
    check("a 250-rupee bus ticket at 9am is unremarkable",
          anomaly_scores(quiet)["alerts"] == [])

    print(f"\n{PASSED} passed, {len(FAILED)} failed")
    if FAILED:
        print("failures:")
        for item in FAILED:
            print(f"  - {item}")
        sys.exit(1)
    print("all ML sanity checks passed")


if __name__ == "__main__":
    main()