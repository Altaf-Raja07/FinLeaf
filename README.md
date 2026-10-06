# FinLeaf

**Digital banking for financial inclusion and low-carbon spending.**

FinLeaf is a simulated digital banking prototype for people the banking system
usually overlooks: rural users, daily-wage workers, and anyone without a credit
history, a nearby branch, or fluency in English. It brings accounts, savings and
small micro-loans within reach, and it estimates the carbon footprint of your
spending so you can see what your money costs the environment.

> **This is a student prototype, not a bank.** Every balance, transfer, bill and
> loan in it is simulated inside a local database. No real bank holds your money,
> no payment network is involved, no card or government ID is ever requested, and
> the carbon figures are category-based *estimates* rather than measurements.

---

## Quick start

Requires Node 20+, Python 3.12+, and Docker.

```bash
# 1. Configuration
cp .env.example .env

# 2. Database
npm run db:up          # postgres 16 in docker, host port 55432
npm run db:migrate     # forward-only SQL migrations
npm run db:seed        # deterministic demo data

# 3. ML service (separate terminal)
npm run ml:setup       # creates ml/.venv and installs pinned deps
npm run ml:train       # trains both models, writes ml/models/
npm run ml:serve       # http://127.0.0.1:8000

# 4. App (separate terminal)
npm run dev            # http://localhost:3000
```

Sign in with the demo account:

| | |
| --- | --- |
| Phone | `+91 98765 43210` |
| One-time code | `123456` |

There is no SMS provider. The code is fixed, displayed in the UI, and the app
never claims a message was sent.

### Everyday commands

```bash
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm run db:status      # which migrations have been applied
npm run db:reseed      # wipe demo data and reload it (deterministic)
npm run ml:check       # 33 assertions on the models
npm run qa:visual      # screenshot every route and diff it against design/
npm run test           # unit tests for money, carbon and points logic
```

---

## What it does

### Core banking
Registration and sign-in, account and wallet balances, simulated transfers
between users, filterable transaction history, and simulated bill payments and
recharges. Every operation writes real ledger rows; a balance is always the sum
of its own transactions.

### Financial inclusion
A 0-100 **trust score** built from how you actually use the account, with a
breakdown derived from the model's own coefficients. Micro-loan eligibility
follows from that score. Goal-based micro-savings, money lessons with quizzes and
badges, family group accounts, community trust circles with peer endorsements, a
nearby agent and kiosk directory, and a financial-literacy assistant.

### Sustainability
Every transaction is tagged with a category and an emission factor, so spending
produces an **estimated** CO2e figure that persists and can always be explained.
Monthly trends, category breakdowns, green points, a rewards catalogue, an offset
marketplace, and peer comparison.

### Machine learning
Two models, in `ml/`:

- **Trust score** - logistic regression, chosen because its coefficients are
  readable, which is what makes the explanation auditable rather than invented.
- **Anomaly detection** - Isolation Forest, unsupervised, because a prototype has
  no labelled fraud. Flagged transactions are surfaced for review and **never
  blocked**.

Neither model uses gender, caste, religion, or any government identifier. That is
enforced in the feature set, not merely promised.

---

## Architecture

```
Client        Next.js 16 (App Router, React 19, Tailwind 4)
API           Next.js route handlers, REST, zod validation, shared envelope
Database      PostgreSQL 16, money as BIGINT paise with CHECK (balance >= 0)
ML service    Python 3.12 + scikit-learn, stdlib HTTP, separate process
Voice         Browser Web Speech API, with a typed fallback
```

The ML service is a separate process so models can be retrained without touching
the API. It is **optional at runtime**: if it is unreachable, the app falls back
to local scoring logic built from the same coefficients and reports which path
produced each number.

### Layout

```
db/           migrations, seed, runner
ml/           training, service, sanity checks, model artifacts
src/app/      routes (pages and API handlers)
src/components/ shared UI, icons, charts, interactive controls
src/lib/      db, auth, wallet, carbon, trust, queries, screens
scripts/      seed/render pipeline, visual capture, comparison, QA batch
design/       25 approved reference images, design system, data targets
artifacts/    visual QA screenshots, diffs and report (gitignored)
```

