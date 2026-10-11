# Roadmap boundaries

Phase 1.6 delivers local SQLite persistence, Phase 1 ledger operations, a deterministic
18-month demo, read-only ledger history, and the application shell.
Investments, Performance, Net Worth, and Reports remain preview layouts. Phase 4 replaces Budget.

Phase 1.7 completes the approved application-shell and Overview visual checkpoint
with its desktop sidebar and ledger-backed dashboard. It preserves the Phase 1 financial
model and Phase 1.6 synthetic/history APIs. Validation and screenshots are documented
in PHASE_1_7_VISUAL_REVIEW.md.

Phase 2A implements normalized payees, review states, combined transaction search and
filters, stable pagination, and atomic bulk metadata updates. The application shell,
financial posting model, and preview boundaries remain unchanged.

Phase 2B is complete and validated: deterministic metadata rules, explicit preview/application,
conservative payee-learning suggestions, and informational recurring/one-time schedules.
Schedules require user-confirmed matching or explicit posting; no worker runs them.
Subsequent imports and Gmail ingestion should reuse payees/review through a separately specified candidate
pipeline, keeping bank reconciliation distinct from user review.

Phase 4 uses monthly category spending targets, independent of account cash;
not envelopes, zero-based allocation, or balance-constrained assignment.

## Phase 3 — Local CSV/OFX imports (completed and validated)

Bank CSV and OFX parsing, column mapping, import profiles, transaction previews,
validation, duplicate detection, import history and safe repeat imports. Reuse payee
normalization and Phase 2B rules without bypassing ledger integrity or review. Prepare
explicit boundaries for later Gmail reconciliation; do not implement Gmail in Phase 3.

## Product and workflow references

- Wealthfolio: primary overall product/UI reference.
- Actual Budget: schedules, payee learning and applicable transaction workflows.
- Securo: advanced rules, ingestion and reconciliation.

References guide design choices, not branding or wholesale source copying. The budgeting
decision remains monthly category spending targets, not envelopes or mandatory allocation
of available account balances.

Later phases must separately specify investment activities/holdings,
valuation and return calculations, reporting, additional ingestion adapters,
reconciliation, and automation. Preview fixtures are not a starting production domain
model and must not silently become real financial records.

Core operation remains offline and
local. Authentication, cloud sync, Redis, Celery, market APIs, and AI are not part of
this foundation. PostgreSQL remains a future reviewed migration option if deployment
needs change, not a current runtime requirement.

## Phase 4 - Spending & Budgets (completed and validated)

Monthly category targets, flat groups/order, historically stable effective defaults,
one-month overrides, copy previous targets, optional signed rollover, exact spending
reports, explicit purchase refunds and transaction drill-downs. See [BUDGETS.md](BUDGETS.md).
No envelopes, cash allocation, FX conversion, automatic refunds or schedule posting.

## Next: Phase 5 - Investment Foundation (not implemented)

Planned scope: investment accounts and security master records; BUY/SELL activities,
dividends, fees and taxes; holdings reconstructed from activities; average cost and
cost basis; realized/unrealized P&L where prices are available; portfolio aggregation;
brokerage CSV activity imports; holdings and asset-detail views; investment integrity
tests. Keep investment activities separate from ordinary expense postings.

Market-data APIs, historical pricing, FX feeds and advanced performance metrics remain
later work. Gmail, automatic reconciliation and background posting are separately scoped.
Preparing the Phase 5 branch does not implement or promote the current investment preview.
