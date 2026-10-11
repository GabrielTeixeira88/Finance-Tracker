# Engineering rules

## Architecture
- Financial data stays on the user's local machine.
- SQLite is the canonical durable database, stored locally. Core operation must not require Docker or a database server.
- Do not introduce cloud persistence, hosted databases, Firebase, or Supabase.
- External services must eventually be isolated behind adapters.
- Domain models must not depend directly on external provider schemas.
- Prefer simple, modular, testable architecture.
- This is initially a single-user, self-hosted application. Bind published services to loopback.

## Financial engineering
- Never use binary floating-point values for money. Use Python Decimal and the exact SQLAlchemy money storage adapter; SQLite NUMERIC/REAL and SQL SUM must not be used for money. Exchange exact decimal strings with the frontend.
- Preserve original currencies.
- Transfers must not be counted as income or expenses.
- Investment activities will later be the source of truth for holdings.
- Imported data must retain source provenance.
- Avoid destructive changes to financial data. Use reviewed migrations; never reset a database or delete volumes as a routine fix.

## Privacy
- Never commit real financial data.
- Never commit secrets, OAuth tokens, API keys, or credentials.
- Do not add telemetry or analytics without explicit approval.
- Real CSV/OFX files, Gmail data, SQLite databases/WAL/SHM files, legacy database volumes, and backups must stay out of Git.
- Only clearly fake fixtures under `tests/fixtures/synthetic/` or `test/fixtures/synthetic/` may bypass financial-file ignore rules. Never put credentials there.
- Do not log financial payloads or credentials.

## Development
- Read `AGENTS.md` and `/docs` before major changes.
- Keep each task scoped to the requested phase.
- Add tests for business logic.
- Run tests and linting before considering a task complete. Report checks that could not run.
- Do not silently redesign the architecture.
- Keep SQLAlchemy and Alembic. Preserve foreign keys, WAL, bounded lock waits, and atomic linked transfers.
- Functional navigation is Overview, Accounts, Transactions, Budget (Spending & Budgets), Settings. Transfers belong to Add Transaction; Categories belong to Settings. Investments, Performance, Net Worth, and Reports are explicitly labeled read-only previews, not completed engines.
- Preserve the approved application hierarchy and restrained surfaces; do not copy third-party branding/assets or invent financial history.
- Preserve adapted-source attribution and AGPL/OFL notices in THIRD_PARTY_NOTICES.md and frontend/public/licenses.
- Keep product documentation focused on Finance Tracker. The roadmap may name the explicitly approved product/workflow references; preserve legal/source-attribution notices and do not copy third-party branding or assets.
- Historical displays must derive from ledger entries. Keep currencies separate and exclude transfers/openings from cash flow. Never convert monetary values to JavaScript Number, even for charts; normalize dimensionless coordinates and retain exact labels.
- The opt-in Phase 1.6 demo is deterministic and synthetic. Seed only an empty database; repeated runs must preserve edits. Preview fixtures stay separate from the ledger and must never affect real balances. Do not reset data for screenshots or tests.
- Keep dependency lockfiles updated with dependency changes.
- Use Alembic for schema changes; do not use `metadata.create_all()` at application startup.
- Phase 2A normalizes payee names by Unicode casefold and collapsed whitespace; never infer payees from arbitrary descriptions or erase raw descriptions when assigning a payee.
- Keep metadata updates separate from financial posting. Review is not bank clearing/reconciliation. Transfer review updates both sides atomically; category/payee assignments apply only to income/expense. Bulk updates must be all-or-nothing and cannot mutate money.
- Preserve the additive transaction-list API and exact amount filtering. Selection is explicit and page-scoped; do not silently apply a bulk action to all matching history.
- Phase 2B rules may mutate only classification metadata. Explicit manual choices outrank rules; protect unknown legacy origins. Learning uses distinct explicit corrections, never automation outputs; suggestions require user approval.
- Schedules are expectations, not ledger movements. Posting and candidate matching require explicit user actions; retain unique completion links and financial-edit guards. Do not add automatic schedule posting.
- Budgeting uses monthly category spending targets independent of available cash; do not introduce envelope or zero-based allocation.
- Phase 1 includes accounts, categories, income/expense transactions, linked transfers, opening balances, and a basic dashboard. Phase 1.6 adds read-only ledger history and synthetic preview screens only. Do not implement authentication, full investment/reporting engines, Gmail, Pluggy, real holdings, market-data APIs, or portfolio analytics without a separately requested phase.
- Do not add Redis or Celery until a later phase requires background processing.
- Do not commit or push unless explicitly requested.

- Phase 3 parsers must never post ledger entries. Keep raw provenance separate, enforce bounded local uploads, and confirm through the existing ledger service. Exact source identities are account/context scoped; weak content matches require explicit decisions. Preserve atomic confirmation and many-source-to-one-transaction links; never log imported payloads.

- Phase 4 targets are versioned by effective month with explicit one-month overrides. Reconstruct signed rollover from targets and exact ledger spending; never store spent values or create postings from targets. Disabling rollover resets its chain.
- Refunds require explicit same-currency purchase links, reduce spending on the credit date and do not count as income. Protect linked financial fields; unmatched credits remain income. Share classification across budget, dashboard and history.
