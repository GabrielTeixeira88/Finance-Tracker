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
- Functional navigation is Overview, Accounts, Transactions, Settings. Transfers belong to Add Transaction; Categories belong to Settings. Budget, Investments, Performance, Net Worth, and Reports are explicitly labeled read-only previews, not completed engines.
- Preserve the approved application hierarchy and restrained surfaces; do not copy third-party branding/assets or invent financial history.
- Preserve adapted-source attribution and AGPL/OFL notices in THIRD_PARTY_NOTICES.md and frontend/public/licenses.
- Keep product documentation focused on Finance Tracker. Third-party product names belong only in legal/source-attribution notices, not README, roadmap, design guidance, or promotional screenshots.
- Historical displays must derive from ledger entries. Keep currencies separate and exclude transfers/openings from cash flow. Never convert monetary values to JavaScript Number, even for charts; normalize dimensionless coordinates and retain exact labels.
- The opt-in Phase 1.6 demo is deterministic and synthetic. Seed only an empty database; repeated runs must preserve edits. Preview fixtures stay separate from the ledger and must never affect real balances. Do not reset data for screenshots or tests.
- Keep dependency lockfiles updated with dependency changes.
- Use Alembic for schema changes; do not use `metadata.create_all()` at application startup.
- Phase 1 includes accounts, categories, income/expense transactions, linked transfers, opening balances, and a basic dashboard. Phase 1.6 adds read-only ledger history and synthetic preview screens only. Do not implement authentication, full budget/investment/reporting engines, recurring transactions, imports, Gmail, Pluggy, real holdings, market-data APIs, or portfolio analytics.
- Do not add Redis or Celery until a later phase requires background processing.
- Do not commit or push unless explicitly requested.
