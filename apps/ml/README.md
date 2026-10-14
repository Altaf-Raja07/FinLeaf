# FinLeaf ML service

A small FastAPI service that scores trust and screens for unusual payments. It
is a separate service from the web app so models can be retrained or replaced
without redeploying anything else, and so the compute does not compete with the
web tier.

```
apps/web  --HTTP-->  apps/ml
```

The web app treats this service as **optional at runtime**. If it is unreachable,
trust scores fall back to an explicit rule set and the interface says so, rather
than failing a loan applicant over a sidecar container being down.

---

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness. Used by the Docker healthcheck and the app's admin screen. |
| `GET` | `/model/metrics` | Held-out metrics for both trust models and the anomaly detector. |
| `POST` | `/ml/trust-score` | Scores a user 0-100 with a per-factor explanation. |
| `POST` | `/ml/anomaly-score` | Screens a payment 0-1 with human-readable reasons. |
| `POST` | `/ml/carbon` | Estimated CO₂e for a category and amount. |
| `GET` | `/carbon/factors` | The emission-factor table, with methodology notes. |

### `POST /ml/trust-score`

```jsonc
{
  "savings_regularity": 0.6,   // 0-1   how consistently the user saves
  "on_time_bill_ratio": 0.5,   // 0-1   share of bills paid on time
  "txn_consistency": 0.4,      // 0-1   steadiness of monthly activity
  "account_age_days": 0.3,     // 0-1   account age, normalised to years
  "group_activity": 0.33,      // 0-1   trust-circle / family engagement, saturates at 3
  "avg_balance_stability": 0.5,// 0-1   how little the balance swings
  "monthly_txn_count": 0.4,    // 0-1   transactions last 30 days, normalised
  "repayment_history": 0.0,    // 0-1   share of instalments repaid on time
  "model": "gb"                // "gb" = gradient boosting, "lr" = logistic regression
}
```

`account_age_days` and `monthly_txn_count` are **normalised**, not raw counts:
age is expressed in years over a one-year window and monthly volume is divided
by 30, so both scale with population rather than with a single heavy user.

Returns `score` (0-100), `probability`, the `model` that produced it, and
`top_factors` / `all_factors` with a per-factor contribution in points. The
absoluteranges are declared in `app/features.py`, and a value outside them is a
`422` with a field-level error rather than a `500` from inside scikit-learn.

### `POST /ml/anomaly-score`

```jsonc
{
  "amount_log": 6.2,          // natural log of the rupee amount
  "hour_of_day": 21,          // 0-23
  "rapid_repeat": 0.7,        // 0-1  payments to the same recipient in the last hour
  "new_counterparty": 1.0,    // 1 the first time money is sent to someone
  "category_rarity": 0.8      // 0-1  how rare the category is in the user's history
}
```

Returns `anomaly_score` (0-1), `is_anomalous`, `action`
(`review` / `auto_cleared`), and `reasons` — always a non-empty list, because the
web app renders it directly under "was this you?".

A flagged payment is **never** blocked. It is surfaced to the user for
confirmation, which keeps the feature demonstrable without a fraud-response
workflow and without locking a genuine customer out of their own account.

---

## Running

### With Docker

```bash
# from the repository root
docker compose up ml        # trains on first start, then serves on :8000
```

### Locally

```bash
cd apps/ml
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt

python -m app.train --force    # write the model artefacts
uvicorn app.main:app --reload  # serve on :8000
```

Then run the tests:

```bash
python -m pytest tests/ -q
```

---

## Training

```bash
python -m app.train           # train if the artefacts are missing
python -m app.train --force   # always retrain and rewrite
```

Training writes four files into `apps/ml/models/`:

| File | Contents |
| --- | --- |
| `trust_logreg.joblib` | The logistic-regression scorecard and its scaler. |
| `trust_gbdt.joblib` | The gradient-boosted tree. |
| `anomaly_iforest.joblib` | The isolation forest. |
| `metrics.json` | Held-out metrics, written **once** and then read from disk. |
| `mean_vector.json` | The population-mean feature vector, cached rather than recomputed. |

`metrics.json` and `mean_vector.json` are the fix for the two performance
regressions this service shipped with. The metrics used to be recomputed by
retraining every model on every `GET /model/metrics`, and the mean vector used
to be recomputed by regenerating the whole synthetic dataset on every scoring
call. Both are now artefacts.

---

## What the models are, honestly

**The training data is synthetic.** `app/training_data.py` generates a population
of users from distributions shaped by published alternative-credit-scoring
behaviour (Tala- and Branch-style), then labels each user "repayment-worthy"
with an explicit latent rule. No labelled micro-lending repayment data for
India is publicly available, so there is no real dataset to train on.

Consequences, stated plainly:

- These models are **illustrative**. They demonstrate that a behavioural
  credit score can be explained and served, and nothing more.
- The AUC-ROC figures in `/model/metrics` are measured on synthetic data and
  must not be presented as validation.
- No protected attributes are generated or used, so the score cannot
  discriminate on a proxy for gender, religion, caste or age bracket.

The synthetic provenance is written into `metrics.json` itself and surfaced
through `trained_on`, so the disclosure travels with the number instead of
living only in this file.

---

## Tests

`tests/` covers the behaviour that was actually broken, and names each bug in
the docstring of the test that guards it:

| File | Guards against |
| --- | --- |
| `test_trust_score.py` | `model` not selecting a model; explanations dropping features; non-finite input reaching the model; the mean vector being refitted per request. |
| `test_anomaly.py` | OpenAPI schema drifting away from the model's feature list; an empty `reasons` list; out-of-range input reaching the model. |
| `test_metrics_and_carbon.py` | `GET /model/metrics` refitting on every request; the ₹2,000 → 50 kg worked example; synthetic provenance not being carried in the metrics. |

`conftest.py` trains once if the artefacts are missing, so `pytest` runs on a
fresh checkout. If scikit-learn cannot be installed, the suite **skips** rather
than failing for an unrelated reason.

---

## Feature ranges

Defined once in `app/features.py` and used by the request schemas, the training
data and the scorer, so the three cannot drift:

```
savings_regularity     0.0 - 1.0
on_time_bill_ratio     0.0 - 1.0
txn_consistency        0.0 - 1.0
account_age_days       0.0 - 1.0   (normalised to years)
group_activity         0.0 - 1.0   (saturates at 3 groups)
avg_balance_stability  0.0 - 1.0
monthly_txn_count      0.0 - 1.0   (normalised to 30 transactions)
repayment_history      0.0 - 1.0
```
