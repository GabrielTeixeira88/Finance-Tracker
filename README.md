# Finance Tracker

Current version: **0.5.0 - Investment Foundation**. Next planned: **v0.6.0 - Market Data & Portfolio Valuation** (not implemented). See [changelog](CHANGELOG.md) and [version roadmap](docs/ROADMAP.md).

A single-user, local-first, self-hosted personal finance application. All durable
financial data stays on your machine in **SQLite**. No cloud persistence, telemetry,
analytics, authentication, or external financial integrations are included.

Implemented: accounts, categories, income/expenses, atomic linked transfers, opening
balances, reconstructed account balances, and a historical overview. Investment accounts
now support activity-derived holdings and manual valuation. v0.1.0 adds an opt-in
18-month synthetic workspace. Performance, Net Worth, and Reports remain previews.
These remain visual scaffolding; v0.4.0 replaces the former Budget preview with real spending targets.
v0.2.0 adds normalized payees, transaction review, combined search/filters, stable
server pagination, and atomic bulk metadata updates. v0.2.0 adds deterministic metadata
rules, opt-in suggestions learned from explicit corrections, and informational schedules.
v0.3.0 adds local CSV/OFX imports with mapping profiles, review, duplicate decisions and
source history. Scheduled amounts do not affect balances until explicitly posted.
v0.4.0 adds monthly category targets, groups, overrides, signed optional rollover,
spending insights and explicitly linked refunds. Targets never allocate account cash.
v0.5.0 adds securities, BUY/SELL, dividends, interest, fees/taxes, weighted-average
cost, realized results, manual prices and confirmed brokerage CSV imports. See
[investment contracts and limitations](docs/INVESTMENTS.md). Market Data & Valuation is next.

## Run locally (no Docker or PostgreSQL required)

Prerequisites: Python 3.12+ (3.13 used for validation), uv, Node.js 22.13+ or 24+, npm.
From the repository root, optionally copy `.env.example` to `.env` to customize paths
or ports. Defaults work without an environment file. On PowerShell use
`Copy-Item .env.example .env`, and `npm.cmd` if script execution is restricted.

Terminal 1:

