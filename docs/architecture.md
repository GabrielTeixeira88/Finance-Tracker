# Application architecture

## Local storage and deployment

React -> same-origin /api proxy -> FastAPI -> SQLAlchemy -> SQLite.
SQLite is the canonical local durable store because this is a single-user application
with low-frequency writers. Native Python and Node startup needs no Docker, database
server, credentials, or cloud service. Optional Compose packages only API and frontend.
Keep published/listening services on loopback; authentication is intentionally absent.

`DATABASE_PATH` defaults to `data/finance-tracker.db`, relative to the repository root.
Settings also accept an absolute user-selected path. Parent directories are created
by the engine factory. No user-specific path is checked into code.

## Connections and transactions

The shared SQLAlchemy engine factory configures every SQLite connection:

- `foreign_keys=ON`: foreign-key enforcement, including deferred transfer pointers.
- `journal_mode=WAL`: local readers can coexist with the writer.
- `synchronous=FULL`: durable commit synchronization.
- `busy_timeout=5000`: bounded waiting for a writer (configurable from 1 to 60000 ms).
- `recursive_triggers=ON`: history protection also applies to replacement deletes.

SQLAlchemy explicitly issues BEGIN, avoiding sqlite3 legacy transaction behavior for
DDL and SELECT. API writes reserve the writer with BEGIN IMMEDIATE before reading
accounts. This avoids deferred read-to-write snapshot upgrades. Read requests use
BEGIN. The request unit of work commits once before returning success and rolls back
all failures, including deferred foreign-key failures. Lock exhaustion returns a
sanitized 503 with Retry-After; the frontend never automatically retries a write.

One local application writer process is the intended deployment. Keep transactions
short. Future ingestion should serialize work or apply bounded retry/backoff to a
whole rolled-back unit of work. No queue, Redis, Celery, or automatic write replay is
implemented. WAL is not a network-filesystem or distributed-writer solution.

## Exact money and integrity

SQLite NUMERIC affinity may become binary floating point, and its INTEGER cannot
hold the previous full NUMERIC(24,6) range. ExactMoney therefore stores a zero-padded
24-digit TEXT representation of millionths and decodes to Python Decimal. Money
never enters SQLite REAL or JavaScript Number. SQL SUM is not used for money;
SQLAlchemy selects exact decoded amounts for Python aggregation. This preserves all
18 whole digits and six fractional digits accepted before the migration.

The storage adapter has an explicit PostgreSQL NUMERIC branch for future reuse,
but current checks/migrations are SQLite-specific. Returning to PostgreSQL requires
reviewed DDL and data conversion; it is not a configuration toggle today. Domain
services and API schemas continue to use Decimal, UUIDs, dates, and SQLAlchemy.

A transfer parent points to two preallocated transaction IDs through deferred foreign
keys. Both sides must exist at commit. Insert triggers verify their IDs, directions,
accounts, amounts, currencies, dates, and descriptions against the parent. Unique
constraints prevent extra sides. Reserved IDs cannot become ordinary transactions.
Immutable-history triggers reject changes/deletes of transfers and opening entries,
and physical deletion of ordinary transactions. See DATA_MODEL.md.

## Migration lineage and transition

New SQLite files run `sqlite_0001` and `sqlite_0002` through Alembic. It contains an explicit schema and
integrity triggers; application startup never invokes metadata.create_all(). The
optional container runs Alembic before Uvicorn. Native startup runs Alembic explicitly.
Old PostgreSQL revisions remain unchanged under migrations_legacy/postgresql and
are excluded from active Alembic discovery. The checkpoint tag preserves that runtime.
Downgrading the new ledger refuses destructive table removal.

The review database was freshly seeded with synthetic data. PostgreSQL was stopped,
not deleted; its bind directory and a local pre-transition dump remain ignored under
data. The old anomalous demo transfer is not imported. No real financial conversion
was attempted. Never use this demo transition as a procedure for real user data.

Tests use independent temporary SQLite files and real migrations, constraints, and
commits. Engine-restart persistence and lock-contention tests run without services.
Browser tests also use a separate database. The normal review demo stays unpolluted.

## Frontend and boundaries

TanStack Query fetches the local API; Zod validates transport and input. Money is
exchanged as exact strings. Only theme preference is stored in localStorage.
Functional navigation is Overview / Accounts / Transactions / Settings. Explicitly
labeled read-only preview sections expose future information architecture. Transfers are a
transaction creation mode; Categories are configuration under Settings.
[UI_FOUNDATION.md](UI_FOUNDATION.md) documents the Wealthfolio reference and hierarchy.

External integrations will eventually live behind adapters. No imports, Gmail,
provenance, budget engines, recurring entries, investment accounting, market data, auth,
cloud sync, or background workers are implemented. FastAPI telemetry remains off;
interactive API docs use the framework's default CDN assets. There are no remote
runtime assets in the financial UI.

References: [SQLite affinity](https://www.sqlite.org/datatype3.html),
[foreign keys](https://www.sqlite.org/foreignkeys.html),
[WAL](https://www.sqlite.org/wal.html),
[SQLAlchemy SQLite transactions](https://docs.sqlalchemy.org/en/20/dialects/sqlite.html).

## Phase 1.6 history and demo boundaries

`app.history` reads non-deleted ledger records through an inclusive ending date and
aggregates exact Decimal amounts with a 60-digit calculation context. Daily closing
points apply both transfer sides together. No SQL floating-point aggregation,
snapshots, external valuation, or historical chart fixtures enter Overview.
`GET /api/history?period=1Y&end=2026-09-30` returns currency-separated points, flows,
category spending, closing account balances, and eight recent entries. The existing
Phase 1 dashboard and account endpoints retain their original behavior.

The historical demo is an explicit `python -m app.seed_demo` operation against an
empty migrated file. A versioned `demo_fixtures` record and all 500 ledger entries
commit together under BEGIN IMMEDIATE. UUID5 identities and fixed timestamps make
fresh seeds reproducible. A repeated run with that marker is a no-op, even after
user edits; it does not restore or reset records.

`GET /api/demo` exposes only this optional synthetic fixture. Budget targets,
illustrative holdings/activity, and Performance chart points are stored as JSON
with decimal strings in that isolated table. They have no financial-model relationships,
write APIs, or influence on ledger totals. Net Worth and Reports previews instead
reuse the ledger-history API. Real workspaces show a demo-required empty state for
fictional investment/budget layouts.

Frontend charts normalize exact BigInt amounts to bounded dimensionless coordinates;
only these coordinates and timestamps become Number. Tooltip labels and accessible
chart tables retain original decimal strings. Period changes do not imply investment
returns. Query keys include period and end date; writes invalidate history as well as
accounts and transactions. The single-user history query scans ledger records in
memory; high-volume analytics and caching remain future work.

Reference roles: Wealthfolio for visual hierarchy, Actual Budget for future budgeting
workflows, Securo for future backend/ingestion adapter architecture. No external
reference application is a runtime dependency.
