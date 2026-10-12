# v0.6.0 release validation - 2026-10-12

Market Data & Portfolio Valuation is validated. The initial branch was
`feature/v0.6.0-market-data` at `45323d7`, matching its remote and main. The 37
uncommitted paths were the intended v0.6 implementation; no unrelated edits were found.
GitHub reported main unprotected and no repository rulesets. No Actions workflows exist.

## Audit and corrections

- ORM-independent Brapi v2, Alpha Vantage and ECB adapters retain exact decimals,
  symbol/exchange/currency validation, source conventions, bounded requests/retries,
  persistent quota/cooldown and local idempotent caches. Adjusted history never values
  raw quantities; automatic/manual precedence preserves manual observations.
- Fixed incremental price coverage counting LATEST/ADJUSTED as raw-history coverage.
- Fixed FX backfill after inserting an older investment opening/activity.
- Added cancellation checks between batched quotes and annual FX chunks.
- Added uv cache inputs for the dynamic version file; otherwise an existing editable
  installation could retain 0.5.0 metadata after source version changed to 0.6.0.
- Historical quantity regression explicitly verifies January 10, March 20 and June 15
  units, with corresponding cash. Three-plus years of daily history use at most nine
  database statements. The 2,000 cash + 1,200 + 700 = 3,900 valuation test also passes.
- Exact USD/BRL, reverse, EUR/BRL and JPY/BRL use dated common observations; weekends
  carry prior observations for at most seven days. Missing/future/stale/adjusted values
  cannot invent complete historical totals. Unrealized results retain weighted-average
  basis; deposits remain changes in value, not investment returns.
- Offline API reads were exercised with provider transport forbidden. Partial outages,
  repeated synchronization, cache correction, interruption and persistence are tested.

## Validation

- Full backend: **226 passed**, including 33 market-data/transport/migration/release tests.
  Core 5,300 / 2,500 balances and 1,000 / 200 flows pass. Payees, review, rules,
  schedules, CSV/OFX provenance/idempotency, budgets/refunds and investment posting
  regression suites remain intact.
- Full frontend: **75 passed**. Ruff lint/format, ESLint, Prettier and TypeScript passed.
  Production Vite build passed; existing Zod annotation and >500 kB chunk warnings remain.
- Fresh `sqlite_0008` upgrade, synthetic seed and Alembic drift check passed. Populated
  v0.5 migration tests back up an isolated fixture and verify old financial tables,
  manual observations, integrity and foreign keys. The user database was not touched.
- Browser market/settings/security charts, range/account/currency controls and pricing
  modes passed at 1440x900, 1920x1080 and 390px. Existing funding, buys, partial sale,
  dividends/fees, manual prices and brokerage CSV preview/confirmation/reimport passed.
  Budget totals were unchanged by investment/price operations; no browser JS errors.
- Canonical version, frontend package/lock, FastAPI and installed backend report 0.6.0.
  `uv lock --offline` was regenerated with no dependency/lock-content change;
  frozen offline installation passed. New branches do not bump the released version.

## Privacy and release boundaries

The pre-staging scan checked 201 current project files and 365 reachable historical
blobs with no sensitive-path or high-confidence credential-pattern findings. Reviewed
financial fixtures/seeds are clearly synthetic. Generated databases/WAL/SHM, .env,
logs, dependencies, build output and browser artifacts remain ignored. Pattern scans
are supplemented by source review and cannot prove absence of every possible secret.

Public Brapi/ECB live checks were performed during implementation and their persisted
results inspected during this audit; no additional live calls were required for release.
International Alpha live coverage and Brapi Pro raw history remain unverified without
credentials/entitlement. Deterministic mocked contracts cover those paths. Free Alpha
history is limited to 100 observations and a conservative 25 requests/day locally.

Manual prices remain add-only, one per asset/date; editing/correcting an existing manual
observation is deliberately unavailable, not silently overwritten. Corporate actions,
exchange calendars, performance/benchmark engines and tax reporting remain deferred.
Opt-in refresh requires one running API worker; there is no external scheduler.

README, changelog, architecture, data model, product scope, UI and roadmap describe
v0.6.0 and retain the full future backlog/reference-first policy. v0.7.0 is preparation
only. Publication uses a normal feature push, validated no-ff main merge, normal main
push and annotated v0.6.0 tag; no GitHub Release page or historical tags are required.
