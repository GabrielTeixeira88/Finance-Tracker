# Performance and Portfolio Insights — v0.14 migration

Status: approved implementation and financial/browser validation completed.
Unreleased work on `feature/v0.14.0-frontend-refinement`; version remains 0.13.0.
No Git publishing, merge, tag or release was performed.

## Pinned source and initial comparison

Upstream `92b4647f74ec51fbbb1a772db4f42ea91060c518`, verified in the existing
`.tmp/reference-v014` checkout. Inspected actual Performance page, desktop/mobile
charts, chart colors/series/selection/query hooks, metrics and attribution sheets;
Insights overview/dashboard/layout, explorer/highlights/derivations/target rails;
composition/drillable charts; Income page/history; allocation overview/target editor/
worksheet and drift hook plus their imported model/control dependencies.

The official [Performance feature page](https://wealthfolio.app/features/performance-dashboard/)
was accessible. Insights and Targets feature requests failed through the web tool;
existing cached official pages/images and the pinned checkout remain available.
Public screenshots may predate the pin; do not claim a running same-revision
reference. The previously approved cached-reference fallback remains in effect.

| Source area | Current Finance Tracker | Migration boundary |
| --- | --- | --- |
| Performance page / strip / sheets | `pages/investment-analytics.tsx` | Actual source hierarchy; preserve existing TWR/XIRR/gain/flow semantics and coverage |
| Desktop/mobile performance charts | `features/performance/performance-chart{,-mobile}.tsx` (old duplicate removed) | Copy actual chart JSX/colors/tick/legend behavior, exact labels and genuine gaps |
| Account/security comparisons | Existing account scope and benchmark API | Thin queries against real API; compare consistent dates; no saved named groups |
| Return metrics | `investment_analytics`, `performance_math` | Existing terminal XIRR and TWR; approved new read-only annualization/risk summaries |
| Attribution sheet | Existing position components and limited unchanged-quantity FX | Show exact available components and limits; no invented reconciliation residual |
| Insights overview/explorer/charts | `portfolio-insights-overview`, `insights-dashboard`, allocation API | Refine actual source structures; reuse exact allocation and appearance layout persistence |
| Top Movers | Newer `holdings_workspace` already returns guarded daily changes | Reuse existing service including contract accrual; label dated/local-price methodology and FX limits |
| Concentration | Existing complete cash-inclusive top-1/3/5 | Source presentation/drilldowns, not new risk ratings |
| Income | Existing received/accrued source adaptation | Integrate supported views; preserve actual paid income vs accrual and existing currency-selector removal |
| Target rails/editor/drift | No existing target model/service | Approved Stage A; additive local configuration storage plus exact read-only drift |
| Worksheet | No eligibility/funding/trade-planning engine | Postponed; do not expose misleading functional controls |

The pin charts TWR and price/value-return comparisons; IRR, volatility and drawdown
are summary metrics, not historical XIRR curves. No extra XIRR history engine is
needed for parity. Existing benchmark series are price-return proxies, not reinvested
total-return indices. Every overlay must retain that distinction and source coverage.

## Confirmed decisions

User approved on 2026-11-08:

- Add volatility, maximum drawdown and annualized TWR summaries as tested read-only
  projections of the existing cash-flow-adjusted history; no independent return engine.
- Add Stage A Allocation Targets: local targets/weights/scope metadata, tolerances,
  current-versus-target drift and supported flat classifications. Never post money.
- Postpone full trading/cash/FX attribution and Stage B Rebalancing Worksheet.
- Previously postponed weighted ETF look-through, custom classification hierarchies
  and named portfolios remain postponed. No AI or tax/fee optimization is added.

Stage A reuses cash-inclusive valuations, explicit classifications, dated price/FX
and coverage guards. Missing/negative composition cannot become complete weights.
An allocation target does not grant liquidity to a CDB, imply a redemption or change
RDB/Caixinha tax lots. Scope/currency/unknown exposure must remain explicit.

## Demo and validation plan

Reuse the owned unified demo: official CDI/Treasury provenance, SIM securities,
partial sales/closed positions, two security brokerages, fixed-income accounts,
135 paid-income events, household and seven goals. Add only a versioned, repeat-safe
owned fixture extension where supported data is missing: an illustrative target configuration. Existing fictional securities already provide
benchmark coverage, so no new benchmark prices or assets were needed. Do not rewrite official observations
or use genuine exchange identifiers for invented quotes. All figures use real APIs.

Retain source/license inventory and existing preference namespaces. No new frontend,
Rust backend, hosted storage, financial cache, automatic trades or currency selectors.

Validation must include risk/target math and failure cases; clean/populated migrations;
complete financial/frontend regressions; exact money/coverage; actual browser scope,
benchmark, targets, customization and drilldowns; light/dark and mobile charts; paired
reference comparisons with honest runtime limitations. Current baseline: 535 backend
and 308 frontend tests passed for the preceding Goals migration, not this new work.

## Migration coverage matrix

| Area | Frontend | Backend/adapter | Demo | Visual check | Tests |
| --- | --- | --- | --- | --- | --- |
| Performance Overview | Source card/strip + local typed comparison workspace | Existing scope/TWR/XIRR/flows + new risk | Unified ledger | 1440/1920, light/dark mobile | Unit + real browser |
| Main Performance Chart | Actual source desktop chart leaf | Exact common-axis ratios + raw labels; no gap bridging | Existing SIM/official history | 1440/1920/1280/834 | Series + browser paths |
| Mobile Performance Chart | Actual source mobile chart leaf | Same exact API points | Same ledger | 390 light/dark | Geometry, overflow, real empty scope |
| Benchmark Selection | Local cached catalog / comparison picker | Existing benchmark API, no automatic network search | SIM-GLOBAL / SIM-SP500 fictional proxies | Desktop interaction | Real API selection |
| Benchmark Comparison | Multiple source-style line overlays/badges | Identical explicit API dates; price-only labels | Existing cached prices | Four meaningful paths | Series + API/browser |
| Performance Metrics | Source metric strip | Actual/365 annualized TWR, log volatility, max drawdown | Existing funded scopes | Desktop/mobile strip | Exact financial regressions |
| Attribution | Source-oriented gain/loss drawer + retained position table | Ending minus opening minus flows; explicit limited FX | Existing activities | Drawer capture | Balance/net-worth invariance |
| Account Filtering | Retained common account control + comparison series | Existing single/all account API scopes | Several brokerages | Account selection | API + browser links/scopes |
| Portfolio Insights Overview | Retained source adaptation + new targets/movers | Canonical allocation + holdings projections | Unified ledger | 1440/1920/390 | Unit + browser |
| Summary Widgets | Exact value/cash/invested/basis/unrealized | Cash-inclusive summary, missing stays unavailable | Existing holdings/cash | Desktop row | Allocation regressions |
| Account Allocation | Retained semi-donut/member details | Exact values and identities | Existing brokerages | Reference/desktop | Drilldown tests |
| Asset-Class Allocation | Retained source-style donut and real contract children | Current flat classification; no invented hierarchy | ETF/BOND/FII/FUND/CASH | Desktop | Contract drill tests |
| Sector Allocation | Retained donut/explorer lens | Declared metadata and Unknown | Existing fixtures | Desktop | Unknown/partial tests |
| Geographic Allocation | Retained donut/explorer lens | Declared metadata, not ETF look-through | Existing fixtures | Desktop | Classification tests |
| Currency Exposure | Retained explorer currency lens | Original/trading/reporting currencies remain distinct | BRL unified demo | Explorer | Mixed-currency backend regressions |
| Portfolio Composition | Source tile/color conventions in existing component | Area = value, color = native daily/total return | Actual holdings service | Desktop/mobile | Exact helpers + browser |
| Treemap | Source palette/contrast and return-mode controls | Missing/cash neutral, exact tooltip values | No invented returns | 1440/1920/390 | Coverage/normalization tests |
| Drillable Donut Charts | Retained root/contract/leaf interactions | Actual group memberships | Existing contracts | Desktop | Unit + existing browser regression |
| Portfolio Explorer | Retained lenses/segmented bar/expandable rows | Existing flat classifications | Existing holdings/cash | Desktop/mobile | Lens expansion + account link |
| Top Movers | Actual source card/rows | Exact native-currency guarded daily ranking | Existing positive/negative SIM changes + accrual | Desktop/mobile | Ranking + browser mode |
| Concentration | Retained top-1/3/5 and leaders | Complete cash-inclusive denominator only | Existing holdings | Desktop | Financial regressions |
| Dashboard Customization | Retained source responsive drag/resize grid | Appearance-only geometry; append new widgets safely | No financial preference storage | Desktop/mobile | Hide/save/reload/default + prior drag tests |
| Classification Drilldowns | Retained details with real security/account buttons | Same IDs, no duplicate financial models | Same ledger | Explorer/detail | Unit + real account navigation |
| Investment Income Integration | Existing received/accrued workspace retained | Paid cash versus outstanding contract accrual | 135 existing payments; official contracts | Income capture + both tabs | Existing tests + browser |
| Allocation Targets | Source rails + local flat editor/details | New Stage A configuration + exact dated drift | One additive fictional target | Rails/editor/details | Create/edit/delete/version + migration tests |
| Rebalancing Worksheet | Source inspected and retained uncompiled | Stage B explicitly postponed | None | Not exposed | Boundary/source inventory |
| Responsive Layouts | Source desktop/mobile geometry and existing shell | Same backend and exact values | Same demo | 1920/1440/1280/834/390 | Real layout/overflow checks |

## Implementation and financial conventions

- `features/performance` adapts the source desktop/mobile chart leaves, chart colors,
  metric/card layout, Top Movers card, treemap palette and target rails. The shared
  MIT chart context/tooltip/legend is in the existing vendor UI directory. The
  original duplicate Performance chart was removed after its exact-data behavior
  was preserved and the regression tests passed.
- FastAPI remains authoritative. Each comparison query uses the main response's
  opening/closing dates; no JavaScript money/return rebasing changes accounting.
  TWR points retain exact API strings. Only bounded dimensionless geometry enters
  Recharts; tooltips/tables format the authoritative labels. Null gaps remain gaps.
- Annualized TWR uses actual/365 (short periods are flagged), while source volatility
  frequency uses `n × 365.25 / covered_days`. Sample log-return standard deviation
  excludes zero-capital intervals; invalid/nonpositive factors make volatility
  unavailable. Drawdown uses a flow-adjusted TWR index, never raw funded value.
  Computation uses 60-digit Decimal arithmetic; extreme annualization is unavailable.
- The source-style gain/loss drawer reconciles opening, ending and external funding.
  Existing native-currency position components/limited unchanged-quantity FX stay
  available below. Full trading/cash/FX attribution is deliberately not claimed.
- Top Movers uses existing guarded daily observations, filters closed/cash/missing
  rows and ranks only the reporting currency. Contract changes are disclosed as
  accrual estimates. Treemap area includes cash; color uses native-currency return,
  with neutral missing/cash tiles, rather than assuming every unknown return is zero.
- Unknown classifications remain explicit. Current declared metadata on historical
  dates is not presented as verified historical ETF look-through.

## Stage A target configuration

Migration `sqlite_0020` adds three configuration tables only. Target definitions
support all or explicit investment-account scope, one existing flat classification,
exact 10,000-BPS total weights, absolute/hybrid bands and an expected-version guard.
Every edit appends weights/account-membership revisions; root metadata represents
its current definition, not a historical target ledger. Delete is soft deletion.

Drift is **current minus target**. Target money = complete cash-inclusive value ×
BPS / 10,000. Hybrid tolerance is the larger of absolute BPS and the truncated
relative proportion of target BPS. UI differences/tolerances use **pp**, not return
percentages; hybrid bands show their actual min/max range. Required classifications
outside tolerance and positive untargeted classifications are counted. Incomplete
or nonpositive valuations yield unavailable drift/counts, not zero or weights inflated
from a known subset. Target scope is stored independently and explicitly labeled;
it does not silently become the current page filter.

The unified demo extension adds only a deterministic fictional 60/30/10 ETF/BOND/CASH
planning definition, with 5-pp/20%-relative hybrid tolerance. It posts no cash,
activities, prices or income; existing official observations and SIM provenance are
unchanged. Existing markers/owned backup-generation upgrades preserve edits; reset
and personal-data isolation are covered by tests.

## Validation and visual evidence (2026-11-08)

- Backend: **548 passed**, including exact risk/target tests, fresh/populated
  migrations, FK/integrity checks, demo repeat/reset/isolation and all prior financial
  regressions. Three inherited synthetic-seed SQLAlchemy connection warnings remain.
- Ruff lint and formatting: passed, **202 files**.
- Frontend full suite: **315 passed** across 73 files. The final mobile carousel
  refinement and accessibility-label correction also passed 20 focused frontend tests. TypeScript, ESLint, Prettier and
  the production build passed. Existing dependency-annotation/shared-bundle warnings
  remain (largest shared bundle approximately 2.39 MB before gzip).
- Real browser Performance/Insights run passed: four nonempty comparison lines,
  account/period selection, unavailable-date guard, exact data, selected attribution,
  target create/edit/delete/revisions, layout persistence, Explorer/account navigation,
  paid/accrued Income and an empty account created through the real guarded demo API.
  Account balances and Net Worth were identical before/after metadata interactions.
- Actual light/dark mode is asserted, not inferred from screenshot filenames.
  Desktop/laptop/tablet/mobile widths: 1920, 1440, 1280, 834 and 390.
- The existing Spending/Budgets, Holdings/Activities (including imports and ledger
  mutations) and Goals/Savings Planner browser regressions passed in separate owned
  temporary demos. A loading-skeleton race in the Goals harness was corrected by
  waiting for actual loaded goal links before asserting the unchanged goal count.
- All **188** preserved/new upstream SHA-256 records were checked against the pin.
  Generated screenshots, temporary databases, WAL/SHM files, logs and builds remain ignored.
  Personal/saved demo databases were not modified by these checks.

Open the ignored local [visual gallery](screenshots/v014-performance-insights/index.html)
for native 1440×900 reference/implementation pairs, 1920×1080 source-guided checks,
drift/attribution/Income and responsive captures. Cached official screenshots are
approved fallback evidence; a running same-revision reference was unavailable.
The public images can predate the pin. No pixel-identical runtime comparison is claimed.

Remaining visual differences are intentional/data-bound: existing common account/date
controls remain; the pinned current metric strip wraps below the title before 2xl,
unlike the older cached single-row strip; user appearance/font/series palettes remain
in force; labels are Brazilian exact decimals. Missing metadata is visibly Unknown.
The target editor adapts flat local classifications rather than unavailable taxonomies.
The source screenshot's “suggested moves” is absent because Stage B is postponed.

## Deferred scope

Full trading/cash/FX attribution; weighted fund look-through; custom classification
hierarchies; named portfolios/account groups; hypothetical rebalancing worksheet,
trade eligibility/funding/rounding/draft/export services. No automated trading,
liquidity recommendations or tax/fee optimization was added. In particular, locked
CDBs are never presented as ordinary sell candidates. No AI or Retirement/FIRE work.
