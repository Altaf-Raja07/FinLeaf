# Reference-aligned demo data targets

Every value here is a figure visible in an approved reference image in `design/`.
The seed in `db/seed.mjs` is tuned to produce these numbers through genuine
records, not by storing display values.

Rules that constrain this table:

1. **Derived values are never hardcoded.** Balances come from ledgers, emissions
   from `carbon_estimates`, points from `green_point_awards`, scores from the
   model. The seed only shapes the *inputs*.
2. **The model is not fitted to the picture.** The trust score is whatever the
   logistic regression produces from the seeded behaviour. Behaviour is adjusted
   to be a plausible "steady, not exceptional" user, which is a legitimate way to
   land near the reference. The coefficients, scaling, and reconciliation are
   untouched.
3. Where two references contradict each other, the table says so and names which
   one wins.

## Primary user (Ravi Kumar, +919876543210)

| Metric | Reference | Source of truth |
| --- | --- | --- |
| Total balance | 12,450.00 | sum(accounts.balance) |
| Accounts | 2 | count(accounts) |
| Wallet / savings split | not shown | wallet 9,950.00 + savings 2,500.00 |
| Trust score | 68, band "Steady" | ML service, **not forced** |
| Sustainability score | 54, band "Fair" | `getSustainabilityScore` |
| Month CO2e | 24.8 kg | sum(carbon_estimates, current month) |
| Green points balance | 1,240 | sum(awards) - sum(redemptions) |
| Green points redeemed | 460 | sum(reward_redemptions.points_spent) |
| Paperless sheets | 146 | derived from e-bill/e-recharge count |
| Next reward at | 1,500 | constant on the rewards screen |

### Recent four transactions (`dashboard.png`, `transaction-history.png`)

| Merchant | Category | When | Amount |
| --- | --- | --- | --- |
| Village Market | groceries | today | -840.00 |
| Bus pass recharge | travel | today | -250.00 |
| Salary credit | transfer | yesterday | +15,000.00 |
| Electricity bill | bills | 2 days ago | -1,180.00 |

### Monthly emissions trend (`dashboard.png`)

May 42, Jun 36, Jul 32, Aug 28, Sep 24 kg, current month highlighted.
Month-over-month "Down 12%".

### Current-month category split (`sustainability-dashboard.png`)

| Category | kg CO2e | Implied spend at the reference factor |
| --- | --- | --- |
| Fuel | 10.0 | 400.00 |
| Travel | 5.2 | 1,300.00 |
| Groceries | 4.1 | 820.00 |
| Dining | 2.8 | 560.00 |
| Electronics | 1.7 | 53.13 |
| Bills | 1.0 | 250.00 |
| **Total** | **24.8** | |

### Savings goals (`savings-goals.png`)

| Goal | Target | Saved | Progress | Weekly |
| --- | --- | --- | --- | --- |
| School fees for Meena | 10,000.00 | 6,800.00 | 68% | 260.00 |
| New bicycle | 3,000.00 | 1,020.00 | 34% | 100.00 |

### Loans (`loan-application.png`)

| Field | Value |
| --- | --- |
| Eligible maximum | 25,000.00 (derived from trust score) |
| Instalments | 6 monthly of 4,167.00 |
| Application 1 | 8,000.00, in review, applied 2 Oct |
| Application 2 | 5,000.00, repaid, settled 12 Aug |

### Family and circle (`family-accounts.png`, `trust-circles.png`)

| Metric | Value |
| --- | --- |
| Group balance | 31,200.00 |
| Members | 4 (Ravi owner, Sunita pay_bills, Meena view, Sharma view) |
| Circle members | 6 |
| Average circle trust | 61 |
| Endorsements received | 4 |
| Group savings | 18,400.00 |

### Other users (`leaderboard.png`)

| User | kg CO2e | Green points |
| --- | --- | --- |
| Meena Kumar | 18.2 | 1,980 |
| **Ravi Kumar (You)** | **24.8** | **1,240** |
| Sunita Devi | 26.1 | 1,410 |
| Anil Traders | 31.5 | 1,120 |
| Prakash Patil | 38.9 | 860 |
| Fatima Begum | 44.2 | 720 |
| Ravi Sharma | 52.7 | 540 |

Averages: Dharwad 33.4 kg, district 41.2 kg.

### Offsets (`carbon-offsets.png`)

| Metric | Value |
| --- | --- |
| Points spent on offsets | 18,400 |
| kg CO2e offset | 1,510 |
| Trees supported | 1,200 |

### Anomaly (`fraud-alerts.png`)

One flagged transaction: "Diesel transfer", fuel, 3 Oct 23:47, -8,500.00,
reasons: larger than usual **and** unusual hour. Plus a rapid burst of three
near-identical recharges at 02:47.

### Worked example (`carbon-details.png`)

The per-transaction table uses its own rows (Diesel 2,000.00 → 50.0 kg etc.).
These are illustrative arithmetic and are satisfied by the static factor table
rather than by seeded data, because they contradict the current-month category
split above — one 2,000-rupee diesel purchase alone is 50 kg, more than the
whole month's 24.8 kg fuel figure. Treated as a documentation example, so the
`carbon-details` screen derives its rows from real transactions while the
worked-example block comes from the factor table.

## Known contradictions between references

| Conflict | Resolution |
| --- | --- |
| `sustainability-dashboard` shows Fuel 10.0 kg this month, but `carbon-details` shows a single Diesel row of 50.0 kg | Category split wins for the dashboard; the details screen shows its own transaction rows plus a separate worked-example block |
| `transaction-history` shows 84 transactions, but a 5-month trend needs more history | The count is displayed from a real `COUNT(*)`; the reference's 84 is not forced |
| Reference shows trust 68, deductions would suggest 45 + 59 = 104 | The reference's own contribution figures do not sum to its score. Our contributions are forced to reconcile with our score instead, which is the behaviour the prompt requires |

## Behaviour profile for a legitimate score near 68

The score is `35 + sum(contributions)`, each contribution the fitted coefficient
times the user's value, capped at 14. To land near 68 the contributions should
total about 33, so the demo user is deliberately "steady, not exceptional":

| Feature | Seeded behaviour | Why |
| --- | --- | --- |
| Savings regularity | ~12 weekly contributions across 2 goals | Real habit, not maximal |
| On-time bills | ~75% paid on time | Mostly reliable, has slipped recently |
| Transaction consistency | ~5 transactions/week | Regular but not constant |
| Account age | ~17 months | Believable tenure |
| Family activity | 4-person household, moderate activity | Contributing, not dominant |

No coefficient or threshold is altered to reach a target. If the model returns
something other than 68, the model wins and the difference is recorded in
`artifacts/visual/report.json`.