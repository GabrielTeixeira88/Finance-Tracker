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
- Investment activities are the source of truth for holdings; reconstruct positions instead of storing editable balances.
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
- Functional navigation is Overview, Accounts, Transactions, Budget (Spending & Budgets), Investments, Performance, Settings. Transfers belong to Add Transaction; Categories belong to Settings. Performance opens investment analytics; Net Worth and Reports remain labeled read-only previews.
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
- Phase 1 includes accounts, categories, income/expense transactions, linked transfers, opening balances, and a basic dashboard. Phase 1.6 adds read-only ledger history and synthetic preview screens only. Do not implement authentication, advanced investment/reporting engines, Gmail, Pluggy, market-data APIs, or portfolio analytics without a separately requested phase.
- Do not add Redis or Celery until a later phase requires background processing.
- Do not commit or push unless explicitly requested.

- Phase 3 parsers must never post ledger entries. Keep raw provenance separate, enforce bounded local uploads, and confirm through the existing ledger service. Exact source identities are account/context scoped; weak content matches require explicit decisions. Preserve atomic confirmation and many-source-to-one-transaction links; never log imported payloads.

- Phase 4 targets are versioned by effective month with explicit one-month overrides. Reconstruct signed rollover from targets and exact ledger spending; never store spent values or create postings from targets. Disabling rollover resets its chain.
- Refunds require explicit same-currency purchase links, reduce spending on the credit date and do not count as income. Protect linked financial fields; unmatched credits remain income. Share classification across budget, dashboard and history.

- Phase 5 activities carry their sole cash posting; never create an ordinary transaction twin. Share cash reconstruction across balances/history, while excluding investment activity from consumption and personal income totals.
- Reconstruct weighted-average positions in stable date/sequence order with Decimal. Reject oversells, currency mismatches and unfunded activities. Corrections void and replace, retaining source identity and immutable history.
- Manual prices are dated observations, not live prices or historical performance. Keep missing valuations unavailable and currencies separate. Investment CSV previews never post; confirmation and identity claims are atomic.

- v0.6 market adapters must remain independent of ledger/ORM code. Network calls belong
  only to explicit/opt-in refresh, outside SQLite write transactions. Never log provider
  URLs, tokens or response payloads. Preserve manual observations and cached data on failure.
- Valuation uses eligible raw/manual prices with historical quantities and dated exact
  FX. Never mix adjusted prices with unadjusted quantities, future quotes, synthetic/live
  sources, or missing values with zero. History carries prior observations at most seven
  days. Corporate-action gaps and incomplete totals must stay visible. Portfolio value
  includes contributions and is not performance. Keep one API worker for market sync.


## Releases and versioning
- v0.7 analytics are read-only ledger projections. Use shared historical prices/FX and
  scope-aware linked flows; no independent balance or return cache is authoritative.
  Daily TWR uses documented end-of-day flows. XIRR is annualized actual/365;
  ambiguous roots and missing required data remain unavailable. Never substitute
  a price-only benchmark for a total-return index without an explicit label.
  Allocation includes cash; incomplete coverage must not inflate known weights.
  Fees already in basis/proceeds/net income must not be deducted a second time.
- Use MAJOR.MINOR.PATCH, with annotated Git tags vMAJOR.MINOR.PATCH. Before 1.0,
  new functionality normally increments MINOR and compatible fixes increment PATCH.
  1.0.0 requires validated stability, not a prescribed number of milestones.
- Canonical version: backend/app/_version.py. Hatch and FastAPI read it; mirror it
  in frontend/package.json and package-lock.json. Regenerate backend/uv.lock after
  metadata changes. The release-version test prevents drift. A future branch does
  not change the current released version.
- Use feature/v0.6.0-market-data-style future branch names; preserve old branch names.
  Update CHANGELOG.md for each release, using real release dates. Historical milestone
  groupings are not releases; Phase 2A and 2B both map to v0.2.0.
- Validate tests, financial invariants, lint/format/type/build, fresh/populated migrations,
  and staged privacy before release. Respect branch protection and stop on blockers.
- Preserve historical commits/hashes/messages and tags. No force pushes, history
  rewriting, fabricated historical tags, or moving published tags. Never publish
  local databases, financial data or secrets. Git publishing requires user authorization.

## Reference-first development
Before implementing functionality present in Wealthfolio, Actual Budget or Securo:
1. Inspect relevant accessible source, documentation and tests.
2. Identify behavior, data models, calculations and interactions.
3. Prefer proven patterns and existing application services over parallel reinvention.
4. Adapt algorithms to React/FastAPI/SQLite where appropriate.
5. Reuse source only under compatible licenses; preserve attribution and notices.
6. Explain meaningful deviations and verify financial behavior with tests.
7. For UI work, compare actual visual references where available, not descriptions alone.
