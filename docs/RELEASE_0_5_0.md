# v0.5.0 release validation - 2026-10-11

Investment Foundation is implemented and validated. The initial worktree contained
37 intended investment files on feature/phase-5-investments at 25725ce. No unrelated
changes were identified. Main and the feature branch matched their remotes.

## Checks executed

From backend (using the existing .venv/Scripts executables):

- `python -m pytest --basetemp=../.tmp/v050-release-tests`: 193 passed.
- `ruff check .` and `ruff format --check .`: passed.
- `alembic upgrade head` and `alembic check` on a fresh temporary database: passed.
- The migration suite backs up a populated v0.4.0 fixture, upgrades the copy and
  compares all prior table snapshots, foreign keys and SQLite integrity: passed.
- `uv sync --project backend --frozen --offline`: installed package version 0.5.0.

From frontend:

- `npm test`: 71 passed.
- `npm run lint`, `npm run format:check`: passed (package formatting normalized).
- `npm run build` (TypeScript plus Vite): passed. Non-blocking Zod annotation and
  >500 kB bundle warnings remain.

Isolated Edge browser scripts exercised investment creation/funding, two buys,
partial sale, dividend/fee, account/security views, manual/missing prices, brokerage
preview/confirmation/reimport and mobile navigation. Existing budget and bank CSV/OFX
browser suites also passed. Databases, scripts/logs and screenshots stay ignored in .tmp.

## Financial evidence

- BUY 10 at 100 + BUY 10 at 120: quantity 20, basis 2,200, average 110.
  SELL 5 at 130: proceeds 650, basis released 550, realized 100,
  remaining quantity 15 and basis 1,650.
- Funding 10,000 and buying 7,000 leaves 3,000 cash and 7,000 basis. At a manual
  acquisition price, total value is 10,000, not 17,000. No ordinary expense/income.
- Core regression remains Checking 5,300 / Savings 2,500, income 1,000 / expense 200.
- Existing tests cover buy/sell charges, losses, full closure, same-day/backdated
  replay, invalid/short positions, corrections, rollback, idempotency, separate
  currencies, consolidation, price dates, provenance and genuine duplicate-looking rows.
- Payee/review/bulk, rules/manual protections, schedules, imports, targets/groups,
  overrides, signed rollover, refunds and spending regression suites pass unchanged.

## Privacy and boundaries

History scan examined 320 reachable blobs plus current tracked/untracked project files:
no sensitive path or high-confidence credential-pattern matches. Financial fixtures
are explicitly synthetic. Local databases/WAL/SHM, .env, dependencies, build output
and temporary files are ignored. Pattern scanning is not a guarantee against every
possible secret; source/fixture review is also required before staging.

Canonical version is backend/app/_version.py; Hatch and FastAPI consume it. Frontend
metadata mirrors it and a regression test checks consistency. The changelog records
v0.5.0 with the actual date; v0.1.0-v0.4.0 are undated historical groupings. The roadmap
preserves the complete mapping/backlog. No old commit, migration ID or seed ID is renamed.

Only manual price observations are supported. Missing values stay unavailable;
Overview is cash-only. Price correction, FX, corporate actions, market providers,
TWR/IRR, benchmarks and advanced tax calculations are not part of this release.
No v0.6.0 feature implementation is included. Release publication requires the
validated merge, normal pushes and an annotated tag; no GitHub Release page is required.
