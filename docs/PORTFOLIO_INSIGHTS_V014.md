# v0.14 Portfolio Insights source adaptation

Status: implemented and validated locally; ready for user visual review. The user
approved full source-style widget customization and postponed the other five capabilities.
No commit, merge, tag or release is authorized by this task.

## Reference baseline and visual evidence

Pinned Wealthfolio revision: `92b4647f74ec51fbbb1a772db4f42ea91060c518`.
The clean reference checkout remains under ignored `.tmp/reference-v014`.
The official feature page was retrieved on 2026-11-05, along with overview dark/light,
sector dark and allocation dark screenshots. URL/hash metadata is retained in
`.tmp/v014-insights-references.json`. Public screenshots are visual references, not
proof of a running upstream app or of the same source revision. No newer source is
silently mixed into the adaptation. Images/checkouts remain local and ignored.

Inspected upstream files under `apps/frontend/src/`:

- `pages/insights/portfolio-insights.tsx`
- `pages/insights/overview/{overview-page,insights-dashboard,portfolio-explorer,value-strip,holdings-highlight-cards}.tsx`
- `pages/insights/overview/{insights-layout,allocation-derivations,holdings-highlights}.ts` and associated tests/CSS
- `pages/holdings/components/{drillable-donut-chart,drillable-account-chart,composition-chart,allocation-detail-sheet}.tsx`
- Allocation hooks, taxonomy assignment types, palette/drilldown/breadcrumb helpers.

The source uses five metric widgets, four 234px allocation cards, a large composition
map, target rails, an expandable breakdown, Top Movers and concentration widgets.
Its 12/6/2-column draggable/resizable dashboard is a separate layout subsystem.

## Existing application comparison

Finance Tracker already has historical cash-inclusive allocation, original-currency
weighted-average basis/results, account scopes, asset class/currency/sector/geography
buckets, top-1/3/5 concentration, semi-donuts/treemaps and holding links. Existing
routes already group Overview (legacy Allocation), Performance and Income under
Insights. These remain the only analytical destinations; performance/income modules
are not redesigned here.

Adapt actual card/chart/explorer structures with thin typed adapters. Keep Decimal
and the existing dated FX/price readers authoritative. A small read-only projection
can convert existing basis with the same as-of FX reader; it is not a change to basis
accounting or a cash posting. Brazilian instrument types and issuer metadata come
from existing immutable fixed-income contracts. A Caixinha is an investment holding,
not ordinary cash or another goal asset.

Do not copy upstream money Number coercions, zero fallbacks or known-subtotal
normalization. Missing prices/FX invalidate portfolio weights, remain visible in
rows and never become zero. Trading currency, listing identity and declared exposure
are separate lenses. Unknown classifications remain Unknown; no ETF composition is
manufactured for the showcase or historical demo.

## Confirmed capability decisions

1. **Postponed:** sourced, dated weighted ETF/fund look-through; multiple sector/region weights.
2. **Postponed:** custom classification hierarchies and manual risk categories.
3. **Postponed:** daily Top Movers and daily treemap coloring.
4. **Approved:** full source-style widget hiding, dragging, resizing and default restoration.
5. **Postponed:** allocation targets and a read-only rebalancing worksheet.
6. **Postponed:** named account groups/portfolios. Existing ad hoc backend scope lists remain supported.

User decision: “full 4# postpone the rest”. Basic concentration is already supported; the pinned source does not
require inventing HHI, covariance or fund-overlap statistics.

Financial display remains the user's fixed two-decimal Brazilian convention in all
languages, including chart labels/tooltips. Exact API/source values remain unchanged.
The live demo stays on the saved Brazil household; tests create owned isolated roots.

## Implemented interface and adapters

- `PortfolioInsightsOverview` replaces the old Allocation rendering; legacy Allocation
  and `#/insights?view=overview` bookmarks remain valid. Performance and Income are reused.
- Five metrics, four source-proportioned semi-donuts, a composition treemap, segmented
  allocation explorer, expandable holdings, concentration and shared detail drawers.
  Clicking a category opens its actual contributing holdings; securities navigate to
  the existing investment detail view. Exact legends provide keyboard access to charts.
- Account, class, region, sector, instrument, issuer and currency lenses stay distinct.
  A fixed-income class can drill into CDI CDB, fixed CDB, RDB/Caixinha and Tesouro using
  immutable contract metadata. Cash is included once. Goal allocations add no assets.
- Existing allocation API gains optional `summary` and enriched rows (symbol/name,
  instrument/issuer, quantity, source/date, native and reporting basis/unrealized).
  It reuses the existing loaded PriceBook/AccrualBook metadata and dated FX reader.
  There is no migration, posting, new valuation engine or independent balance cache.
- Book cost is **remaining native weighted-average basis converted at as-of FX**.
  It is not historical contributions translated at purchase-date FX. Unrealized gain
  uses that same convention; native basis remains inspectable separately. Paid income
  and realized results are excluded from this metric. No return is inferred from value.
