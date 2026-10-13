"""
The feature contract shared by the API, the trainer and the scorer.

Every input the service accepts is declared here exactly once: its name, the
range it is valid in, and a plain-English description of its scale. The API
layer turns these ranges into Pydantic constraints (so FastAPI rejects bad input
with 422 before a handler runs), the scorer clamps to them again as a second
line of defence, and the training data generator clips to the same ranges so a
model can never be fitted on values the API would refuse to score.

Keeping one source of truth is what stops the three drifting apart: a model
fitted on `account_age_days` up to 2.47 while the API rejects anything above
1.0 would score every older account as if it were "maxed out".
"""

from typing import NamedTuple


class FeatureSpec(NamedTuple):
    """One model input: its valid range and what the number actually means."""

    low: float
    high: float
    description: str


# --- Trust scoring ----------------------------------------------------------
#
# Six features are plain 0-1 ratios. Two are normalised counts: the caller sends
# `account_age_days` as a fraction of a year (0.5 = ~6 months) and
# `monthly_txn_count` as a fraction of 30 transactions, because the synthetic
# training population is defined in those normalised units too.
FEATURES: list[str] = [
    "savings_regularity",       # 0-1, how consistently they save
    "on_time_bill_ratio",       # 0-1, share of bills paid on time
    "txn_consistency",          # 0-1, steadiness of transaction activity
    "account_age_days",         # normalised
    "group_activity",           # 0-1, trust-circle / family engagement
    "avg_balance_stability",    # 0-1, how little the balance swings
    "monthly_txn_count",        # normalised
    "repayment_history",        # 0-1, prior micro-loan repayment record
]

TRUST_FEATURE_SPECS: dict[str, FeatureSpec] = {
    "savings_regularity": FeatureSpec(0.0, 1.0, "Share of income saved, 0-1"),
    "on_time_bill_ratio": FeatureSpec(0.0, 1.0, "Share of bills repaid on time, 0-1"),
    "txn_consistency": FeatureSpec(0.0, 1.0, "Steadiness of daily transaction activity, 0-1"),
    "account_age_days": FeatureSpec(
        0.0, 1.0, "Account age normalised to years (0.5 = ~182 days, 1.0 = 365+ days)"
    ),
    "group_activity": FeatureSpec(0.0, 1.0, "Trust-circle / family group engagement, 0-1"),
    "avg_balance_stability": FeatureSpec(0.0, 1.0, "How little the balance swings, 0-1"),
    "monthly_txn_count": FeatureSpec(
        0.0, 1.0, "Monthly transactions normalised to 30 (0.5 = ~15 transactions)"
    ),
    "repayment_history": FeatureSpec(0.0, 1.0, "Prior micro-loan repayment record, 0-1"),
}

# --- Anomaly detection ------------------------------------------------------
#
# `amount_log` is the natural log of the rupee amount (ln 500 ~ 6.2, which is
# the mean of the synthetic training population). The upper bound is generous on
# purpose: a large transfer is exactly the thing this model exists to flag, so
# the API must never reject one as malformed - it rejects only values that
# cannot be a log of a rupee amount at all (negative, NaN, infinite).
ANOMALY_FEATURES: list[str] = [
    "amount_log",
    "hour_of_day",
    "rapid_repeat",
    "new_counterparty",
    "category_rarity",
]

ANOMALY_FEATURE_SPECS: dict[str, FeatureSpec] = {
    "amount_log": FeatureSpec(
        0.0, 30.0, "Natural log of the rupee amount (ln 500 = 6.2; 0 = INR 1)"
    ),
    "hour_of_day": FeatureSpec(0.0, 23.0, "Local hour of day, 0-23"),
    "rapid_repeat": FeatureSpec(0.0, 1.0, "Repeats to the same payee in the last hour, saturating at 1"),
    "new_counterparty": FeatureSpec(0.0, 1.0, "1 the first time money is sent to this payee, else 0"),
    "category_rarity": FeatureSpec(0.0, 1.0, "How rare this category is in the user's own history, 0-1"),
}

# How each behavioural feature maps to a plain-English label for the UI.
FEATURE_LABELS: dict[str, str] = {
    "savings_regularity": "Regular savings",
    "on_time_bill_ratio": "On-time bill payments",
    "txn_consistency": "Consistent transactions",
    "account_age_days": "Account age",
    "group_activity": "Group participation",
    "avg_balance_stability": "Stable balance",
    "monthly_txn_count": "Transaction activity",
    "repayment_history": "Repayment record",
}

ANOMALY_LABELS: dict[str, str] = {
    "amount_log": "Unusually large amount",
    "hour_of_day": "Unusual time of day",
    "rapid_repeat": "Rapid repeated transaction",
    "new_counterparty": "First-time recipient",
    "category_rarity": "Unusual spending category",
}