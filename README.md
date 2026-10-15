# FinLeaf

**Banking that reaches everyone, and is good for the planet.**

A web-based digital banking platform for financial inclusion and
carbon-conscious banking — built as a mini project for IIIT Dharwad.

FinLeaf brings basic banking (accounts, transfers, savings, small loans) to
people who are currently unbanked or underbanked, and makes the environmental
cost of spending visible.

> **What this is not.** FinLeaf does not move real money, does not connect to a
> bank, does not settle utility or telecom bills, and does not issue real credit.
> Every number in the interface is either a fact about your own account or an
> estimate that is labelled as one.

---

## Contents

- [What it does](#what-it-does)
- [Quick start](#quick-start)
- [Architecture](#architecture)
- [Project layout](#project-layout)
- [How the money works](#how-the-money-works)
- [How the numbers are produced](#how-the-numbers-are-produced)
- [Testing](#testing)
- [Deployment](#deployment)
- [Deliberate omissions](#deliberate-omissions)

---

## What it does

### Core banking
- **Registration and sign-in** by phone number and a one-time code, with a
  password. OTPs are delivered through a pluggable SMS transport (Twilio or
  MSG91); `console` is available for development and is **refused** in
  production at the point an OTP is sent, so a deployment without SMS
  credentials runs normally and only the OTP flows return a clear error.
- **Dashboard** with balance, recent activity, scores and quick actions.
- **Transfers** between accounts or phone numbers, with the recipient's name
  confirmed before you send.
- **Transaction history** filterable by date, category, amount and note, with a
  CSV statement export.
- **Bill payments and recharges** for real Indian billers. These debit your
  FinLeaf account and record a receipt — they do **not** settle a real bill, and
  the page says so where the payment is made.

### Financial inclusion
- **Trust score** (0–100) derived from eight behavioural features of your own
  activity, served by the ML service, with a per-factor explanation.
- **Micro-loans** sized by an explicit policy applied to the trust score, with a
  read-your-own repayment schedule.
- **Savings goals** with real debits — the goal moves money out of your balance.
- **Literacy lessons and quizzes** in English, Hindi and Kannada, with badges
  awarded only when the criterion is actually met.
- **Family groups** sharing *visibility* only. Invites use single-use,
  SHA-256-hashed tokens.
- **Trust circles** — small peer groups who vouch for each other, mirroring
  microfinance self-help groups.
- **Nearby agent locator**, which ships empty because the directory is
  operator-supplied (see [Deliberate omissions](#deliberate-omissions)).
- **A rule-based assistant** answering questions from your own account data.

### Sustainability
- **Carbon tracker** — estimated CO₂e per transaction, monthly trend, breakdown
  by category, always labelled as an estimate.
- **Green points** for low-carbon spending choices.
- **Paperless metrics** from stated constants.
- **Sustainability score** (0–100), described in the interface as a product
  construct rather than a rating.
- **Carbon offset marketplace**, each project listing its estimated benefit
  *and the source that published it*.
- **Village leaderboard**, comparing you against people in your own village.

### Security and honesty
- Double-entry ledger, immutable `LedgerEntry` rows, idempotent payments,
  guarded balance updates (an account cannot be overdrawn, even under
  concurrency).
- Passwords hashed with bcrypt; OTPs and session tokens stored only as HMAC
  digests; no raw tokens or codes anywhere in the database.
- Append-only audit log for security- and money-relevant events.
- Rate limiting on every endpoint that costs money or sends SMS.
- Rate limits are backed by Postgres, so they hold across multiple instances.

---

## Quick start

```bash
# 1. Postgres (from the repository root)
docker compose up -d db

# 2. Web app
cd apps/web
cp .env.example .env        # edit: DATABASE_URL is already correct for compose
npm install
npx prisma migrate dev      # creates the schema and applies the migration
npm run db:seed              # loads the literacy curriculum, badges, billers, offset projects

# 3. ML service
cd ../ml
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m app.train --force  # writes the model artefacts

# 4. Run
cd ../web && npm run dev
cd ../ml  && uvicorn app.main:app --reload
```

Open <http://localhost:3000>.

The app boots against a **completely empty database**: no users, no accounts, no
transactions. Create an account and it is genuinely empty of sample data. To
create an administrator, set `SEED_ADMIN_PHONE` before `npm run db:seed` — the
password is printed once.

### With Docker

```bash
cp .env.example .env         # set APP_SECRET, APP_URL, SMS_PROVIDER, etc.
docker compose up --build
```

This runs the database, the ML service and the web app, with a one-shot `migrate`
container that applies migrations and seeds reference data before the web app
accepts traffic.

---

## Architecture

```
                ┌──────────────┐
                │   Browser    │
                └──────┬───────┘
                       │
              ┌────────▼─────────┐
              │   apps/web       │  Next.js 16 App Router
              │   ─────────      │  Server Components + Server Actions
              │                  │  Prisma 7 (Postgres)
              └────────┬─────────┘
          ┌────────────┼────────────┐
          ▼            ▼            ▼
    ┌──────────┐ ┌──────────┐ ┌────────────┐
    │ Postgres │ │  apps/ml │ │  Climatiq  │
    └──────────┘ └──────────┘ │  (optional)│
                               └────────────┘
        └─────────── instead of a failure, the web app falls back to a
                     transparent rule set and says so ───────────┘
```

The ML service is **optional at runtime**. If it is unreachable, trust scores fall
back to an explicit weighted rule set, the interface labels which path produced
the score, and nothing else breaks. A scoring outage must not fail a loan
applicant because a sidecar container is down.

---

## Project layout

```
apps/web/
  prisma/schema.prisma      Data contract (31 models)
  prisma/seed.ts            Reference data only — no users, no transactions
  data/                     Curated reference data (lessons, badges, billers, offset projects, agents)
  src/lib/
    accounting/ledger.ts    The posting engine (the only place a balance changes)
    banking/                Transfers, accounts, bills, loans
    carbon/                 Emission factors
    auth/                   Sessions, OTPs, guards
    locales/                en, hi, kn
    ...
  src/app/
    page.tsx                Marketing home
    sign-in/                Registration and sign-in
    dashboard/              Every authenticated feature
    admin/                  Administrator console
    api/                    REST endpoints
apps/ml/                    The FastAPI scorer — see apps/ml/README.md
docker-compose.yml          Postgres + ML + web
```

**Everything that changes money goes through `src/lib/banking/ledger.ts`.** It is
the only module that writes `Account.balance`.

---

## How the money works

Every movement of money is one database transaction that writes:

1. the business-level `Transaction` row,
2. the materialised `Account.balance` change,
3. immutable `LedgerEntry` rows — one `DEBIT`, one `CREDIT` — recording the
   resulting balance.

That gives three guarantees the integration tests prove against a real database:

- **An account cannot be overdrawn.** The debit is a single guarded
  `UPDATE ... WHERE balance >= amount`. Postgres row-locks for the duration of
  that statement, so two concurrent debits that together would overdraw the
  account cannot both succeed. This is not check-then-act in application code.
- **Double entry holds.** Credits minus debits, summed from the ledger, equals the
  balance on the account row.
- **Payments are idempotent.** `reference` is unique, and a replayed reference is
  rejected rather than returning a success-shaped response.

---

## How the numbers are produced

### Carbon
Emission factors are kilograms of CO₂-equivalent per ₹100 spent, following GHG
Protocol Scope 3.1 category-based estimation — the approach used by Climatiq,
Doconomy and Aspiration.

```
co2e_kg = (amount_inr / 100) * factor_per_100_inr
```

The proposal's worked example: ₹2,000 on fuel at 2.5 kg per ₹100 = **50 kg**. The
electricity factor is based on India's CEA CO₂ Baseline Database; the rest are
published lifecycle estimates. When `CLIMATIQ_API_KEY` is set, spends are looked
up against that provider instead, every transaction records which source produced
its figure, and a lookup failure falls back to the static table.

The full method, with sources, is on `/methodology` in the app.

### Trust score
Eight behavioural features read from the user's own rows, scored by a
gradient-boosted tree or a logistic-regression scorecard, with a per-factor
contribution breakdown in points. Feature ranges are declared once in
`apps/ml/app/features.py` and shared by the request schemas, the training data
and the scorer.

**The training data is synthetic.** No labelled micro-lending repayment data for
India is publicly available, so `apps/ml/app/training_data.py` generates a
population from published alternative-credit-scoring behaviour and labels it with
an explicit latent rule. The models are illustrative, the AUC-ROC figures are
measured on that synthetic data, and the synthetic provenance is written into
`metrics.json` and surfaced through `trained_on` rather than only living in a
README.

No protected attributes are generated or used, so the score cannot discriminate
on a proxy for gender, religion, caste or age bracket.

### Anomaly detection
An isolation forest screens for unusual payments. A flagged payment is surfaced
to the user for confirmation — **it is never blocked**, because a payment that is
genuinely theirs must still be able to go through.

---

## Testing

```bash
cd apps/web
npm run check              # lint + typecheck + unit tests
npm run test:integration   # ledger tests against a live Postgres
npm run smoke:money        # end-to-end money path against the database

cd apps/ml
python -m pytest tests/ -q
```

What the suites cover that matters:

| Suite | Proves |
| --- | --- |
| `ledger.integration.test.ts` | Double-entry invariant, overdraft refusal, draining to exactly zero, idempotency, and **five concurrent debits serialising** so the balance cannot go negative. |
| `i18n.test.ts` | Every key present in all three locales, and every `{placeholder}` surviving translation. |
| `carbon.test.ts` | The ₹2,000 → 50 kg worked example, decimal arithmetic, category fallback. |
| `apps/ml/tests/` | Model selection actually selects a model; metrics are cached not recomputed; input outside range is a 422; the mean vector is not refitted per request. |

---

## Deployment

### Environment

`apps/web/.env.example` documents every variable. The ones that matter in
production:

| Variable | Why |
| --- | --- |
| `APP_SECRET` | 32+ random bytes. Derived into OTP and session digests. Required. |
| `APP_URL` | Absolute https origin. Required, and must be https in production. |
| `SMS_PROVIDER` | `twilio` or `msg91`. `console` is refused in production. |
| `ML_SERVICE_URL` | Optional. When unreachable, scores use the labelled rule fallback. |
| `CLIMATIQ_API_KEY` | Optional. Enables the standards-aligned carbon lookup. |

### Containers

`docker-compose.yml` runs Postgres, the ML service and the web app. A one-shot
`migrate` container applies migrations, seeds reference data and then verifies
that every record in `data/` actually landed; the web app waits for it to
complete successfully before serving traffic.

The ML service uses `/ready` for its healthcheck, not `/health`. That distinction
is deliberate and was the fix for a real bug — see
[apps/ml/README.md](apps/ml/README.md).

---

## Deliberate omissions

These were removed rather than shipped, and the reason is recorded in each case:

| Removed | Why |
| --- | --- |
| **Demo users, accounts and transactions** | A seeded account showed a fabricated balance to a developer who could not recompute it, and it made the platform impossible to evaluate honestly. The app now boots empty; the only way to see a transaction is to make one. |
| **The `Voucher` model** | Nothing anywhere wrote to it, and the proposal never asked for vouchers. The rewards page now says what green points are actually for (offset projects) instead of listing empty catalogue UI. |
| **Sample agent records** | A fabricated banking agent would point a user at a real stranger's phone number. The directory is operator-supplied and starts empty; the page explains that. |
| **`mockIdHash`** | A "prototype only" column for a government ID number. Nothing may store ID numbers, so it did not exist in the final schema. |
| **JWT sessions** | Opaque revocable session tokens. A JWT cannot be revoked before expiry without a deny-list, and instant revocation matters for a banking product. |
| **React Compiler** | Off by default in Next 16, and enabling it added a dependency for a memoisation win this app does not need. |

---

## References

- World Bank, *The Global Findex Database 2025*.
- Reserve Bank of India, *Digital Lending Directions, 2025* — the explainability
  shown with every trust score is a response to this.
- Climatiq, *Methodology Hub* — GHG Protocol Scope 3.1.
- India's Central Electricity Authority, *CO₂ Baseline Database*.
