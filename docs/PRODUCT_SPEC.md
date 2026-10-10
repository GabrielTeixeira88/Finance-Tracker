# Current product scope

Finance Tracker is a single-user, offline-capable local finance application. Financial
records stay in a local SQLite database. No authentication, cloud persistence, telemetry,
external financial integration, or worker queue is required.

Implemented: account administration, user categories, income/expense entries, auditable
opening balances, atomic same-currency transfers, exact ledger-derived balances,
historical Overview, and opt-in deterministic synthetic demonstrations.

Phase 2A adds normalized payees with conservative case/whitespace uniqueness, independent
raw descriptions, user review state, combined server-side filtering, predictable date
pagination, individual editing, and confirmed atomic bulk review/category/payee updates.
Metadata edits must not change monetary postings. Transfer review applies to both sides;
transfer/opening financial correction remains restricted. Review is not reconciliation.

Functional destinations remain Overview, Accounts, Transactions, and Settings. Categories
are configuration; transfers belong to Add Transaction. Budget, Investments, Performance,
Net Worth, and Reports remain read-only previews, not finished financial engines.

Future ingestion may follow raw source -> parsing/normalization -> payee identification
-> candidate -> rules -> review -> ledger. This pipeline is design context only.
Phase 2B implements metadata-only rules, user-approved learning suggestions and expected
schedules with explicit match/post operations. Settings contains Categories and Rules;
Transactions contains All Activity and Scheduled. See [automation contracts](TRANSACTION_AUTOMATION.md).
CSV/OFX/Gmail ingestion, provenance, reconciliation, real budgeting, investment accounting,
market data and cloud sync remain excluded. Future budgets are monthly category spending
targets independent of available cash; no envelopes or zero-based allocation.

See [data model](DATA_MODEL.md) for API and integrity contracts and
[roadmap](ROADMAP.md) for suggested next work.

## Phase 2A validation

- 53 backend tests and 45 frontend tests pass, preserving all prior financial tests.
- Ruff, ESLint, formatting checks, TypeScript, and the production frontend build pass.
- Clean SQLite migrations, populated Phase 1 upgrades, and Alembic drift checks pass.
- Isolated headless-browser checks exercised payee creation/rename, search, combined
  filters, pagination, individual/bulk review, category/payee assignment, and creation
  of income, expenses, and transfers. Metadata edits preserved balances and flow totals.
- The accounting scenario produced Checking 5,300, Savings 2,500, income 1,000, and
  expenses 200. SQLite data survived an API restart.
- Overview, Settings/Categories, and responsive navigation were checked at 1440,
  1920, 1280, and 390px. Browser artifacts and databases remain ignored under `.tmp`;
  the regular workspace database was not modified for validation.

Known limits: selection is current-page only; transfer/opening posting edits and payee
merging/deletion remain unavailable. Description/merchant search uses SQLite's ASCII
case-insensitive matching; normalized payee search supports Unicode casefolding.
Existing harmless Zod dependency annotation warnings remain in the production build.

## Phase 2B validation

- 83 backend tests and 49 frontend tests pass; all previous financial tests remain.
- Ruff, ESLint, Prettier, TypeScript and the production build pass. The existing Zod
  annotation warnings remain non-blocking.
- Clean migration and populated Phase 2A upgrade checks preserve exact postings,
  metadata and foreign-key integrity. Demo repeatability includes rules, suggestions,
  correction evidence, schedules and completion links.
- Isolated Edge checks exercised rule creation/editing, dry-run preview, explicit
  historical apply, disabling, suggestion acceptance, schedule creation, candidate
  confirmation and actual posting. Tests also cover dismissal, manual protections,
  conflicting evidence, month-end/leap recurrence, unique matches and rollback.
- The existing account/income/expense/transfer, search/filter, review/bulk and Overview
  browser checks pass. The required accounting scenario remains 5,300 / 2,500 with
  income 1,000 and expenses 200, excluding transfers.
- Rules and Scheduled layouts were checked at 1440, 1920, 1280 and 390px. Test databases,
  logs and screenshots stay ignored under `.tmp`; the normal workspace was not reset.

Current limits: learning deliberately requires consistent payee **and** category;
historical previews scan ordinary local history and display at most 50 examples;
occurrence ranges cover at most 367 days/5,000 events. No automatic schedule posting,
bank reconciliation, import adapters or budgeting engine is included.
