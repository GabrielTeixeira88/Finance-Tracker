# v0.10.0 release audit ? 2026-10-19

Scope: Net Worth, Assets, Liabilities & Financial Goals. Canonical application
version and frontend metadata are 0.10.0. Backend `uv lock --offline` was rerun;
dynamic Hatch versioning leaves that lockfile unchanged. This is not a stable 1.0 claim.

## Implementation and financial acceptance

- Net worth uses exact ledger cash, historical investment holdings/prices and dated
  shared FX, plus dated manual assets minus liabilities. No editable aggregate balance.
- Mandatory 380,000 assets minus 160,000 debts equals 220,000; brokerage cash 3,000
  plus securities 7,000 equals 10,000; property 500,000 less mortgage 300,000 equals
  200,000. Card debt/overpayment signs, inactive accounts and transfer neutrality remain.
- Historical observation selection, correction rollback, disposal/payoff and missing
  observations are covered. Summary values match history on identical dates.
- BRL/USD/EUR/JPY scenarios verify historical FX direction, no future quotes and missing
  liability FX. Incomplete totals stay unavailable rather than hiding debt.
- Goals allocate existing cash or record manual progress without ledger postings.
  Shared 20,000 savings supports allocations 12,000 + 5,000, leaving 3,000 unallocated.
  Concurrent reservations, over-allocation, later cash shortfalls, currency mismatch,
  corrections, pause/resume/completion/archive and zero/overfunded targets are tested.
- Zero-return monthly projections: target 30,000 less saved 12,000 over twelve available
  month ends requires 1,500 per month. Zero contribution and missing deadlines remain
  unavailable when appropriate; no growth promise or investment return is inferred.
- Debt servicing uses the documented manual alternative: principal observations never
  post bank cash or spending. Interest/fees can be separate expenses. There is **no**
  integrated 1,500 payment / 1,000 principal / 500 interest-fees split; the application
  does not claim to execute or reconcile that combined payment. No loan engine added.

## Executed checks

- Full backend suite: **362 passed**. Includes earlier ledger, intelligence, imports,
  budgets, investments, pricing/FX, performance, Gmail and reconciliation regressions.
- Full frontend suite: **94 passed**. The six wealth tests include the strengthened
  initial-list/create/refetch regression, projection input and API-backed rendering.
- Ruff lint/format, ESLint, Prettier, TypeScript and production build passed.
- Fresh temporary migrations and populated v0.9 upgrades passed with Alembic drift,
  foreign-key and SQLite integrity checks. Every original table row is compared.
  The migration fixture includes synthetic Gmail configuration/run/message claims
  and candidates in addition to the analytics/ledger demo.
- Two retained populated v0.9 browser-database backups upgraded while preserving all
  38 existing tables (31 nonempty), including source links and reconciliation records.
  One older disposable development draft had pre-release schema drift and was excluded;
  it was not repaired, reset, or used to infer compatibility with released v0.9.
- Isolated Edge browser validation exercised property creation, two dated valuations,
  linked debt, exact net-worth changes, two goals sharing savings, projections, asset
  disposal without a fabricated deposit, structured loan metadata, chart selectors,
  visible over-allocation rejection and responsive navigation at 1440/1920/390px.
  Existing Accounts, Transactions, Budget, Investments and Performance received
  navigation smoke checks; automated financial tests cover their deeper behavior.
- Deterministic wealth seeding and repeat-run preservation passed. Generated data,
  screenshots, logs and browser tooling remain ignored under `.tmp`.
- Privacy/path/credential-pattern audit covers project files and reachable history;
  staged files are separately reviewed. No real data, credentials, databases or build
  artifacts are part of the release. A pattern audit is not exhaustive secret detection.

## Release correction and boundaries

Browser testing reproduced a race when Add goal was submitted before the initial
list arrived: the new row persisted but was hidden until navigation/reload. Creation
now waits for the initial list, and the regression checks immediate row visibility.
No global shell redesign or new financial accounting was introduced during the audit.

Remaining documented limits: manual loan servicing, fixed same-currency cash goals,
10-year reporting window, dated market/FX carry policy, no automatic asset pricing,
no authoritative cache or speculative return forecasts. Real-bank Gmail templates
and live Google authorization remain earlier, separately documented validation gaps.
Nonblocking warnings: inherited seed connection reuse, dependency annotation comments,
and a main frontend bundle above 500 kB.

GitHub has no configured CI workflows, open PRs or enforced main-branch rules at
inspection. Its default branch still names the old checkpoint; settings are unchanged.
Publishing must use ordinary pushes, an annotated v0.10.0 tag on validated main,
and a new v0.11 branch at that release commit. Preserve all old branches and tags.

Next: v0.11 consolidation/UI workflows; v0.12 isolated interactive demo/showcase;
v0.13 stability/security/release validation; v1.0 only with demonstrated readiness.
No next-phase implementation is included in this release.
