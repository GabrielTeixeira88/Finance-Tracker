# Current product scope

Current release scope: **v0.6.0 - Market Data & Portfolio Valuation**. Next: **v0.7.0 - Investment Analytics**; see [market-data contracts](MARKET_DATA.md). Historical phase labels below describe prior implementation checkpoints; see [version mapping](ROADMAP.md).

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

Functional destinations are Overview, Accounts, Transactions, Budget, Investments, and Settings. Categories
are configuration; transfers belong to Add Transaction. Performance,
Net Worth, and Reports remain read-only previews, not finished financial engines.

Phase 3 implements raw source -> parsing/normalization -> payee identification
-> candidate -> rules -> review -> ledger for local CSV/OFX files.
Phase 2B implements metadata-only rules, user-approved learning suggestions and expected
schedules with explicit match/post operations. Settings contains Categories and Rules;
Transactions contains All Activity, Scheduled and Imports. See [automation contracts](TRANSACTION_AUTOMATION.md).
Phase 4 implements monthly category targets, groups, effective defaults, one-month
overrides, optional signed rollover, explicit refunds and ledger-backed spending insights.
Targets are independent of cash; no envelopes or zero-based allocation. Gmail, automatic
reconciliation, advanced investment performance and cloud sync remain excluded.
See [Spending & Budgets contracts](BUDGETS.md).

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
bank reconciliation was included in Phase 2B. Phase 3 adds the file adapters
described in [IMPORTS.md](IMPORTS.md).

## Phase 3 validation

- 129 backend tests and 53 frontend tests pass (46 backend and four frontend additions).
  Coverage includes parsers/locales, invalid fields, repeat imports, concurrent drafts,
  explicit cross-source links, unique claims, foreign keys, rollback, rule priority,
  manual overrides, schedule matching, preview UI, exclusions and confirmation errors.
- Final audit adds reordered/overlapping exports with and without reliable IDs,
  equivalent decimal spellings, CSV/OFX many-source provenance, the explicit Uber rule
  and description variants, and retrying the same batch after a rolled-back interruption.
  Duplicate comparisons now treat `5` and `5.00` as the same monetary value without
  automatically collapsing two legitimate purchases.
- Fresh migrations and a populated Phase 2B demo upgrade preserve all 500 ledger entries,
  accounts, transfers, payees, rules, schedules and completions. Alembic drift check passes.
- Ruff/ESLint, formatter checks, TypeScript and the production build pass. Existing
  non-blocking Zod dependency annotation warnings remain.
- Isolated Edge workflows exercised CSV mapping/preview/confirmation, exact re-import,
  OFX, explicit duplicate linking, rule suggestions, schedule matching, invalid-row
  exclusion, import history, imported review/editing and combined transaction filters.
  Saved CSV profiles were created, selected, restored and deleted; returning from preview
  preserved the draft without changing balances.
- Transfer creation through the existing UI confirmed Checking 5,300, Savings 2,500,
  income 1,000 and expenses 200. Imported metadata edits preserved balances. SQLite
  balances survived a real API restart. Overview and Accounts remained functional.
- Desktop checks used 1440×900 and 1920×1080; 390px checks verified containment and
  drawer navigation to Settings. Screenshots and browser scripts remain ignored in
  `.tmp`. The user's normal database was not migrated, seeded, reset or overwritten.

Before running this version against an existing workspace, run `uv sync --frozen` and
`uv run alembic upgrade head` from `backend/`. Import limitations and fixture settings
are documented in [IMPORTS.md](IMPORTS.md).

## Phase 4 validation

Spending & Budgets is completed and validated. The checkpoint passes 163
backend and 61 frontend tests, lint/format/type/build checks, fresh and populated
migrations, deterministic demo checks and isolated browser workflows. The original
financial regression is preserved. See [validation details and remaining limits](BUDGETS.md#validation-checkpoint--october-11-2026).

Phase 5 implements investment accounts, securities, exact activities, weighted-average
holdings, realized results, manual valuation and local brokerage CSV imports.
Investment cash is integrated into account balances; Overview is explicitly cash-only.
Performance remains illustrative. The v0.6.0 extension adds cached market data and valuation (see MARKET_DATA.md).
See [investment behavior and validation](INVESTMENTS.md).


## Phase 5 validation

190 backend tests and 71 frontend tests pass. Financial reconstruction, import
atomicity/repeats, migration preservation, deterministic seed and exact cash integration
are covered. Lint/format/type/build checks, live restart persistence, investment browser
acceptance and the existing budget/CSV/OFX workflows pass. See
[results and deliberately deferred limits](INVESTMENTS.md#validation-checkpoint---october-11-2026).

## v0.6.0: market data and portfolio valuation

Investments adds cached provider pricing, manual/automatic mode, editable symbol
mappings, security history and current/historical portfolio values. Original-currency
cash and holdings remain separate; reporting conversion uses dated exact FX.
Settings > Market Data reports credentials, capability limits, attempts/successes,
coverage and failures. Refresh is explicit or opt-in while the local API runs.
The historical chart uses historical quantities/cash and shows coverage gaps without
invented zeroes. It measures portfolio value, not investment return.
The synthetic market demo exercises multiple currencies, manual/missing/stale prices
and closed positions through persisted records. Real providers never become a
fallback to demo figures. See [coverage and limitations](MARKET_DATA.md).
