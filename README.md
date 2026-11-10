# Finance Tracker

[![CI (main)](https://github.com/GabrielTeixeira88/Finance-Tracker/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/GabrielTeixeira88/Finance-Tracker/actions/workflows/ci.yml?query=branch%3Amain)

Finance Tracker is a single-user, local-first personal finance and investment
application, also maintained as a software engineering portfolio project. React,
TypeScript and Vite connect to a FastAPI backend backed by local SQLite through
SQLAlchemy and Alembic. Core operation needs no cloud persistence or database server.

**Current development milestone: 0.14.0 - Frontend Integration and Stabilization.**
This milestone is finalized in source; no v0.14 GitHub Release, version tag or public
deployment is implied. Prior validation is recorded in [the audit](docs/AUDIT_V014.md).
The final licensing/merge pass intentionally did not rerun those suites.

The application includes an exact transaction ledger, accounts/categories/payees,
linked transfers/opening balances, reviewed CSV/OFX imports, optional Gmail and
read-only Pluggy ingestion, investment activities/holdings, historical valuations,
Brazilian CDB/CDI/RDB/Caixinha/Tesouro support, Net Worth, category budgets,
Life Events, Goals and portfolio analytics. The complete local demo combines
fictional household/securities with distinctly sourced historical fixed-income data.
Money remains Decimal/exact strings; balances and holdings derive from financial history.
External integrations are opt-in; data stored by Finance Tracker remains local.

The v0.14 frontend directly adapts licensed Wealthfolio components and interaction
patterns. It was not designed or implemented entirely from scratch. Finance Tracker's
Python/SQLite domain services, exact financial adapters, ingestion workflows and
Brazilian-product integration remain its engineering foundation. Finance Tracker
is not an official Wealthfolio product or endorsed by its authors. Wealthfolio is
a trademark of Teymz Inc. See [source attribution](THIRD_PARTY_NOTICES.md).

See [v0.14 finalization](docs/FINALIZATION_V014.md), [architecture](docs/architecture.md),
[implemented scope](docs/PRODUCT_SPEC.md), and the retained page-by-page migration
records linked from [the frontend workflow](docs/FRONTEND_V014_WORKFLOW.md).

## License

Owner-authored Finance Tracker code is **AGPL-3.0-only**. Read the complete
[LICENSE](LICENSE), [scope and modification notice](NOTICE.md), and
[third-party notices](THIRD_PARTY_NOTICES.md). Upstream AGPL/GPL/MIT software,
OFL fonts and separately licensed data retain their respective terms.

The source tree includes build/startup instructions, dependency locks and migrations.
[Source-access instructions](frontend/public/licenses/SOURCE_ACCESS.md) explain
obligations for exact-version compiled/network distributions. This license does
not require publishing your financial database, credentials or other private data.
The known development-only minimatch advisory remains present and is explicitly
accepted by the owner for this merge; see [the risk record](docs/DEPENDENCY_SECURITY_V014.md).

## Try the complete fictional demo

One demo contains household spending, budgets, seven goals, a house/car, official
CDI/Treasury-valued CDB/RDB/Tesouro holdings, simulated ETFs and a populated Income
dashboard with 135 fictional payments across ten sources. Navigate normally;
there are no separate scenario launch/switch buttons.

The local demo workspace remains separate from personal data. Official observations
and fictional security quotes retain distinct provenance. See [demo lifecycle](docs/DEMO.md),
[security generation](docs/ETF_SHOWCASE.md) and [chart interpolation](docs/CHART_PRESENTATION.md).

Prerequisites: Python 3.12+ (validated with 3.13), uv, Node 22.13+ or 24+, npm.
From the repository root:

```sh
cd frontend
npm ci
npm run build
cd ../backend
uv sync --frozen
uv run python -m app.demo
```

Open **http://127.0.0.1:8001**. Startup applies migrations, builds the fictional
baseline once, and resumes your demo edits on later launches. **Reset demo** restores
only the isolated demo after confirmation. Stop with Ctrl+C. To use personal data,
start the normal application below; there is no live database-switching toggle.
PowerShell users can use `npm.cmd` if script execution is restricted. If another
virtual environment is active, deactivate it before `uv sync` / `uv run`.

[Demo setup and safety](docs/DEMO.md) | [Five-minute walkthrough](docs/PORTFOLIO_WALKTHROUGH.md)
| [Hosting design and limitations](docs/DEMO_DEPLOYMENT.md)

The unified demo preserves existing historical household edits by extending a
validated backup on its first launch. Archived smaller demos remain untouched.
Official WRLD11/IVVB11 histories still require an authorized private export;
fictional SIM tickers never masquerade as those real securities.
See [historical sources and setup](docs/REAL_MARKET_DEMO.md).

## What you can explore

| Area               | Implemented behavior                                                                                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Transactions       | Accounts, openings, exact income/expenses, linked transfers, payees, review, search, pagination and atomic bulk metadata edits                                                                          |
| Automation         | Classification rules with manual-override protection, approved learning suggestions, expected schedules with explicit posting/matching                                                                  |
| Spending & budgets | Monthly category targets, overrides, signed rollover, comparisons and linked refunds                                                                                                                    |
| Ingestion          | Local CSV/OFX mapping, preview/confirmation, duplicate decisions and retained source evidence                                                                                                           |
| Reconciliation     | Identity-first matching, clearing, statements and audited source corrections                                                                                                                            |
| Investments        | Activity-derived holdings, weighted-average basis, dated prices/FX, TWR, XIRR, labeled benchmark comparisons and coverage                                                                               |
| Net worth & goals  | Ledger cash/holdings plus dated assets/debts; allocations of existing savings, without double-counting                                                                                                  |
| Demo               | One BRL household/investment replay: spending, budgets, seven goals, house/car, 12 fixed-income applications, simulated securities, 135 income payments and safe reset |

**Reports remains a labeled preview.** Gmail adapters exist, but live Google OAuth
and real bank templates remain unverified; the current portfolio demo does not seed
Gmail/import scenarios or access a real mailbox. External market requests are opt-in in normal
mode and disabled in the demo. No authentication, cloud sync or telemetry is included.

<details>
<summary>More real application screenshots - synthetic data only</summary>

![Transactions](docs/screenshots/v012/transactions.jpg)
![Spending and budgets](docs/screenshots/v012/spending.jpg)
![Investments](docs/screenshots/v012/investments.jpg)
![Performance](docs/screenshots/v012/performance.jpg)
![Reconciliation](docs/screenshots/v012/reconciliation.jpg)
![Net worth](docs/screenshots/v012/net-worth.jpg)
![Goals](docs/screenshots/v012/goals.jpg)

</details>

## Run your normal local workspace

Terminal 1, from the repository root:

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

Open http://127.0.0.1:5173. API docs: http://127.0.0.1:8000/docs.
Vite proxies `/api` locally. Optional `.env` settings come from `.env.example`.
`DATABASE_PATH` defaults to `data/finance-tracker.db`, relative to the repository root.
SQLite uses foreign keys, WAL, synchronous FULL and a five-second busy timeout.
Keep files on a local disk, bind to loopback, and never expose this unauthenticated
personal application publicly.

Normal startup never seeds or resets data. Existing databases require migrations,
not replacement. Legacy `app.seed_demo`, `app.seed_spending_demo`,
`app.seed_investment_demo`, `app.seed_market_demo`, `app.seed_analytics_demo` and
`app.seed_wealth_demo` remain available for their older empty-database fixtures;
prefer the isolated demo command for a cohesive showcase. Do not point legacy seeds
at personal data. PostgreSQL is not required or supported by the current runtime.

## Architecture and financial safeguards

```text
React / TanStack Query -> local FastAPI -> domain services -> SQLAlchemy -> SQLite
                                             ^
                         parsers -> review -> explicit confirmation
```

Money crosses the API as exact decimal strings. SQLite uses the exact storage
adapter rather than floating-point NUMERIC arithmetic. Ledger entries determine
cash; investment activities determine positions. Transfers and openings are excluded
from personal cash flow. Imports never post until confirmed. Goals never add assets.
Missing price/FX coverage stays unavailable rather than becoming zero.

Frontend: React, TypeScript, Vite, Tailwind, shadcn/ui, TanStack Query, Zod, Recharts.
Backend: Python, FastAPI, Pydantic, SQLAlchemy, Alembic, SQLite.
Validation: Pytest, Vitest, Playwright, Ruff, ESLint, Prettier, TypeScript.

[Architecture](docs/architecture.md) | [Data model](docs/DATA_MODEL.md) |
[Product scope](docs/PRODUCT_SPEC.md) | [UI conventions](docs/UI_FOUNDATION.md) |
[Engineering rules](AGENTS.md)

## Tests and checks

[CI configuration and troubleshooting](docs/CI.md) documents backend/frontend checks,
isolated Chromium demo tests and production dependency audits. CI runs on pull requests
to `main`, pushes to `main` / `feature/**`, and manual dispatch; it never deploys.

From `backend/`:

```sh
uv run pytest
uv run ruff check .
uv run ruff format --check .
```

Tests migrate isolated temporary databases, including fresh and populated migration
regressions. To check drift on your migrated local database: `uv run alembic check`.

From `frontend/`:

```sh
npm test
npm run lint
npm run format:check
npm run build
npm run test:demo
```

The build includes TypeScript checking. The demo browser runner requires Edge by
default; set `BROWSER_CHANNEL=chrome` for installed Chrome, or install Playwright
Chromium and set `BROWSER_CHANNEL=chromium`. It starts its own migrated temporary
workspace and refuses an occupied port 8001. If your saved demo is running, set
`DEMO_E2E_PORT=5174` for tests instead (PowerShell: `$env:DEMO_E2E_PORT="5174"`). It never resets the normal or saved
local demo. Add `-- --screenshots` to regenerate the documented synthetic screenshots.

## Storage, privacy and deployment

Databases/WAL/SHM, backups, financial files, credentials, dependencies and build
artifacts are ignored. Use SQLite's backup API for a live consistent copy; copying
only a database file while writers are active is unsafe. Never reset personal data.
Optional Docker packaging remains `docker compose up --build -d --wait` with
loopback-bound ports; it is not required for native operation or the demo.

**No public demo URL exists.** A shared writable server is not a substitute for
session isolation. See the [deployment decision](docs/DEMO_DEPLOYMENT.md).

## Roadmap and project status

v0.12 provides the isolated interactive showcase. v0.13 is Final Product Refinement, Stability, Security & Release Validation.
Its detailed scope will follow review of the populated demo: concrete UI/UX defects,
functional inconsistencies, backups, recovery, full financial audits, performance,
installation and any separately approved hosted-demo security. v1.0 requires
validated readiness; a milestone number alone does not make the application stable.

[Roadmap](docs/ROADMAP.md) | [Changelog](CHANGELOG.md) |
[Demo validation](docs/DEMO_READINESS.md) | [Current release audit](docs/RELEASE_0_12_0.md)

`backend/app/_version.py` is the canonical version, mirrored in frontend metadata.
Existing licenses and adapted-source notices remain in [LICENSE](LICENSE),
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and `frontend/public/licenses`.

The unreleased v0.14 Performance/Insights workspace now includes cash-flow-adjusted
risk summaries, exact cached-price comparisons, daily holding highlights and local
allocation-target planning. Targets never move money or suggest trades. Existing
Income, fixed-income and unified demo data remain authoritative.
See [source adaptation, supported scope and validation](docs/PERFORMANCE_INSIGHTS_V014.md).

The current unreleased dashboard migration is documented in
[Investments and Net Worth dashboards](docs/DASHBOARD_MIGRATION_V014.md).
Spending remains the initial dashboard tab; period selections carry between tabs
without persisting financial filters in browser storage.