---

## Design

The interface was designed reference-first. Every screen has an approved
reference image in `design/`, generated with ChatGPT image generation and saved
before the screen was built.

- `design/design-system.md` - the normative document: colour, type, spacing,
  components, accessibility baseline
- `design/manifest.md` - every reference mapped to its route and viewport
- `design/demo-data-targets.md` - every figure visible in a reference, where it
  comes from, and which value wins where two references contradict each other

Each route is then implemented against its reference and compared against it in a
real browser. See `artifacts/visual/REPORT.md` for the findings, and
`npm run qa:visual` to regenerate it.

---

## Safety properties

These are enforced in code and covered by tests, not left to convention:

| Property | How |
| --- | --- |
| Money is never a float | BIGINT paise throughout |
| A balance cannot go negative | `CHECK (balance >= 0)` plus a conditional `UPDATE` |
| Transfers are atomic | One SQL transaction with `SELECT ... FOR UPDATE` |
| A repeated submit cannot pay twice | Unique index on `(user_id, idempotency_key)` |
| Points cannot be awarded twice | Unique index on `green_point_awards.transaction_id` |
| Passwords are never stored in plain text | scrypt via `node:crypto` |
| A database leak does not yield sessions | Only SHA-256 hashes of session tokens |
| Private routes and endpoints require a session | `requireUser()`, not per-file opt-in |
| Loans cannot exceed the trust-score limit | Recomputed server-side, not trusted from the form |
| Flagged transactions are never blocked | Alerts only; no reversal path exists |

---

## Evaluation

`ml/scripts/sanity_check.py` runs 33 assertions, including that the displayed
breakdown sums to the displayed score, that raising a positive feature never
lowers the score, that a zero-valued feature contributes zero, that no protected
attribute is in the feature set, and that the anomaly detector flags injected
anomalies without flagging ordinary traffic.

Model metrics from `ml/models/metrics.json`, on held-out synthetic data:

| Model | Metric | Value |
| --- | --- | --- |
| Trust score | accuracy / precision / recall | 0.861 / 0.882 / 0.878 |
| Trust score | ROC-AUC | 0.939 |
| Anomaly | flag rate / precision / recall | 0.040 / 0.960 / 1.000 |

**These are illustrative measurements of synthetic data.** They do not indicate
real-world creditworthiness or real fraud performance.

---

## Honest limitations

- **Everything is simulated.** No bank rails, no real money, no real
  credentials. Carbon values are category estimates, not measurements.
- **The models are trained on synthetic data.** The trust score illustrates the
  idea; it is not a credit decision.
- **No SMS.** The OTP is fixed and shown in the UI.
- **The demo OTP is a fixed constant**, so this must not be deployed publicly as
  it stands.
- **Security scope is prototype-appropriate**: no rate limiting, no MFA, no CSRF
  tokens beyond `SameSite` cookies, no email verification.
- **Voice support depends on the browser.** Firefox and Safari differ, and a
  denial or unsupported browser falls back to typing rather than breaking.
- **Not yet built**: the voice assistant and chatbot screens, and a standalone
  onboarding route (its steps currently fold into signup). Tracked in
  `PROGRESS.md`.
- **The carbon emissions API integration** is implemented with the static factor
  table as the working path; the optional Climatiq key is unset, so no external
  request is made.

---

## Progress and status

`PROGRESS.md` tracks every feature with a status of `not-started`,
`in-progress`, `implemented`, `tested`, or `visually-verified`, and distinguishes
real functionality from simulated behaviour. `artifacts/visual/REPORT.md` records
the visual comparison results.

## Licence and attribution

A student mini-project proposal. Emission factors are indicative values chosen to
be internally consistent for demonstration; they are not a substitute for the CEA
or lifecycle datasets the proposal references. The GHG Protocol Scope 3.1
methodology and the precedent products cited in the proposal (Tala, Branch,
Doconomy, Aspiration) are referenced as prior art, not reproduced here.