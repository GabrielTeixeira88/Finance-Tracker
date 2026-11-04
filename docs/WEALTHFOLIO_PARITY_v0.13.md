# v0.13 implementation parity specification

Unreleased working specification, audited 2026-10-25. Branch:
`feature/v0.13.0-stabilization`. No release, Git publishing or deployment is authorized.

## Starting state

The working tree already contains appearance preferences (five fonts/palettes,
three languages), shared exact chart geometry, progressive forms and the native
fixed-income subsystem. These changes are retained. The released version stays
0.12.0. Investment histories, TWR/XIRR, exposure, income, manual wealth and goal
allocation services already exist. Life Events persistence and goal glide paths
are missing; spending narrative and investment/detail composition are partial.
Baseline frontend: 141 tests passed. Backend baseline: 400 tests passed (three existing
SQLAlchemy connection-options warnings).

## Reference and licensing boundary

Inspected the separate ignored Wealthfolio checkout at
`d86c20194b4b61ad8133ce820739d5ac83f9045e`, its AGPL-3.0 LICENSE,
TRADEMARKS.md, shared UI components and the source paths below. Source URLs use
`https://github.com/wealthfolio/wealthfolio/tree/d86c20194b4b61ad8133ce820739d5ac83f9045e/`.
Official feature screenshots were downloaded only to ignored `.tmp` for comparison;
they are not product assets. Reference images are 1440×900. Wealthfolio is a trademark
of Teymz Inc.; Finance Tracker is independent and is not endorsed by that project.
Existing adapted-source AGPL and font OFL notices remain. No logos, ticker marks,
goal artwork, assistant components or upstream translations are copied.

Finance Tracker retains Decimal/string calculations and dimensionless BigInt chart
coordinates. Upstream Number-based transformations, Rust/Tauri adapters and account
tracking modes are not drop-in replacements. Transaction-derived tracking remains
authoritative; holdings-only tracking is not introduced or presented as equivalent.

## Page contracts

All source paths below are relative to `apps/frontend/src/`. The visual references
are the dark screenshots on the linked official feature pages. Each row specifies
hierarchy, graphics, metrics, navigation, details, responsive behavior and adaptation.

