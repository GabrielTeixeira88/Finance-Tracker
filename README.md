# Finance Tracker

A local-first, self-hosted personal finance and investment management application.
Initially single-user, with persistent financial data kept on the user's machine
and PostgreSQL as the durable source of truth. No cloud persistence, telemetry,
or analytics are included.

**Phase 1** implements financial accounts, categories, income and expenses, linked
transfers, opening-balance history, and a basic dashboard. Balances are calculated
from financial records, never edited independently. Money uses exact decimals and
currency totals stay separate. See [DATA_MODEL.md](docs/DATA_MODEL.md) for conventions.
Imports, Gmail, budgets, recurring transactions, investments/holdings, market data,
authentication, Redis, and Celery remain intentionally absent.

**Phase 1.5** adds a persistent account sidebar, responsive navigation drawer,
light/dark themes, compact ledger views, account details, and a month-oriented
dashboard. See [UI foundation](docs/UI_FOUNDATION.md) for reusable conventions,
navigation behavior, and the investigation/correction of the local demo balances.

## Stack and layout

- `frontend/`: React, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query,
  Zod, Recharts; Vitest, Testing Library, ESLint, and Prettier.
- `backend/`: Python 3.13, FastAPI, Pydantic, SQLAlchemy, Psycopg, Alembic;
  Pytest and Ruff. Dependencies are locked with uv.
- `docker-compose.yml`: PostgreSQL 17, migrations, API, and Nginx serving the built UI.
- `docs/`: architecture decisions and engineering context.
- `data/`: ignored local storage; only `.gitkeep` is tracked.
- `AGENTS.md`: rules for future development and financial-data handling.

## Run with Docker (recommended)

Install Docker Engine with Compose v2, or Docker Desktop using Linux containers.
From the repository root, copy the example environment file:

```sh
cp .env.example .env
```

On Windows PowerShell, use `Copy-Item .env.example .env`. Edit the development-only
database password in `.env` before first startup. Keep `.env` out of Git. Then run:

```sh
docker compose up --build -d --wait
docker compose ps -a
```

- Frontend: <http://127.0.0.1:5173>
- API docs: <http://127.0.0.1:8000/docs>
- API liveness: <http://127.0.0.1:8000/api/health>
- Database readiness: <http://127.0.0.1:8000/api/health/ready>
- Frontend health: <http://127.0.0.1:5173/health.json>
- API through the frontend: <http://127.0.0.1:5173/api/health>

The page opens the dashboard, with navigation to accounts, transactions, transfers,
and categories. A new database starts empty. The `migrate` container exits with
code 0 on success; the three long-running services should be healthy. The API waits
for migration success before starting. Override published ports in `.env` if needed.

```sh
docker compose logs backend migrate
docker compose stop
docker compose down
```

Stopping or removing containers preserves `data/postgres/`. Do not delete that
directory: it contains the database. Changing PostgreSQL credentials in `.env` does
not change roles/passwords in an already initialized database; manage those through
PostgreSQL rather than deleting data. Backups and exports must remain local and
ignored. Ports bind to loopback; this unauthenticated application is not configured
for public hosting.

## Run development servers locally

Prerequisites: Python 3.13, [uv](https://docs.astral.sh/uv/getting-started/installation/),
Node.js 22.13+ (22 LTS or 24+), npm, and PostgreSQL (Compose can run just the database).
Create `.env` as above, then:

```sh
docker compose up -d --wait db
cd backend
uv sync --frozen
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

In a second terminal:

```sh
cd frontend
npm ci
npm run dev
```

Vite proxies `/api` to the local API, using `BACKEND_PORT` from the root `.env`.
If you change that port, also change the Uvicorn `--port` argument. Vite uses
`FRONTEND_PORT` from `.env`; PostgreSQL settings are loaded by the API and Alembic.
Stop the Compose frontend/backend before starting local servers on the same ports.
On PowerShell with script execution disabled, use `npm.cmd` in place of `npm`.

## Tests and quality checks

Backend (from `backend/`):

```sh
uv sync --frozen
uv run pytest
uv run ruff check .
uv run ruff format --check .
uv run alembic check
```

Frontend (from `frontend/`):

```sh
npm ci
npm test
npm run lint
npm run format:check
npm run build
```

Apply formatting with `uv run ruff format .` and `npm run format`, respectively.
Frontend tests need no database. Backend business-rule tests require local PostgreSQL
and the root `.env`: run `docker compose up -d --wait db` first. The test role needs
permission to create databases (the Compose development role has this). Tests create
a fresh randomly named `finance_tracker_test_*` database, apply all migrations,
exercise real constraints/commits, and drop only that generated database afterward.
They never reset the application's database. If an interrupted run leaves a test
database, inspect its name before any manual cleanup.

After starting Compose, verify the actual services and proxy:

```sh
curl --fail http://127.0.0.1:5173/health.json
curl --fail http://127.0.0.1:5173/api/health
curl --fail http://127.0.0.1:5173/api/health/ready
docker compose run --rm migrate alembic current
```

On Windows use `curl.exe`. The last response should report database status `ok`,
and Alembic should report `ee7da7580aa0 (head)`.

## Synthetic categories and demo

Nothing is seeded automatically. To add the example categories (safe to repeat):

```sh
docker compose exec backend python -m app.seed
```

To create a complete fake demo **only in an empty financial database**:

```sh
docker compose exec backend python -m app.seed --demo
```

The demo marks each institution as `SYNTHETIC DEMO`, creates Checking (5,000 BRL),
Savings (2,000 BRL), Cash (300 BRL), and Investment Account (zero), then adds 1,000
salary, 200 groceries, 35 Uber, and a 500 Checking-to-Savings transfer. Expected
balances: Checking **5,265**, Savings **2,500**, Cash **300**, Investment Account **0**;
monthly income **1,000**, expenses **235**, total account value **8,065 BRL**.
The demo uses the execution machine's current date and refuses to run if any accounts
or financial entries already exist. It does not wipe or replace data.
For native development, run `uv run python -m app.seed --demo` from `backend/`.

Use Accounts to create opening history; Transactions to enter income/expenses and
filter or correct ordinary entries; Transfers to post both sides atomically;
Categories to manage labels. Account deletion means deactivation. Ordinary transaction
deletion is soft deletion; transfers and openings are read-only in this phase.

The mandatory automated scenario omits the demo's Uber expense and Cash account:
its expected balances are Checking **5,300**, Savings **2,500**, income **1,000**,
expenses **200**. Transfers and openings contribute to balances, never to income/expenses.

## Privacy and contribution rules

Read [AGENTS.md](AGENTS.md) and [the architecture notes](docs/architecture.md) before
major changes. Never commit real financial records, credentials, OAuth tokens,
CSV/OFX exports, Gmail data, local database files, or backups. `.gitignore` covers
these and reserves explicit synthetic-fixture directories for clearly fake data.
Ignore rules are a guardrail, not a substitute for reviewing Git changes.

The project owner has not selected an open-source license. See [LICENSE](LICENSE).
