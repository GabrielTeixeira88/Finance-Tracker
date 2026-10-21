# v0.12 demo validation and readiness

Validated locally on **2026-10-21**, Windows, Python 3.13, Node 22 and headless Edge.
The v0.12.0 implementation passed the local release audit. No public deployment
was performed. See [release evidence](RELEASE_0_12_0.md); Git refs identify publishing status.

## Results

| Check | Result |
|---|---|
| Full backend suite | 374 passed, 146.92 seconds |
| Demo integration subset | 12 passed |
| Full frontend suite | 112 passed in 20 files |
| Final reconciliation/demo UI subset | 11 passed in 2 files |
| Ruff lint / format | Passed; 120 Python files formatted |
| ESLint / Prettier | Passed |
| TypeScript / production build | Passed (`npm run build`) |
| Isolated browser walkthrough | Passed, real API and migrated SQLite |
| Fresh/populated migrations | Passed in the backend suite; no new migration needed |
| npm audit after compatible Vite update | 0 vulnerabilities reported |
| Git whitespace check | Passed |

The legacy wealth seed emits an existing SQLAlchemy warning (two occurrences in the release suite) about already-established
connection execution options. Build output retains existing Zod annotation and large
entry-chunk warnings (about 550 kB uncompressed); neither is hidden or a test failure.
Vite was updated from 7.3.6 to 7.3.7 for reported development-server advisories.

## Isolation, reset and determinism evidence

- Two newly migrated demo databases compare equal across every table, including IDs,
  timestamps, audits and sources. Existing seed runs are no-ops and preserve edits.
- Restarting the store preserves edits. Reset restores the baseline; injected
  pre-publication validation failure preserves the previous pointer and edited database.
- Concurrent writer/reset calls serialize; stale-generation writes are rejected.
  Normal app dependency overrides remain unchanged and its reset route is absent.
- A separate WAL-mode SQLite database with distinct synthetic sentinel records
  remains byte-for-byte and logically unchanged after checkpointing. Nonempty/unowned roots,
  traversal, hardlinks, overlapping normal paths and a second process are rejected.
- Real Gmail/market entry points and hostile origins/hosts are denied. Tests fail if
  normal integration workers, the Gmail service or its normal engine are invoked.
  No GmailConnection or token is seeded. Local data, WAL/SHM, build output and test
  artifacts remain ignored. Only generated fictional screenshots are added to docs.
- Normal-mode regression tests use isolated SQLite fixtures. The user's personal
  database was not opened, seeded or used for browser writes.

## Financial evidence

All prior ledger, automation, ingestion, budget/refund, investment, analytics,
reconciliation and wealth regressions remain. The mandatory Checking 5300 / Savings
2500 / income 1000 / expenses 200 scenario passes, as do transfer rollback and exact
precision checks. Demo assertions cover account-balance reconstruction, nonnegative
funded cash, 28 valid investment activities, complete TWR/XIRR coverage, actual net-worth
queries, an 85 BRL purchase with two sources and only one ledger posting, and a simulated
notification that posts once only after confirmation. Download/sample preparation never
changes ledger rows. SQLite FK/integrity checks pass.

## Browser evidence and screenshots

`frontend/scripts/demo-e2e.mjs` starts its own ignored temporary demo database and
refuses an occupied port 8001. It exercises:

- Overview/date ranges/chart; Accounts; Transactions/search; Spending/Budgets;
  Investments; Performance with DEMOBENCH; Allocation; Net Worth; Goals; completed reconciliation.
- Expense creation and description editing with exact unchanged-balance assertions; linked transfer creation
  with an exact savings-balance assertion.
- Gmail Notification Simulation, review and approval; OFX duplicate preview;
  CSV explicit linking of existing and ambiguous rows, followed by confirmation.
- Rule history preview, budget target edit, goal edit and category creation.
- Confirmed reset, removal of test edits, cache/form reset and responsive drawer routing.
- No browser exceptions or unexpected failing API responses during the passing run.

Actual screenshots cover ten desktop views at both 1440x1000 and 1280x900,
Overview at 1920x1080, and mobile ledger/navigation at 390x844. Files live in
`docs/screenshots/v012/`; they show only the synthetic baseline. Screenshots were
visually inspected for loaded content, financial values, readable controls and
responsive behavior. The statement capture opens the real completed Cash statement.
The existing application shell, typography and theme were retained.

## Measurements

These are single local measurements, not benchmarks or hosted capacity guarantees.

| Operation | Measured |
|---|---:|
| Empty demo migration + seed + initial backup (direct store) | 1.314 s |
| Full demo process ready (browser runner) | 2.293 s |
| Existing demo store resume | 0.026 s |
| SQLite database file | 2,506,752 bytes (~2.5 MB) |
| Backend generation reset | 0.048 s |
| Browser reset through remount | 0.115 s |
| Warm Overview / Transactions navigation | 0.030 / 0.087 s |
| Spending / Investments navigation | 0.335 / 0.413 s |
| Performance / Net Worth navigation | 1.013 / 1.140 s |

Warm navigation uses cached modules/queries where available. It is not cold-install
latency. Root storage also includes baseline, previous generation and SQLite sidecars.
The expanded screenshot gallery contains only fictional application captures. Financial amounts are never converted to
floating point; timing measurements are not monetary data.

## Limits and next gate

There is no hosted public session implementation, URL or isolation claim. Deployment
requires the separate design/security acceptance in [DEMO_DEPLOYMENT.md](DEMO_DEPLOYMENT.md).
Real Gmail OAuth and bank templates remain unverified. Prices/FX and the benchmark are
fictional; the benchmark is a price proxy. Mortgage/loan observations do not infer
amortization. Reports remains a preview. One local user/process owns a demo root.
Do not generalize Windows validation into a cross-platform installation guarantee.

No known blocking local-demo failure remains in the executed checks. v0.13 scope
will follow review of the populated demo and concrete issues; candidates include crash/disk-full and backup
recovery testing, cross-platform installation, sustained performance/security audits,
and public-session tests only if hosting is explicitly approved. v1.0 requires demonstrated
financial and privacy readiness. See [walkthrough and reviewer friction](PORTFOLIO_WALKTHROUGH.md).
