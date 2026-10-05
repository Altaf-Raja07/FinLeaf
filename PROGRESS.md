# FinLeaf progress checklist

Status key: `not-started` · `in-progress` · `implemented` · `tested` · `visually-verified`

`implemented` means the code exists and runs. `tested` means a real check passed
(a script, a query, or a browser assertion). `visually-verified` means a
browser screenshot was captured at the reference viewport, compared against the
approved reference, and the drift was fixed. Nothing is called complete on the
strength of compiling alone.

Everything on this list is **simulated prototype** functionality: no real bank
rails, no real money, and no real credentials are collected or stored.

## Milestone 1 — Foundation

| # | Item | Status | Notes |
| --- | --- | --- | --- |
| 1.1 | PostgreSQL via docker compose | `tested` | postgres:16-alpine, host-exposed 55432 |
| 1.2 | Schema + repeatable migrations | `tested` | `npm run db:migrate`, forward-only SQL |
| 1.3 | Deterministic demo seed | `tested` | `npm run db:seed`, fixed RNG seed |
| 1.4 | DB access layer (pooled, typed) | `tested` | `src/lib/db` |
| 1.5 | Password hashing (scrypt) | `tested` | node:crypto, no plaintext, no dep |
| 1.6 | Session auth + route protection | `tested` | httpOnly cookie, hashed token, expiry |
| 1.7 | Authorisation on sensitive ops | `tested` | every route handler resolves the session |
| 1.8 | REST API + validation + error shape | `tested` | `src/app/api`, shared envelope |
| 1.9 | Transaction-safe wallet ops | `tested` | SQL transaction + row lock, idempotency key |
| 1.10 | Carbon factor module | `tested` | `src/lib/carbon`, proposal worked example |
| 1.11 | Green-points ledger, no double award | `tested` | unique index on (transaction_id) |
| 1.12 | Python ML service skeleton + contract | `tested` | `ml/`, stdlib HTTP, sklearn models |
| 1.13 | `.env.example`, setup docs | `tested` | placeholders only |
| 1.14 | Reset/reseed workflow | `tested` | `npm run db:reset` |

## Milestone 2 — Shell and design system

| # | Item | Status | Notes |
| --- | --- | --- | --- |
| 2.1 | Design tokens as CSS variables | `tested` | mirrors `design/design-system.md` |
| 2.2 | App shell: sidebar + content frame | `visually-verified` | 9 nav items, no global search |
| 2.3 | Mobile bottom tab bar | `visually-verified` | 5 tabs, per mobile reference |
| 2.4 | Shared components | `implemented` | button, input, card, metric, row, gauge, chart, states |
| 2.5 | Responsive breakpoints | `tested` | 640 / 1024 / 1440 |
| 2.6 | Accessibility pass on shell | `tested` | focus, landmarks, contrast, reduced motion |

## Milestone 3 — Dashboard vertical slice

| # | Item | Status | Notes |
| --- | --- | --- | --- |
| 3.1 | Dashboard from seeded data + API | `tested` | balance, scores, quick actions |
| 3.2 | Recent transactions (real rows) | `tested` | live DB records |
| 3.3 | Monthly carbon chart (real data) | `tested` | computed from transactions |
| 3.4 | Screenshot vs `design/dashboard.png` | `visually-verified` | |
| 3.5 | Mobile dashboard vs mobile reference | `visually-verified` | |
| 3.6 | Empty / loading / error states | `tested` | |

## Milestone 4 — Remaining screens

| # | Screen | Reference | Status |
| --- | --- | --- | --- |
| 4.1 | Landing | `landing.png` | `not-started` |
| 4.2 | Login | `login.png` | `not-started` |
| 4.3 | Signup | `signup.png` | `not-started` |
| 4.4 | Onboarding | `onboarding.png` | `not-started` |
| 4.5 | Transfer | `transfer.png` | `not-started` |
| 4.6 | Transaction history | `transaction-history.png` | `not-started` |
| 4.7 | Bill payments | `bill-payments.png` | `not-started` |
| 4.8 | Trust score | `trust-score.png` | `not-started` |
| 4.9 | Loans | `loan-application.png` | `not-started` |
| 4.10 | Savings goals | `savings-goals.png` | `not-started` |
| 4.11 | Financial literacy | `financial-literacy.png` | `not-started` |
| 4.12 | Family accounts | `family-accounts.png` | `not-started` |
| 4.13 | Trust circles | `trust-circles.png` | `not-started` |
| 4.14 | Agent locator | `agent-locator.png` | `not-started` |
| 4.15 | Voice assistant | `voice-assistant.png` | `not-started` |
| 4.16 | Chatbot | `chatbot.png` | `not-started` |
| 4.17 | Sustainability dashboard | `sustainability-dashboard.png` | `not-started` |
| 4.18 | Carbon details | `carbon-details.png` | `not-started` |
| 4.19 | Green rewards | `green-rewards.png` | `not-started` |
| 4.20 | Carbon offsets | `carbon-offsets.png` | `not-started` |
| 4.21 | Leaderboard | `leaderboard.png` | `not-started` |
| 4.22 | Fraud alerts | `fraud-alerts.png` | `not-started` |
| 4.23 | Settings | `profile-settings.png` | `not-started` |

## Milestone 5 — ML and integrations

| # | Item | Status | Notes |
| --- | --- | --- | --- |
| 5.1 | Trust-score model (logistic regression) | `tested` | sklearn, synthetic data |
| 5.2 | Explainable contributions from real coefficients | `tested` | no invented explanations |
| 5.3 | Isolation Forest anomaly detection | `tested` | flags for review, never blocks |
| 5.4 | Anomaly review flow persisted | `not-started` | |
| 5.5 | Model evaluation (acc, P/R, ROC-AUC, flag rate) | `tested` | illustrative, labelled as such |
| 5.6 | Optional emissions API + static fallback | `not-started` | key stays server-side |
| 5.7 | No protected attributes in scoring | `tested` | gender/caste/religion excluded |

## Milestone 6 — QA and delivery

| # | Item | Status | Notes |
| --- | --- | --- | --- |
| 6.1 | Unit tests for money/carbon/points logic | `not-started` | |
| 6.2 | Integration test of primary journey | `not-started` | |
| 6.3 | Visual QA report per screen | `not-started` | `artifacts/visual/` |
| 6.4 | Accessibility audit | `not-started` | |
| 6.5 | README: setup, run, test, demo | `not-started` | |
| 6.6 | Feature / limitation / blocker list | `not-started` | |
| 6.7 | Push to GitHub | `blocked-on-gh-auth` | 3 local commits ready |

## Explicitly out of scope or intentionally absent

- Real banking connections, real payments, real card or government ID capture.
- SMS/OTP delivery to a real phone: the demo OTP is documented in-app and in
  the README, and the UI never claims an SMS was sent.
- Autoencoder anomaly model (proposal marks it future work).
- Horizontal scalability, rate limiting, CSRF tokens beyond SameSite cookies:
  appropriate omissions for a local prototype, noted rather than silently dropped.