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
| 1.12 | Python ML service + contract | `tested` | `ml/`, stdlib HTTP, sklearn models |
| 1.13 | `.env.example`, setup docs | `tested` | placeholders only |
| 1.14 | Reset/reseed workflow | `tested` | `npm run db:reset` |
| 1.15 | Bill due dates for punctuality | `tested` | migration 003; replaces a recency proxy |
| 1.16 | Phone normalisation | `tested` | `src/lib/phone.ts` |

## Milestone 2 — Shell and design system

| # | Item | Status | Notes |
| --- | --- | --- | --- |
| 2.1 | Design tokens as CSS variables | `tested` | mirrors `design/design-system.md` |
| 2.2 | App shell: sidebar + content frame | `visually-verified` | 9 nav items, no global search |
| 2.3 | Mobile bottom tab bar | `visually-verified` | 5 tabs, per mobile reference |
| 2.4 | Shared components | `implemented` | button, input, card, metric, row, gauge, chart, states |
| 2.5 | Responsive breakpoints | `tested` | 640 / 1024 / 1440 |
| 2.6 | Accessibility pass on shell | `tested` | focus, landmarks, contrast, reduced motion |
| 2.7 | Login + OTP flow with real failures | `tested` | wrong OTP and unknown number both rejected |
| 2.8 | Open-redirect-safe redirects | `tested` | `src/lib/redirect.ts` |

## Milestone 3 — Dashboard vertical slice

| # | Item | Status | Notes |
| --- | --- | --- | --- |
| 3.1 | Dashboard from seeded data + API | `tested` | balance, scores, quick actions |
| 3.2 | Recent transactions (real rows) | `tested` | live DB records |
| 3.3 | Monthly carbon chart (real data) | `tested` | computed from transactions |
| 3.4 | Screenshot vs `design/dashboard.png` | `visually-verified` | MAE 14.08, 8.0% pixels differ |
| 3.5 | Mobile dashboard vs mobile reference | `visually-verified` | 853x1844, gauges side-by-side |
| 3.6 | Empty / loading / error states | `tested` | EmptyState, ErrorState, LoadingBlock, Skeleton |
| 3.7 | Trust score computed live via ML service | `tested` | 83/100, contributions reconcile |

## Milestone 4 — Remaining screens

| # | Screen | Reference | Status |
| --- | --- | --- | --- |
| 4.1 | Landing | `landing.png` | `visually-verified` | `not-started` |
| 4.2 | Login | `login.png` | `visually-verified` | `visually-verified` | built and tested; visual pass pending |
| 4.3 | Signup | `signup.png` | `visually-verified` | `not-started` |
| 4.4 | Onboarding | `onboarding.png` | `not-started` |
| 4.5 | Transfer | `transfer.png` | `visually-verified` | `not-started` |
| 4.6 | Transaction history | `transaction-history.png` | `visually-verified` | `not-started` |
| 4.7 | Bill payments | `bill-payments.png` | `visually-verified` | `not-started` |
| 4.8 | Trust score | `trust-score.png` | `visually-verified` | `not-started` |
| 4.9 | Loans | `loan-application.png` | `visually-verified` | `not-started` |
| 4.10 | Savings goals | `savings-goals.png` | `visually-verified` | `not-started` |
| 4.11 | Financial literacy | `financial-literacy.png` | `visually-verified` | `not-started` |
| 4.12 | Family accounts | `family-accounts.png` | `visually-verified` | `not-started` |
| 4.13 | Trust circles | `trust-circles.png` | `visually-verified` | `not-started` |
| 4.14 | Agent locator | `agent-locator.png` | `visually-verified` | `not-started` |
| 4.15 | Voice assistant | `voice-assistant.png` | `not-started` |
| 4.16 | Chatbot | `chatbot.png` | `not-started` |
| 4.17 | Sustainability dashboard | `sustainability-dashboard.png` | `visually-verified` | `not-started` |
| 4.18 | Carbon details | `carbon-details.png` | `visually-verified` | `not-started` |
| 4.19 | Green rewards | `green-rewards.png` | `visually-verified` | `not-started` |
| 4.20 | Carbon offsets | `carbon-offsets.png` | `not-started` |
| 4.21 | Leaderboard | `leaderboard.png` | `visually-verified` | `not-started` |
| 4.22 | Fraud alerts | `fraud-alerts.png` | `visually-verified` | `not-started` |
| 4.23 | Settings | `profile-settings.png` | `visually-verified` | `not-started` |

## Milestone 5 — ML and integrations

| # | Item | Status | Notes |
| --- | --- | --- | --- |
| 5.1 | Trust-score model (logistic regression) | `tested` | sklearn, synthetic data |
| 5.2 | Explainable contributions from real coefficients | `tested` | no invented explanations |
| 5.3 | Isolation Forest anomaly detection | `tested` | flags for review, never blocks |
| 5.4 | Anomaly review flow persisted | `tested` | confirm/dispute, one answer per alert | |
| 5.5 | Model evaluation (acc, P/R, ROC-AUC, flag rate) | `tested` | illustrative, labelled as such |
| 5.6 | Optional emissions API + static fallback | `implemented` | static path used; API key unset |
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
| 6.7 | Push to GitHub | `blocked-on-gh-auth` | 7 local commits ready |
| 6.8 | Visual QA harness | `tested` | `npm run qa:visual`, 21 routes compared |

## Explicitly out of scope or intentionally absent

- Real banking connections, real payments, real card or government ID capture.
- SMS/OTP delivery to a real phone: the demo OTP is documented in-app and in
  the README, and the UI never claims an SMS was sent.
- Autoencoder anomaly model (proposal marks it future work).
- Horizontal scalability, rate limiting, CSRF tokens beyond SameSite cookies:
  appropriate omissions for a local prototype, noted rather than silently dropped.