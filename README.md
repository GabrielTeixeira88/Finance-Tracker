# Finance Tracker

A single-user, local-first, self-hosted personal finance application. All durable
financial data stays on your machine in **SQLite**. No cloud persistence, telemetry,
analytics, authentication, or external financial integrations are included.

Implemented: accounts, categories, income/expenses, atomic linked transfers, opening
balances, reconstructed account balances, and a historical overview. Investment accounts
contain ledger cash only. Phase 1.6 adds an opt-in 18-month synthetic workspace and
clearly labeled Budget, Investments, Performance, Net Worth, and Reports previews.
These are visual scaffolding, not budget, investment, valuation, or reporting engines.
Other Phase 2 functionality remains out of scope.

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
uv run python -m app.seed_demo
```

Restart the API after changing the database path. To return to your original workspace,
restore its path; do not delete or overwrite either database. Existing SQLite databases
only need `alembic upgrade head`; no ledger reset is required.

The fixed fictional history covers April 2025 through September 2026, plus five
opening entries on March 31, 2025. It contains **500 ledger entries, 72 atomic
transfers, five accounts, and 15 categories**. Salaries, rent, groceries, utilities,
card purchases/payments, savings and investment **cash** contributions all pass
through the normal domain services. All institutions and merchants are clearly fake.
IDs, timestamps, dates, amounts, and preview fixtures are deterministic.

The seed runs in one transaction, refuses a populated workspace, and becomes a no-op
once its version marker exists. Repeating it preserves subsequent user edits. It never
runs at application startup. `python -m app.seed` still adds example categories;
do not run it before the historical seed, which requires empty tables. The older
`app.seed --demo` is a small current-date smoke fixture, not the historical workspace.

Expected September 30, 2026 balances:

| Account | BRL balance |
| --- | ---: |
| Checking | 62,330.60 |
| Savings | 36,000.00 |
| Cash | 1,166.00 |
| Credit Card | -2,341.64 |
| Investment Account (cash only) | 19,500.00 |
| **Total** | **116,654.96** |

September income is **9,650.00**, expenses **5,771.73**, net cash flow **3,878.27**.
Credit-card payments and contributions are transfers, never expenses. Preview holdings
are separate illustrations and are not added to these balances.

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
  filtered ledger. Deactivation preserves history.
- **Transactions:** dense ledger and filters; **+ Add Transaction** selects Expense,
  Income, or Transfer. Transfers still use one atomic backend operation.
- **Settings:** Categories and safe deletion rules.
- **Preview sections:** Budget targets versus ledger spending; fictional investment
  allocation/activity and a Performance illustration; Net Worth and Reports layouts
  reusing actual account history. No editing or final financial engines are provided.
  Fictional fixtures are available only in an explicitly seeded demo database.

The Wealthfolio-based sidebar starts collapsed at 70px and expands to 220px. It uses
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
preview-fixture table without changing existing financial history. Do not apply SQLite migrations to
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

Phase 1.7 changes only the application shell and Overview for visual review against
the running Wealthfolio reference. See the [side-by-side captures](docs/visual/phase17/index.html)
at 1440×900 and 1920×1080 and the [comparison report](docs/PHASE_1_7_VISUAL_REVIEW.md).
Future page layouts and all backend/API/database behavior remain unchanged in this pass.
