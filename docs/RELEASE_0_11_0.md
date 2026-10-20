# v0.11.0 release validation

Validation date: 2026-10-20. Product Consolidation & UI/UX Refinement.
The initial feature branch and local/remote main pointed to `823dd8a` (v0.10.0).
The pending implementation belonged to this milestone; no unrelated changes were
identified. GitHub reported main unprotected, no open pull requests and no existing
v0.11.0 tag. No repository Actions workflows are configured. Publishing is performed
only after these local checks; Git refs, rather than this document, identify the
eventual release commit.

## Scope and audit

See [issue-by-issue disposition](UX_AUDIT_v0.11.md#release-issue-disposition).
P0 misleading goal progress and P1 navigation, ledger filters, rules, payees,
ingestion discovery and reconciliation context are resolved in the tested scope.
Advanced rule capabilities, manual metadata protection, explicit schedule posting,
source identities and financial services remain intact. No production backend
behavior, API contract, schema or dependencies changed. Canonical Python and both
frontend package version fields are 0.11.0; `uv lock --project backend --offline`
resolved the unchanged dependency set successfully.

Documentation corrections remove stale claims that routes were in-memory only,
sidebar preferences were session-only, or Performance/Net Worth were previews.
Reports remains a read-only preview. Overview intentionally reports cash balance,
not consolidated net worth; the functional Net Worth destination is separate.
No investment/budget KPI was invented to fill the Overview.

## Automated checks

| Check | Command | Result |
| --- | --- | --- |
| Backend | `.venv/Scripts/python.exe -m pytest -q` in backend | 362 passed |
| Frontend | `npm.cmd test` in frontend | 104 passed / 19 files |
| Python lint | `backend/.venv/Scripts/ruff.exe check backend` | Passed |
| Python formatting | `backend/.venv/Scripts/ruff.exe format --check backend` | 113 files formatted |
| Frontend lint | `npm.cmd run lint` | Passed, zero warnings |
| Frontend formatting | `npm.cmd run format:check` | Passed |
| Types/build | `npm.cmd run build` | TypeScript and Vite passed |
| Migrations | Local isolated Alembic upgrade/check script | Fresh and populated v0.10 copy passed |
| Privacy | Local working-file and historical-blob scanner, diff review | No findings |

Migration checks used SQLite's backup API for a temporary populated copy, upgraded
to `sqlite_0013`, checked Alembic drift, integrity and foreign keys, and compared
every table's row count and content hash before/after. All records survived.
Foreign keys and WAL remained enabled. No user's database was reset or modified.

Financial suites cover the required 5300/2500 balances, income 1000/expense 200,
credit-card payment exclusion, the one-expense/two-source Gmail-to-OFX case,
weighted-average positions, cash/price/FX/returns, property less debt, brokerage
cash counted once and shared goal allocations that never add financial assets.
Money remains exact Decimal/storage strings/BigInt; no financial formulas changed.

## Browser and visual evidence

Local Playwright with headless Edge exercised real API controls against isolated
synthetic SQLite databases. Commands were `node .tmp/browser/<script>.cjs`:

- `v011-phase3`: CSV mapping/profile/preview/decisions/confirmation, OFX,
  duplicate prevention, source review and ledger navigation.
- `v011-budget`: account/expense/category/income/transfer, required balance
  scenario, card/refund, budget groups/targets/overrides/copy/rollover and drill-down.
- `v011-v090-release`: OFX match/link, evidence, clearing, statement completion,
  reopen, audit and repeat import with one expense.
- `v011-v070-financial-regression`: account funding, BUY/SELL, weighted basis,
  dividend/fee, nonposting previews, manual prices, holdings and brokerage imports.
- `v011-performance`: ALL/custom ranges, USD reporting and unavailable coverage.
- `v011-v0100-release`: property/history, linked mortgage, exact net worth,
  shared savings goals, allocation/projection and disposal without a cash deposit.
- `v011-workflows`: transaction-to-rule draft, preview/save, disabled duplicate,
  status filter, payee creation/rename/search and unchanged account balances.
- `v011-gmail`: mocked OAuth/vault, label mapping, backfill, candidate approval,
  budget effect, repeat sync, parser/reconnect errors and confirmed disconnect.
- `v011-release-visual`: 48 captures across 12 destinations at 1440/1280/768/390
  widths; bookmark/reload/filter/Back, page finder and mobile drawer checks.

All passed. No live Google OAuth, real mailbox or live quote-provider acceptance
is claimed. Automated unit/integration suites complement browser coverage for
advanced rules, manual override protection, bulk changes, schedules, matching
correction and error/empty states; not every permutation was replayed in a browser.

The recorded running reference screenshot and before/after implementation images
were inspected for shell geometry, Overview, accounts, transactions, spending,
investments, performance, net worth and goals. The established dark palette,
mono/tabular type, restrained surfaces, chart placement and dense rows remain.
Our ledger, explicit posting, coverage labels and exact values deliberately differ
from the reference. No third-party source/assets were newly copied.

Keyboard focus, labeled controls, native modal navigation, skip-to-content and
non-color financial signs are preserved. Responsive captures show no document
overflow; wide financial tables scroll within their regions. This is not formal
screen-reader/WCAG certification or a pixel-diff automated visual suite.

## Performance, privacy and remaining limits

The main JS chunk is 542.28 kB / 159.23 kB gzip versus the original
636.77 kB / 181.28 kB gzip. Existing Zod annotation and >500 kB chunk warnings
remain. Backend tests retain one synthetic-seed connection-options warning.
Some chart end labels and legacy inner-tab styling still merit polish.

Generated SQLite/WAL/SHM files, uploads, browser screenshots/logs, reference
checkouts, node_modules, environments and builds remain ignored. Synthetic seed
scripts and tests contain no real financial data. The history scan found no
credential/private-file patterns; it is an audit, not a guarantee against every
possible secret encoding. Attribution and license notices remain intact.

Unpersisted drafts/detail selections, flat ALL/ANY rules, the payee 50-match limit,
native confirmations and formal accessibility testing are documented boundaries.
There is no newly discovered release blocker. A maintained browser fixture runner
and isolated one-click demo remain future work, not production features.

## Next milestone

See [demo readiness](DEMO_READINESS.md) and [roadmap](ROADMAP.md): v0.12 is an
isolated, resettable 18–24-month fictional showcase using real APIs without external
credentials. v0.13 covers stability/security/recovery and v1.0 requires demonstrated
readiness. Creating the next branch does not implement it or change version 0.11.0.
