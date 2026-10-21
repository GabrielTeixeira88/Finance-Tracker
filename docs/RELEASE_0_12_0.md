# v0.12.0 release validation

Validation date: 2026-10-21. Interactive Demo & Portfolio Showcase.
Initial branch: `feature/v0.12.0-interactive-demo`; HEAD, upstream and main were
`975ecee` (v0.11.0). The pending source, tests, documentation and fictional screenshots
belonged to this milestone; no unrelated edits were identified. Fetch found no
divergence. GitHub reported main unprotected and no open pull requests.
Git refs identify the eventual feature/merge commits and annotated release tag.

## Audited functionality

The separate loopback-only app uses an owned SQLite workspace and the existing
financial APIs/services. Its fixed October 2024 through September 2026 household
contains 7 accounts, 772 ledger entries, 97 transfers, 14 categories, 5 payees,
3 rules, 6 schedules, 13 budget targets, 28 investment activities, 2,635 prices,
1,054 FX observations, 5 manual asset/debt positions and 5 goals. Values are fictional.

The persistent demo indicator, optional nine-stop onboarding, real editable forms,
sample CSV/OFX previews, simulated Gmail parser/review/approval and reconciliation
examples work through actual persistence. Charts use ledger/price/FX history, not
React fixture results. Reports remains a preview; Gmail simulation is not live OAuth.
No public demo, hosted session manager or live URL exists. Hosted isolation tests
are not applicable; deployment remains a documented, separately approved design.

## Isolation and reset

Tests create two separate temporary SQLite workspaces with distinct content. The
normal sentinel database is WAL-mode, checkpointed before its baseline byte/logical
snapshot. Demo initialization, API edits, successful/repeated resets and injected
reset failure leave that normal database byte-for-byte and logically unchanged.
Two fresh demo seeds match across all tables; repeated seeding and restart retain edits.

DemoStore validates ownership, identity, integrity and foreign keys. It rejects
unknown roots, overlaps, traversal, hardlinks and second-process ownership. Client
reset payloads cannot supply paths. Reset backs up the synthetic baseline into a
validated generation and publishes its pointer atomically. Writes serialize with reset;
stale tabs receive 409. Cleanup failure retains files instead of undoing publication.
Three additional sequential resets reproduce the baseline exactly.

Tests prohibit normal integration workers, Gmail services and normal-engine access.
Real Gmail and market mutations are denied in demo mode; no OAuth connection/token
is seeded. Imports affect only the active isolated generation, never the baseline.
The actual personal database and the saved demo running on port 8001 were not used
for destructive checks. Browser tests used a separate temporary root on port 5174.

## Automated release checks

| Check | Actual command / evidence | Result |
| --- | --- | --- |
| Backend | `.venv/Scripts/python.exe -m pytest -q` | 374 passed |
| Demo subset | Included in full suite | 12 passed |
| Frontend | `npm.cmd test` | 112 passed, 20 files |
| Python lint/format | `ruff check .`; `ruff format --check .` | Passed, 120 files |
| Frontend lint/format | `npm.cmd run lint`; `npm.cmd run format:check` | Passed |
| TypeScript/build | `npm.cmd run build` | Passed |
| Lock metadata | `uv lock --project backend --offline` | Resolved 50 packages; unchanged dependency set |
| npm audit | `npm.cmd audit --json` | Zero reported vulnerabilities |
| Browser | `DEMO_E2E_PORT=5174 npm run test:demo -- --screenshots` (PowerShell environment assignment) | Real Edge/API/SQLite walkthrough passed |
| Migrations | Fresh fixtures and populated v0.11 backup regression | Upgrade/check passed; all rows preserved |
| Privacy | Candidate paths/content, all historical paths, 611 historical blobs | No private artifacts/high-confidence secret signatures found |

v0.11 and v0.12 share migration head `sqlite_0013`; no schema change is required.
The populated migration test creates a synthetic prior-release schema/dataset,
copies it with SQLite backup, upgrades/checks the copy and compares every table.
The original and copy retain all records. Existing migration/integrity tests also pass.

The mandatory checking 5300 / savings 2500 / income 1000 / expense 200 regression
passes. All prior transfer atomicity, credit-card repayment, budget/refund, rule,
import/source identity, reconciliation, weighted-basis, cash/holdings, price/FX,
TWR/XIRR, property/debt and shared-goal-allocation tests remain intact.
Financial services and formulas were not changed for the demo release.

## Browser and visual evidence

Real Edge screenshots cover Overview, Accounts, Transactions, Spending, Investments,
Performance, Allocation, Net Worth, Goals and reconciliation at 1440x1000 and
1280x900, plus Overview at 1920x1080 and mobile navigation at 390x844.
The runner waits for API content and charts, checks unexpected API/browser errors,
checks page overflow at 1280px and exercises horizontal ledger scrolling.
See [screenshot gallery](../README.md) and `docs/screenshots/v012/`.

The walkthrough exercises range controls; exact expense/transfer balance changes;
transaction description editing without a monetary change; Gmail simulation and
explicit approval; OFX repeats and CSV link decisions/confirmation; rule previews;
budget target and goal edits; category creation; confirmed reset and mobile drawer
navigation. It starts its own migrated database and refuses occupied ports.

## Documentation, privacy and remaining limits

Canonical/backend/frontend version fields are 0.12.0. The changelog uses the actual
release-validation date. README contains supported browser launch/reset commands,
screenshots and limits; architecture, data model, product scope, roadmap, demo guide,
hosting design and walkthrough distinguish real functionality from simulations.
The environment example now points to the isolated demo command, not a database swap.
Dependencies, builds, data/demo-v012, databases/sidecars, backups, imports, credentials
and logs remain ignored. Only source, tests, documentation and synthetic images ship.

Known nonblocking warnings: the legacy seed's established-connection SQLAlchemy
warning (two tests), Zod annotation warnings and a roughly 550 kB frontend entry chunk.
Live Google OAuth/real-bank templates remain unverified; demo prices/FX are fictional,
the benchmark is a price-return proxy, and debt observations infer no amortization.
Dense tables scroll horizontally at smaller desktop/mobile widths. Validation was
Windows/Edge, not a cross-platform installation guarantee or independent usability study.

Next: **v0.13.0 - Final Product Refinement, Stability, Security & Release Validation**.
Its detailed scope follows review of the populated demo: concrete UX/functional defects,
financial regressions, isolation/security, backup/recovery, migrations, performance,
deployment/documentation and installation reliability. No v0.13 implementation or
version bump belongs to this release. v1.0 requires demonstrated readiness.