```sh
cd backend
uv sync --frozen
uv run alembic upgrade head
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Terminal 2:

```sh
cd frontend
npm ci
npm run dev
```

Open <http://127.0.0.1:5173>. Vite proxies `/api` to FastAPI. API documentation is at
<http://127.0.0.1:8000/docs>; readiness is `/api/health/ready`. If BACKEND_PORT changes,
also change the Uvicorn `--port` argument. Services must stay bound to loopback.

`DATABASE_PATH` defaults to `data/finance-tracker.db`, resolved relative to the
repository root regardless of the working directory. Absolute paths are supported
for user-selected local storage. No password or database service is required.
SQLite uses foreign keys, WAL, synchronous FULL, and a 5-second busy timeout.
Keep the database on a local disk, not a shared/network filesystem.

## Deterministic historical demo

Choose a **new, separate local file** using `DATABASE_PATH=data/finance-tracker-demo.db`
in the root `.env`, then from `backend/` run:

```sh
uv run alembic upgrade head
uv run python -m app.seed_investment_demo
```

Restart the API after changing the database path. To return to your original workspace,
restore its path; do not delete or overwrite either database. Existing SQLite databases
only need `alembic upgrade head`; no ledger reset is required.

The fixed fictional history covers April 2025 through September 2026, plus five
opening entries on March 31, 2025. The Phase 5 demo contains **506 ordinary ledger entries, 74 atomic transfers, six
accounts, 15 categories, five securities and 14 investment activities**. Salaries, rent, groceries, utilities,
card purchases/payments, savings and investment **cash** contributions all pass
through the normal domain services. All institutions and merchants are clearly fake.
IDs, timestamps, dates, amounts, and preview fixtures are deterministic. Fresh
seeds add five normalized payees and mixed review states without changing ledger amounts.
Merchant-like descriptions (including Uber variants) are fictional examples, not real purchases.

The investment seed extends the spending demo with two brokerage accounts, four dated
manual prices, a deliberately unpriced holding, gains/losses, a closed position,
income/charges and two brokerage imports proving exact-repeat safety. All activity
uses the actual APIs/domain services. Existing populated workspaces remain untouched.
The older `app.seed_spending_demo` remains available with its 502-entry dataset.

The spending demo also adds ten targets in three groups, an August override, signed
rollover examples, a partial card refund and an uncategorized expense. The older
`app.seed_demo` remains a 500-entry base fixture for compatibility.

The seed runs in one transaction, refuses a populated workspace, and becomes a no-op
once its version marker exists. Repeating it preserves subsequent user edits. It never
runs at application startup. `python -m app.seed` still adds example categories;
do not run it before the historical seed, which requires empty tables. The older
`app.seed --demo` is a small current-date smoke fixture, not the historical workspace.

Fresh demos also contain four rules, one pending suggestion supported by three synthetic
corrections, and six schedules with two confirmed existing transactions. The Scheduled
view uses the fixed September 30, 2026 demo calendar; ordinary workspaces use today's date.

The new seed marker is `phase2b-synthetic-v3`. Existing `phase16-synthetic-v1` and `phase2a-synthetic-v2`
workspaces remain untouched, including user edits. To inspect the refreshed demo,
choose a new separate database file; do not reset an existing one. Existing workspaces
gain the new tables through `uv run alembic upgrade head`. Legacy transaction metadata
is protected against automation until explicitly released in the transaction editor.

## Local CSV/OFX imports

After `uv sync --frozen` and `uv run alembic upgrade head`, open **Transactions → Imports**.
Choose a local statement and account, inspect CSV mappings, preview, resolve duplicates
and errors, then explicitly confirm. No upload posts automatically. Files stay local;
new imported entries default to Needs review. Exact repeats do not post again.
See [formats, profiles, identity rules and synthetic fixtures](docs/IMPORTS.md).

## Rules and schedules

In **Settings → Rules**, create a narrow condition and metadata actions. Lower priority
numbers win per field; explicit manual choices always win. Saving a rule affects future
ordinary entries. Use **Preview history**, inspect changes/skips, then explicitly apply
to existing entries. No rule can change amounts, accounts, dates, or transfer postings.
Suggestions require at least three consistent corrections on distinct transactions;
accept, edit, or dismiss them. Nothing is enabled without your action.

In **Transactions → Scheduled**, maintain expected events and inspect upcoming/overdue
occurrences. Match an existing eligible entry or explicitly post the actual amount/date.
Approximate amounts require actual-amount confirmation. Matching creates no movement;
posting does. Completed postings require unlinking before financial correction/deletion.
No background posting, scheduler worker, or automatic reconciliation is included.

Optional backend environment settings: `LEARNING_MIN_EXAMPLES` (default 3, minimum 3)
and `SCHEDULE_MATCH_DAYS` (default 3, maximum 14). See [automation contracts](docs/TRANSACTION_AUTOMATION.md).

Expected September 30, 2026 balances for the **older Phase 4 spending fixture**
(`app.seed_spending_demo`), before Phase 5 activity:

| Account | BRL balance |
| --- | ---: |
| Checking | 62,330.60 |
| Savings | 36,000.00 |
| Cash | 1,138.50 |
| Credit Card | -2,295.89 |
| Investment Account (cash only) | 19,500.00 |
| **Total** | **116,673.21** |

September income is **9,650.00**, expenses **5,753.48**, net cash flow **3,896.52**.
Credit-card payments and contributions are transfers, never expenses. Phase 5 changes
brokerage cash through activities and values securities separately; Overview remains
a cash-balance history, not total portfolio valuation.

The demo Overview initially ends at the fixed September 2026 date; a normal workspace
uses the local current date. Select 1M/3M/YTD/1Y/ALL or move the ending month to inspect
actual ledger history. User edits remain persisted, so a modified demo may naturally
differ from these reference values.

The mandatory automated scenario remains Checking **5,300**, Savings **2,500**,
income **1,000**, expenses **200**. Transfers and openings never enter flow totals.

## Navigation

- **Overview:** prominent total balance, ledger-derived daily closing chart, calendar
  period controls, cash flow, category spending, account balances, and recent activity.
- **Accounts:** calculated balances and administration; selecting an account opens its
  filtered ledger, or investment workspace for investment accounts. Deactivation preserves history.
- **Transactions:** dense ledger and filters; **+ Add Transaction** selects Expense,
  Income, or Transfer. Transfers still use one atomic backend operation. Search raw
  descriptions, merchants, or normalized payees; combine account/category/type/review,
  date and exact amount filters. Results use 50-entry pages and newest/oldest ordering.
  Edit a transaction to search/create/rename its payee and change review state. Renaming
  a payee updates its display everywhere without changing raw descriptions.
  Select rows on the current page to review or assign category/payee with confirmation.
  Transfer review updates both linked sides; transfers/openings cannot receive category
  or payee assignments. Review means user checking, not bank reconciliation.
- **Settings:** Categories and safe deletion rules; Rules with preview/application and
  user-approved learning suggestions. Transactions also contains the Scheduled subview.
- **Budget:** Spending & Budgets with Overview, Budgets and Insights tabs, shared month
  and currency controls, target/group editors, rollover, refunds and ledger drill-downs.
  See [budget semantics and refund policy](docs/BUDGETS.md).
- **Investments:** Overview, Holdings, Activity, Accounts and Imports; add securities,
  preview/confirm activities, inspect account/security positions and record manual prices.
  Cash and security value are separate; missing prices never become zero valuations.
- **Preview sections:** a fictional Performance illustration; Net Worth and Reports layouts
  reusing actual account history. No editing or final financial engines are provided.
  Fictional fixtures are available only in an explicitly seeded demo database.

The application sidebar starts collapsed at 70px and expands to 220px. It uses
Lucide icons; preview destinations retain accessible names and hover titles when
collapsed, and visible Preview labels when expanded. Overview defaults to 3M;
ending-month and currency controls are available through Overview options.
Dark mode is the default, light mode remains available, and a keyboard-accessible
mobile drawer replaces the sidebar below 1024px. Existing state navigation is retained;
URL deep links/back-forward routing remain deferred. All core assets run locally.

## Tests and checks

Backend, from `backend/`:

```sh
uv run pytest
uv run ruff check .
uv run ruff format --check .
uv run alembic check
```

Tests migrate a separate temporary SQLite file for each database test. No application
data, PostgreSQL server, credentials, or Docker are needed. Migration drift checking
uses the configured local database; apply `alembic upgrade head` first.

Frontend, from `frontend/`:

```sh
npm test
npm run lint
npm run format:check
npm run build
```

Apply formatters with `uv run ruff format .` and `npm run format`. Browser write tests
must use a separate temporary DATABASE_PATH and isolated local server ports.

## Optional Docker packaging

Docker is optional, not part of the native database requirement. Stop native servers
before reusing their ports, then run:

```sh
docker compose up --build -d --wait
docker compose ps
docker compose stop
```

Compose contains only backend and frontend. The backend applies migrations before
starting and mounts `./data` at `/app/data`; it uses the same default database file.
Compose uses `/app/data/finance-tracker.db` independently of the native `DATABASE_PATH`.
For a different file, explicitly override the backend's container path under `/app/data`;
native demo instructions above do not silently change the container's selected file.
Do not run native and container writers against the same file simultaneously.
Linux bind mounts must be writable by the container's `appuser`. No PostgreSQL
service or database volume is defined. Old stopped containers may appear as orphans;
do not delete their data as a routine fix.

## Storage transition and backups

This correction starts a new SQLite Alembic lineage (`sqlite_0001`). Original
PostgreSQL migrations are preserved byte-for-byte in `backend/migrations_legacy/`
and in the `pre-sqlite-refactor` Git checkpoint. `sqlite_0002` adds an isolated
preview-fixture table without changing existing financial history. `sqlite_0003` adds
payees and review metadata without rebuilding the ledger. `sqlite_0004` adds metadata
automation, correction evidence and informational schedules with protected completion
links. `sqlite_0005` adds import profiles, batches and source provenance without changing
existing postings. `sqlite_0006` adds versioned budgets, groups and guarded refund links
without rewriting financial records. `sqlite_0007` adds assets, immutable investment
activities, manual observations and typed source links without rewriting old tables.
Do not apply SQLite migrations to
an existing PostgreSQL database or stamp old databases to the new revision.

The local historical demo was created in a separate SQLite file. The previous small
SQLite demo remains untouched. Old PostgreSQL files and
the pre-transition local dump remain untouched and ignored. The earlier oversized
demo transfer and its compensating entry were deliberately not copied. This is not
a general PostgreSQL data importer; real data would require a separately reviewed
conversion with reconciliation before switching storage.

SQLite WAL/SHM files belong to the database. For a simple local backup, stop writers
and close the application before copying the database; otherwise use SQLite's
backup API. Never copy only the main file during an active write. Keep backups local
and out of Git. Do not reset or overwrite a populated database.

## Stack and engineering docs

React, TypeScript, Vite, Tailwind, shadcn/ui, TanStack Query, Zod, Recharts; Python,
FastAPI, Pydantic, SQLAlchemy, Alembic, SQLite; Pytest, Vitest, Ruff, ESLint, Prettier.
Dependency lockfiles remain checked in. PostgreSQL can be reintroduced later through
reviewed storage/migration changes; it is not a supported runtime in this phase.

Read [AGENTS.md](AGENTS.md), [architecture](docs/architecture.md),
[data model](docs/DATA_MODEL.md), and [UI conventions](docs/UI_FOUNDATION.md).
Never commit real financial records, databases, secrets, tokens, exports, or backups.
Only `data/.gitkeep` is tracked under data. The original LICENSE placeholder has
explicit exceptions for the adapted AGPL frontend and bundled OFL font; see
[third-party attribution](THIRD_PARTY_NOTICES.md).

Phase 1.7 establishes the approved application shell and Overview. See the
[UI screenshots](docs/visual/phase17/index.html) and
[validation report](docs/PHASE_1_7_VISUAL_REVIEW.md).
Phases 2A and 2B implement transaction intelligence and automation foundations. Phase 3
adds CSV/OFX imports with explicit preview/confirmation. See the
[product scope](docs/PRODUCT_SPEC.md) and [roadmap](docs/ROADMAP.md) for boundaries.


## Release metadata

`backend/app/_version.py` is authoritative. Hatch derives Python package metadata
from it and FastAPI reports it in OpenAPI. Frontend package metadata mirrors it,
checked by `test_release_version.py`; no About/version display exists to synchronize.
Run `uv lock --project backend` after Python metadata changes. Tags use `v0.5.0`;
future development branches do not change the released application version.
Historical phases and immutable seed/migration identifiers remain traceable in the roadmap.