| View / source | Visual reference | Hierarchy, chart and supporting graphics | Controls, details and responsive adaptation |
| --- | --- | --- | --- |
| Investment overview: `pages/dashboard/dashboard-content.tsx`, `balance.tsx`, `accounts-summary.tsx`, `top-holdings.tsx` | [Investment dashboard](https://wealthfolio.app/features/investments-tracking/) (`investments/dashboard-dark.png`) | Primary value/change over a wide unboxed history, compact interval controls, lower account summaries and top holdings; smaller return context | Reuse exact portfolio/history services and account scope. Lower 2:1 grid collapses to one column; retain Finance Tracker section links and demo strip. Composition belongs in Insights rather than overwhelming Overview. |
| Holdings: `pages/holdings/holdings-page.tsx`, `components/holdings-table.tsx` | Same page (`holdings-dark.png`) | Searchable dense rows, security identity left, numeric values right; freshness and quantity secondary | Existing currency/search/sort plus detail drawer. Preserve original currencies; compact internal scrolling on narrow screens. No synthetic logos or holdings-only editing. |
| Holding/account detail: `pages/asset/`, `pages/account/`, `components/performance-grid.tsx` | Same page (`asset-dark.png`, `account-dark.png`) | History first; value, basis, return and distribution follow; activity and income remain accessible | One focused detail surface with history, account distribution and records. No replacement TWR engine; no fabricated absent quotes. Full-width detail on mobile. |
| Performance: `pages/performance/performance-page.tsx`, `components/performance-chart.tsx` | [Performance](https://wealthfolio.app/features/performance-dashboard/) (`compare-dark.png`, `drivers-dark.png`) | Dominant return chart, compact scope/benchmark/range controls, metric grid, expandable drivers | Keep daily TWR, annualized XIRR, missing coverage and labeled price proxies. Secondary attribution stays contextual. Mobile controls wrap; exact table remains accessible. |
| Portfolio Insights: `pages/insights/overview/insights-dashboard.tsx`, `portfolio-explorer.tsx`, `holdings-highlight-cards.tsx` | [Insights](https://wealthfolio.app/features/portfolio-insights/) (`overview-dark.png`) | Compact value strip, allocation arcs, composition treemap and concentration; detailed classifications below | Existing asset-class/currency/sector/geography/account data. Unknown and incomplete coverage explicit. Responsive graphic grid; no target rails, drift, rebalancing or AI. |
| Net Worth: `pages/net-worth/net-worth-content.tsx`, `net-worth-chart.tsx`, `components/breakdown-table.tsx`, `category-detail-sheet.tsx`; `pages/asset/alternative-assets/` | [Net worth](https://wealthfolio.app/features/net-worth-tracking/) (`dashboard-dark.png`, `property-dark.png`) | Large history, asset/liability composition, expandable categories and dated asset details | Retain native/manual values, debts and no double counting. Shared drawer for observations/editing; mobile full width. Explicitly omit momentum and velocity. |
| Spending/budget: `features/spending/components/budget-editor.tsx`, `components/reports/insights/where-i-am-stage.tsx`, `what-changed-stage.tsx`, `when-where-stage.tsx` | [Spending](https://wealthfolio.app/features/spending-budgets/) (`spending-overview-dark.png`, `spending-budget-dark.png`, `spending-insights-dark.png`) | Spending chart, category composition, grouped target progress, narrative pace/change sections | Existing target/override/rollover/refund services; no envelope requirement. Drill-downs to records, forecast clearly labeled; no hourly heatmap because ledger stores dates only. Compact responsive groups. |
| Life Events: `features/spending/components/reports/insights/events-timeline-card.tsx`, `event-detail-panel.tsx`; `crates/spending/src/events/{model,service}.rs` | Same feature page (`spending-events-dark.png`) | Date bands with event labels, daily spending chart, selected-event cost and category breakdown | Native persisted associations use ledger classification and dated FX. Event date windows and linking are explicit. Timeline becomes a chronological list on small screens; create/edit/link/remove remain accessible. |
| Income: `pages/income/income-page.tsx`, `income-history-chart.tsx` | [Income](https://wealthfolio.app/features/income-tracking/) (`summary-dark.png`, `byaccount-dark.png`, `activities-dark.png`) | Primary income value, monthly bars, dividend/interest distribution, account/security breakdown and payment history | Reuse posted investment income, scope and period filters. Accrued CDB interest stays separate from cash income; redemption results explicitly distinguished. Narrow tables scroll. |
| Goals: `features/goals/save-up/components/save-up-detail.tsx`, `save-up-projection-card.tsx`, `savings-milestones-card.tsx` | [Goals](https://wealthfolio.app/features/goals-saveup-planner/) (`list-dark.png`, `goal-dark.png`) | Goal status/progress, compact savings inputs, main actual/required/projected trajectory, milestones | Reuse allocation/history service; deterministic no-return contribution scenario. Actual versus forecast lines explicit. No tax-aware funding, liquidation or retirement. Two-column detail stacks on mobile. |
| Imports, Gmail, reconciliation, rules | No exact upstream equivalent | Preserve review steps, source-versus-ledger evidence and advanced forms; shared headers, notices, details and feedback | No posting changes, automatic matches or lost advanced settings. Keyboard confirmation, responsive evidence tables, all three UI languages. |

The expanded sidebar remains available; the existing collapsed mode matches the
reference's 70px icon rail for comparison. Appearance preferences are never reset
to force a screenshot. Shared chart heights, section spacing and detail surfaces
must work with all palettes/fonts rather than hardcoded reference colors.

## Securo findings

Inspected `securo-finance/securo` revision
`43d48ffb49cecd538cf6ec67a7d059ac180e567e` (AGPL-3.0), its
`backend/app/providers/tesouro_direto.py`, asset UI and fixed-income-related tests.
The adapter reads official Treasury CSV and identifies a bond by title/maturity;
its latest-quote path is useful reference for identity and provenance. Generic
asset progression and Pluggy holdings are not a contractual CDI compounding,
tax and redemption engine. No suitable native CDB engine was found in the inspected
models/services/tests. Finance Tracker keeps its native Decimal contract service;
no Securo source is copied. Synthetic demo history remains explicitly separate
from official observations. A live Treasury adapter is not silently added.

## Validation and comparison

Run full backend/frontend regressions, lint/format/type/build, clean/populated
migrations and the isolated demo browser runner. Compare 1440×900 screenshots and
check 1920×1080 and 390×844 behavior. Record measured differences and failed or
unfinished acceptance criteria here; source inspection alone is not visual parity.
No financial data from the normal local workspace is used for screenshots.

### Executed results — 2026-10-26

| Check | Result |
| --- | --- |
| Backend `python -m pytest` | **411 passed**, 3 existing SQLAlchemy seed connection-options warnings |
| Backend Ruff check / format check | Passed; 142 Python files formatted |
| Frontend `npm test -- --maxWorkers=2` | **144 passed**, 23 files |
| ESLint / Prettier check | Passed |
| TypeScript + Vite production build | Passed; main chunk 1.30 MB / 408 kB gzip warning remains |
| Clean migrations / populated upgrade / seed repeatability | Passed in backend suite, including owned demo upgrade preserving edits |
| Edge `node scripts/demo-e2e.mjs --parity --fixed-income` | Passed against its own migrated SQLite workspace |
| Edge `node scripts/demo-e2e.mjs --appearance` | Passed against a separate synthetic workspace |
| Diff whitespace / candidate-file privacy scan | Passed; no database, credential, log, dependency or build files among pending project files |

Browser validation exercised the existing income/expense/transfer, import, Gmail
simulation, reconciliation, target, rule/category and reset workflows. It also
exercised investment account/holding navigation, history and sorting, Performance,
exposure, paid income, Net Worth/property details, and responsive section navigation.
Fixed-income checks confirm a partial redemption creates one SELL and survives reload,
a new fixed-rate subscription appears, an exact 18-place factor can be recorded, and
reset restores all five original contracts. Treasury history includes a genuine
synthetic mark-down; it is not an always-rising decorative curve.

Life Event checks create an exact-budget event, associate a purchase, remove the
association and delete the event; all account responses remain unchanged. The picker
now identifies and disables purchases owned by another event, while backend atomicity
remains authoritative. Goal scenarios change from off track to on track with an exact
monthly contribution and produce the expected future completion date. Screenshot
capture waits for lazy charts and recalculated state, not just the first rendered shell.

Appearance validation covers all five fonts and palettes, light/dark/system, preference
reload and reset isolation. Portuguese and Spanish event/goal drawers were exercised,
including localized contribution input, Escape, focus containment and restoration.
The Portuguese `1,50` expense still posts exactly `1.500000`; reset removes only test
financial edits. Fixed-income views were rendered in English, pt-BR and es-419.
These are targeted keyboard/localization checks, not a formal screen-reader/WCAG audit.

### Visual comparison

Open the [matched comparison gallery](screenshots/parity-v013/index.html). Both sides
use original **1440 × 900** screenshots. Local reference images remain in ignored
`.tmp`, with an explicit local-cache button; public source URLs are also available.
The reference image host returned HTTP 403 to automated HEAD checks during final
validation, so online embedding is not guaranteed. The already inspected local
reference images are available for this review and are not bundled product assets.
Additional application captures cover 1920 × 1080, 1280, 768 and 390 × 844.

Visually reviewed Investments, holdings/account details, Performance, exposure, Income,
Net Worth/property details, Spending/Insights/Events, goal trajectories, fixed income,
and representative narrow/light/localized states. The observed comparison led to
smaller header/control spacing, a 300px investment history, compact exposure arcs,
account/holding rows, two-column account/security details with exact metric sidebars,
and collapsed manual valuation entry so its chart leads the detail.

Remaining visible differences are explicit:

- Finance Tracker retains the fictional-demo banner, nine investment workflow tabs,
  labeled account/date/currency controls and coverage disclosures. They add vertical
  space compared with the reference; supporting account rows begin lower on the page.
- Historical observation charts use steps and visible date ticks, not interpolated
  smooth curves. Missing observations are gaps. Exact fractional amounts remain visible.
- Native side drawers replace some reference full-page property/goal details. Mixed
  currencies remain separate rather than being ranked without FX. Holdings have text
  identities instead of copied logos. Palette choices can differ from the reference.
- Portfolio composition includes unknown cash classification and exact-value legends;
  no look-through, allocation targets, rebalancing, AI or invented exposures are shown.
- Performance retains the existing supported TWR/XIRR and labeled benchmark coverage;
  unsupported reference risk metrics and multi-series account comparison are not added.

This is a reviewed adaptation, **not pixel-perfect parity**. Reference approval remains
a human review decision; successful tests do not establish visual equivalence.

## Delivered domain behavior and boundaries

| Area | Implementation and financial boundary |
| --- | --- |
| Investments and details | Chart-first overview, account rows, currency-safe top holdings and sortable dense holdings; existing position/cost-basis/activity services retained |
| Portfolio Insights / Performance | Account, class, geography and sector arcs plus composition treemap; original exact analytics, missing coverage and benchmark semantics retained |
| Net Worth | Existing cash/holdings/manual observations remain authoritative; shared details add dated charts and related debt identity; no momentum/velocity |
| Spending / Life Events | Deterministic elapsed-period/category/weekday facts; persisted event CRUD and unique purchase associations, shared refunds and dated FX; no new spending postings |
| Income | Posted monthly dividends/interest and source composition; redemptions show principal, fees/taxes and realized result separately; unrealized accrual is never paid income |
| Goals | Actual/required/projected lines and documented status thresholds; future month-end contribution scenario, no interest/guaranteed returns, no tax-aware funding |
| Fixed income | Immutable CDB/CDI/fixed/Treasury terms, exact dated factors, business-day accrual, historical valuation and explicit partial/full redemption; one cash posting per activity |
| Exclusive workflows | Shared localized controls, review/evidence primitives and compact disclosures; existing import/Gmail/reconciliation/rule/schedule posting guards preserved |

The native additive migrations are `sqlite_0014` (contracts/indices/immutability) and
`sqlite_0015` (Life Events/links). New services reuse price/FX, spending and ledger
reconstruction, rather than keeping independent authoritative totals. No new analytics
engine or external index provider is introduced. Source patterns were adapted to the
existing architecture; no new upstream components, graphics or translations were copied.
AGPL/OFL and earlier adapted-source attribution remain in THIRD_PARTY_NOTICES and licenses.

The deterministic expanded baseline has **772 ledger entries, 97 linked transfers,
7 accounts, 33 investment activities, 10 securities, 5 fixed-income contracts,
1,004 dated index factors, 2,718 price observations, 1,054 FX observations, and
4 Life Events associated with 19 existing purchases**. Existing edited demo generations
are migrated without reseeding; only explicit demo reset loads the new baseline.

Read [fixed-income calculations and limits](FIXED_INCOME.md),
[event/refund/FX and trajectory conventions](LIFE_EVENTS.md), and
[appearance/localization](APPEARANCE_AND_LOCALIZATION.md). Contract corrections, live
official CDI/Treasury ingestion, exceptional calendar closures, issuer-specific tax
rounding/custody fees and tax filing remain unsupported. Manual observations must be
verified by the user; fictional factors cannot value real contracts. No automatic
maturity posting, liquidation, retirement/FIRE, target allocation or AI was added.

## Review handoff

Documentation updated: README, AGENTS, Unreleased changelog, architecture, data model,
product specification, roadmap, demo/readiness, UI conventions and source notices;
the three focused documents above describe the new contracts and remaining limits.
Source changes span backend services/models/routes, two migrations and regression tests;
frontend shared charts/drawers, investment/spending/goal/wealth pages, locale catalogs
and browser scripts; plus synthetic screenshot galleries. Prior appearance work remains
in the same uncommitted change set.

Final working-tree summary: 83 tracked files modified (4,679 insertions / 2,083
deletions), plus 66 new source/configuration/documentation/license files and 175
synthetic application screenshots. `git diff --stat` alone omits these untracked files.
Generated databases, logs, build output, dependencies and external reference checkouts
remain ignored. The 14 local comparison pairs were browser-checked at native 1440 × 900.

No known failure remains in the executed checks. Remaining stabilization gates are
visual sign-off, deeper assistive-technology review, bundle/code-splitting work,
fine-grained localized domain errors, previously identified dev-tool security updates,
backup/recovery and cross-platform validation. None is silently claimed complete.
The version stays **0.12.0**, with v0.13 changes Unreleased. Normal local data is untouched.
No commit, push, merge, tag, branch change or deployment was performed.
