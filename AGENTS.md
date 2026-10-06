# Engineering rules

## Architecture
- Financial data stays on the user's local machine.
- PostgreSQL is the durable source of truth.
- Do not introduce cloud persistence, hosted databases, Firebase, or Supabase.
- External services must eventually be isolated behind adapters.
- Domain models must not depend directly on external provider schemas.
- Prefer simple, modular, testable architecture.
- This is initially a single-user, self-hosted application. Bind published services to loopback.

## Financial engineering
- Never use binary floating-point values for money. Use Python Decimal and PostgreSQL NUMERIC; exchange exact decimal strings with the frontend.
- Preserve original currencies.
- Transfers must not be counted as income or expenses.
- Investment activities will later be the source of truth for holdings.
- Imported data must retain source provenance.
- Avoid destructive changes to financial data. Use reviewed migrations; never reset a database or delete volumes as a routine fix.

## Privacy
- Never commit real financial data.
- Never commit secrets, OAuth tokens, API keys, or credentials.
- Do not add telemetry or analytics without explicit approval.
- Real CSV/OFX files, Gmail data, local database volumes, and backups must stay out of Git.
- Only clearly fake fixtures under `tests/fixtures/synthetic/` or `test/fixtures/synthetic/` may bypass financial-file ignore rules. Never put credentials there.
- Do not log financial payloads or credentials.

## Development
- Read `AGENTS.md` and `/docs` before major changes.
- Keep each task scoped to the requested phase.
- Add tests for business logic.
- Run tests and linting before considering a task complete. Report checks that could not run.
- Do not silently redesign the architecture.
- Keep dependency lockfiles updated with dependency changes.
- Use Alembic for schema changes; do not use `metadata.create_all()` at application startup.
- Phase 1 includes accounts, categories, income/expense transactions, linked transfers, opening balances, and a basic dashboard. Do not implement authentication, budgets, recurring transactions, imports, Gmail, Pluggy, investments/holdings, market-data APIs, or portfolio analytics.
- Do not add Redis or Celery until a later phase requires background processing.
- Do not commit or push unless explicitly requested.
