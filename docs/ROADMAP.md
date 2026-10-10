# Roadmap boundaries

Phase 1.6 delivers local SQLite persistence, Phase 1 ledger operations, a deterministic
18-month demo, read-only ledger history, and the application shell.
Budget, Investments, Performance, Net Worth, and Reports are explicitly preview layouts.

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

Future budgeting uses monthly category spending targets, independent of account cash;
not envelopes, zero-based allocation, or balance-constrained assignment. It remains
unimplemented.

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

Later phases must separately specify budget editing, investment activities/holdings,
valuation and return calculations, reporting, additional ingestion adapters,
reconciliation, and automation. Preview fixtures are not a starting production domain
model and must not silently become real financial records.

Core operation remains offline and
local. Authentication, cloud sync, Redis, Celery, market APIs, and AI are not part of
this foundation. PostgreSQL remains a future reviewed migration option if deployment
needs change, not a current runtime requirement.

## Next: Phase 4 — Spending & Budgets (planned, not implemented)

Spending & Budgets — Wealthfolio-style monthly category targets, spending progress,
category groups, monthly overrides, optional rollovers and spending insights.
The current Budget screen remains a read-only preview until this separately scoped
phase is implemented. Do not adopt Actual Budget's envelope budgeting or mandatory
allocation of available money. Targets are independent of account cash.

Gmail, automatic reconciliation and background posting remain later, separately scoped
work. Reuse [implemented import contracts and limitations](IMPORTS.md) without silently
expanding the ingestion pipeline during Spending & Budgets work.