- Partial/negative composition suppresses percentage graphics, retains unavailable
  members and exposes the known subtotal. Empty portfolios differ from unavailable data.
  Source-specific synthetic labels and fictional-contract labels remain separate.

## Dashboard customization

`InsightsDashboard` adapts upstream's `react-grid-layout` 2.2.4, 12/6/2 responsive
columns, compact handles and draft/save/cancel flow. Widgets can be hidden, restored,
dragged and resized on desktop/tablet. The picker offers keyboard move and numeric
size controls, including on mobile where pointer dragging is disabled. Widget content
defines a minimum height so expanded financial rows are never clipped.

Only a versioned allowlisted set of IDs, visibility and bounded grid geometry are
stored with existing normal/demo appearance preferences. Financial values, filters,
source payloads and account IDs are never saved to localStorage. Resetting financial
demo data preserves appearance, including layouts. Cancel discards the draft; Restore
Defaults also remains a draft until saved. No server layout-persistence subsystem exists.

## Intentional visual differences

The current pinned source has five metric widgets; the public feature screenshot
shows an earlier three-part strip. Finance Tracker uses five supported metrics.
The unchanged demo provenance banner and existing as-of controls occupy
extra header space. Currency selectors were removed by user request on 2026-11-06;
reporting defaults and explicit bookmarks remain supported. Shared theme/font choices and Brazilian two-decimal formatting
remain authoritative. Targets, daily coloring and custom taxonomy/risk/group tabs
are absent following the explicit postponements; composition uses categorical colors
and full width rather than an empty target rail. No unavailable exposure is invented.

## Validation and reproduction

Run `npm test`, `npm run lint`, `npm run format:check` and `npm run build` in
`frontend`; run `pytest`, `ruff check .` and `ruff format --check .` in `backend`.
The financial regressions use migrated isolated SQLite databases, including exact
remaining basis after a partial sale, dated/missing FX, missing quotes and RDB identity.

Browser command (PowerShell, after building frontend):

```powershell
cd frontend
$env:DEMO_E2E_PORT='5174'
node scripts/demo-e2e.mjs --real-market-only --insights
```

The runner refuses an occupied port and owns a temporary workspace. It tests Brazil
and ETF scenarios, validates API totals, pointer drag/resize, visibility persistence,
cancel/default restoration, account scopes, drill-downs and unchanged account data.
It captures dark/light 1440×900 and 1920×1080 plus 390px mobile screens under ignored
`.tmp/v014-portfolio-insights-browser`. Empty/partial/fully unavailable rendering and
controlled loading/error captures use labeled browser response fixtures; backend tests
independently exercise actual missing data. Treemap/category drawers and navigation
to real investment detail routes were exercised, along with Performance/Income smoke checks.
Reference comparisons use official feature screenshots, not a running upstream app.

Final validation, 2026-11-05:

- **489 backend tests passed**, including the financial, migration and bounded-query
  regressions. Ruff lint and formatting passed (164 files). Three existing synthetic
  seed connection warnings remain. Duplicate metadata reads discovered during the
  query-count regression were removed by reusing the existing valuation book.
- **250 frontend tests passed** across 48 files. ESLint, Prettier, TypeScript and
  the production build passed. Existing bundle-size/dependency annotation warnings remain.
- The complete isolated Playwright runner passed in both scenarios, including genuine
  pointer drag/resize, keyboard-accessible alternatives, persistence, scope totals,
  drill-downs, real holding navigation, coverage states and responsive layouts. Normal
  demo requests produced no unexpected HTTP errors or browser exceptions.
- Paired local reference/implementation captures are in ignored
  `docs/screenshots/v014-portfolio-insights/index.html`. Both paired images are native
  1440×900; 1920×1080 is a source-guided check without an equivalent public screenshot.
- `npm audit` reports 12 moderate toolchain findings; no newly added layout package
  is flagged. No automatic dependency upgrades or unrelated fixes were applied.
- The existing live Brazil demo was restarted on loopback port 8001 to load the
  enriched projection. Account data matched exactly across restart; there was no reset
  or scenario change. Personal databases, existing demo edits and historical source
  observations were preserved. Generated databases/logs/screenshots remain ignored.
- Branch remains `feature/v0.14.0-frontend-refinement`, released version remains
  0.13.0, and no commit, push, merge, tag or release was performed.

## v0.14 continuation (2026-11-08)

Performance/Insights continuation adds the actual source Top Movers card and
treemap color/contrast patterns with exact return ratios, local target rails/editor
and 9/3 composition/target plus 6/6 highlight default layout. Existing saved widget
coordinates remain intact; new widgets are recoverable through customization.
Drilldowns retain real holding/account identities. Daily ranking stays within the
reporting currency; other currencies/missing or same-day-quantity observations
are explicitly excluded. Contract accrual is not labeled as an exchange quote.

Source/coverage matrix, Stage A boundaries and current validation are recorded in
[Performance and Insights v0.14](PERFORMANCE_INSIGHTS_V014.md). Prior validation
numbers above describe the earlier migration, not this continuation.
