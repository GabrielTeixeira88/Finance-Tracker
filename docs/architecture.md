# Application architecture — Phase 1

For the Phase 1.5 sidebar, account navigation, themes, dashboard hierarchy, and
shared presentation conventions, see [UI foundation](UI_FOUNDATION.md). These
changes preserve the Phase 1 API, database schema, and accounting rules.

Finance Tracker is a single-user, local-first, self-hosted application. PostgreSQL
is the durable source of truth. Phase 1 adds accounts, categories, ledger entries,
atomic linked transfers, opening balances, and a basic dashboard. See
[DATA_MODEL.md](DATA_MODEL.md) for financial conventions and relationships.

## Request and storage flow

The browser loads React from the frontend. Relative `/api/*` requests are proxied
to FastAPI by Vite during development or Nginx in Compose. Both paths preserve the
same origin, so permissive CORS is unnecessary. No secrets belong in `VITE_*`
variables, browser storage, or frontend bundles.

FastAPI uses Pydantic settings loaded from the root `.env` or environment variables.
SQLAlchemy uses the synchronous Psycopg driver and a session per request; synchronous
database endpoints run in FastAPI's thread pool. Sessions close on exit and roll back
uncommitted work. The API unit-of-work dependency commits before returning a success
response and rolls back any failed operation, including deferred-constraint failures.
Services flush within that shared transaction and never commit individual transfer sides.
Passwords are represented as secret values and database URLs are built structurally
to support reserved characters safely.

PostgreSQL 17 stores files in the ignored `data/postgres/` bind mount on this machine
(through Docker Desktop's local VM on Windows/macOS). All published ports bind to
`127.0.0.1`. There is no authentication in this phase, so this configuration is for
trusted local access only. Do not expose it publicly.

## Schema lifecycle

Compose waits for PostgreSQL, runs the one-shot `migrate` service, then starts the
API and frontend. Revision `0001_foundation` establishes history; revision
`ee7da7580aa0` adds the Phase 1 tables, indexes, constraints, and transfer-integrity
triggers. Application startup never implicitly creates schema. Demo/category seeds
are separate opt-in commands. The Phase 1 downgrade refuses to drop populated tables.

For later model changes, import model metadata into the migration environment,
generate a revision, review the SQL and data-preservation implications, and apply it:

```sh
cd backend
uv run alembic revision --autogenerate -m "describe the change"
uv run alembic upgrade head
```

Do not rewrite applied migrations or use database resets as routine maintenance.
Dependency versions are recorded in `backend/uv.lock` and `frontend/package-lock.json`.
Container image tags pin major/runtime series; immutable digest pinning is a future
release-hardening decision.

## Health checks

| Endpoint | Meaning |
| --- | --- |
| Frontend `/health.json` | Static web server is serving the frontend build |
| API `/api/health` | API process responds with a validated service identity |
| API `/api/health/ready` | API can execute `SELECT 1` against PostgreSQL |

Readiness returns HTTP 503 without connection details when PostgreSQL is unavailable.
The UI reads the financial API with TanStack Query, validates responses and monetary
input using Zod, and invalidates queries after successful mutations. Monetary values
remain decimal strings in the browser; no financial data is persisted in browser
storage. Compose uses readiness for the backend health check. Frontend tests mock
transport; live smoke verification also goes through the frontend proxy to the real API.

## Boundaries for later phases

External providers will live behind adapters, with provider schemas mapped into
independent domain models. Preserve currency, decimal precision, and source
provenance; never count transfers as income or expenses. Investment activities will
eventually drive holdings. Domain models now exist; no provider integrations exist.
Transaction-source provenance, imports, reconciliation, and duplicate detection are
deliberately deferred. An INVESTMENT account currently holds only ordinary cash ledger
entries; its balance is not a portfolio valuation.

Recharts is installed for future UI work, but no charts or financial analytics are
implemented. FastAPI's native tracing, metrics, log instrumentation, and automatic
telemetry configuration are explicitly disabled. Its transitive OpenTelemetry API
dependency has no exporter configured. shadcn/ui is configured with a local Button component, Tailwind v4, and
the `@/` alias. The frontend loads no third-party runtime assets, analytics, or telemetry.
FastAPI's optional interactive API documentation uses its default CDN assets.
Dependency and image downloads require internet during setup; financial persistence
does not use external services.

The LICENSE is an explicit all-rights-reserved placeholder pending the owner's choice;
this setup does not assume permission to select an open-source license.

Configuration references: [Tailwind with Vite](https://tailwindcss.com/docs/installation/using-vite),
[shadcn/ui with Vite](https://ui.shadcn.com/docs/installation/vite), and
[SQLAlchemy's Psycopg dialect](https://docs.sqlalchemy.org/en/20/dialects/postgresql.html#module-sqlalchemy.dialects.postgresql.psycopg).
