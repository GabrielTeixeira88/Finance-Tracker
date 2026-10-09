# Roadmap boundaries

Phase 1.6 delivers local SQLite persistence, Phase 1 ledger operations, a deterministic
18-month demo, read-only ledger history, and the application shell.
Budget, Investments, Performance, Net Worth, and Reports are explicitly preview layouts.

Phase 1.7 completes the approved application-shell and Overview visual checkpoint
with its desktop sidebar and ledger-backed dashboard. It preserves the Phase 1 financial
model and Phase 1.6 synthetic/history APIs. Validation and screenshots are documented
in PHASE_1_7_VISUAL_REVIEW.md. The `phase-2a` branch is ready for a separately scoped specification.

Next, define and approve a separately scoped development phase before adding features.
Budget workflows, ingestion, and investment accounting remain future candidates;
their ordering and acceptance criteria are not yet specified. Do not treat any preview
as a completed financial engine or start a new redesign as part of this checkpoint.

Later phases must separately specify budget editing, investment activities/holdings,
valuation and return calculations, reporting, imports, ingestion adapters, provenance,
reconciliation, and automation. Preview fixtures are not a starting production domain
model and must not silently become real financial records.

Core operation remains offline and
local. Authentication, cloud sync, Redis, Celery, market APIs, and AI are not part of
this foundation. PostgreSQL remains a future reviewed migration option if deployment
needs change, not a current runtime requirement.
