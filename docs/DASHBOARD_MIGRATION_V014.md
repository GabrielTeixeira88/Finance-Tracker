# Investments and Net Worth dashboard migration

Reference baseline: `wealthfolio/wealthfolio` commit
`92b4647f74ec51fbbb1a772db4f42ea91060c518` (AGPL application / MIT shared UI).

## Technical comparison

The source dashboard uses `portfolio-page.tsx`, `dashboard-content.tsx`, `balance.tsx`,
`accounts-summary.tsx`, `top-holdings.tsx`, `goals.tsx` and `history-chart.tsx`.
The local equivalents were `App.tsx`, `pages/investments.tsx`, `investment-hero.tsx`
and `investment-overview-rows.tsx`. Net Worth already had an initial adaptation in
`pages/wealth.tsx`, `net-worth-overview.tsx` and `net-worth-chart.tsx`.

Source layout/interaction code is adapted with exact-string adapters instead of
upstream floating-point amounts, desktop bindings and independently refreshed totals.
Existing Holdings, Activities, manual asset/debt editors and Goals remain authoritative.
The unified shell keeps Spending first. Account selection applies only to investments;
household Net Worth never inherits an investment-account filter.

## Financial adapters

`GET /api/investments/analytics/dashboard` composes the existing valuation and
performance readers at one selected closing date. Its request-local per-account
histories use the same prices, FX and event reconstruction as the total. Account
returns use their own scope-boundary cash flows; internal transfers cancel in the
combined scope. The chart contribution overlay is cumulative external funding,
not opening market value or cost basis. Missing flow-date FX leaves it unavailable.

Net Worth Momentum compares equal-length closing-value windows, with monthly bars
computed from recorded history. Missing/unrecorded baselines remain unavailable.
Changes include contributions and are not investment returns. Velocity retains the
existing reconciled five-driver bridge, including its explicit cash/FX residual.
Manual debt changes are recorded balance movements, not inferred repayments.

## Explicit scope decisions

This request restores Momentum and liability actions, superseding the earlier
follow-ups that removed/hidden them. Shared dashboard periods are now in scope.
Named portfolios, loan amortization and complete trading/cash/FX attribution remain
postponed. No accounting schema, posting engine, release version or personal data is
changed for the visual migration.

## Validation

Backend: **553 tests passed**, including migrated fresh/populated SQLite, transfer,
investment, fixed-income, ingestion, reconciliation and demo-isolation regressions.
Frontend: **321 tests / 74 files passed**. ESLint, TypeScript/production build and
Prettier checks passed. Existing large-chunk and dependency annotation warnings
remain; this slice adds no dependency or financial schema migration.

The browser runner owns a temporary unified demo, never the saved demo or normal
database. `node scripts/demo-e2e.mjs --dashboard-migration` checks tab/default order,
period synchronization, exact totals, privacy, account/security/manual-asset
navigation, caller restoration, filters, calendars, Back/Forward and responsive
layouts. `node scripts/net-worth-empty-e2e.mjs` uses a separately migrated empty
database with normal workers/vault disabled, covering empty, zero, negative,
missing-value/FX and error/retry states. See final browser results below.

### Financial reconciliation

At the fixed demo close, 2026-09-30:

- Four investment accounts sum to **126859.330460 BRL**, exactly the authoritative
  portfolio total (cash plus eligible holdings). They are not additional assets.
- Assets **648286.200760 BRL** minus recorded liabilities **164000.000000 BRL**
  equal Net Worth **484286.200760 BRL**. Goals add no assets.
- The 3M exact driver bridge sums to **49592.167435 BRL**, the selected Net Worth
  change. Contributions are not investment returns; manual debt changes are not
  inferred loan payments.
- An independent BigInt/Decimal sum checks account and household totals; read-only
  browser navigation leaves all account balances unchanged.
- Positive historical cash is not relabeled as debt when an account later becomes
  overdrawn. Missing component/FX values never become zero debt, gains or allocations.

Evidence is generated locally under ignored `docs/screenshots/v014-dashboards/`,
including `financial-check.json` and `empty-validation.json`. It contains only the
runner's fictional data. No personal data or generated database is published.

## Migration coverage matrix

“Adapted” means source layout/interaction code with local exact API/state adapters;
it does not mean a verbatim component can consume incompatible upstream numbers.
Only `history-chart-scale.ts` retains its algorithm unchanged, on dimensionless
coordinates. The 23 new source records and their reuse classifications are in
`frontend/src/vendor/wealthfolio/SOURCE.json`; all 211 original fingerprints verify.

| Component | Original copied | Backend integrated | Demo populated | Visual parity | Tests |
|---|---|---|---|---|---|
| Dashboard shell | Adapted tab composition/icons; existing shell retained | Shared URL period adapter | Yes, Spending first | Paired reference | Navigation/browser |
| Investments Overview | Adapted `dashboard-content.tsx` | Coherent dashboard read API | Yes | Paired reference | Financial/browser |
| Balance header | Adapted `balance.tsx`; exact labels replace NumberFlow | Closing valuation, gain and TWR | Yes | Paired reference | Privacy/rendering |
| Period controls | Source toggle/calendar composition | Same selected dates; calendar cash-flow vs closing-value conventions retained | Yes | Desktop/mobile | Presets/custom/calendar |
| Portfolio selector | Reused migrated source account selector | One account/all accounts | Yes | Source control | Scope/navigation; named groups postponed |
| Historical chart | Adapted `history-chart.tsx`; unchanged scale helper | Dated values, cumulative external funding and purchase markers | Yes | Paired reference | Exact geometry/gaps/browser |
| Account summaries | Source row composition; no invented groups | Request-local histories and scope-specific performance | Four accounts | Paired reference | Exact reconciliation/drilldown |
| Top Holdings | Source Item rows, metric/sort/display controls, avatar overflow | Existing Holdings workspace; original currencies kept separate | Yes | Paired reference | Filters/navigation/browser |
| Goal summaries | Source rows, progress, deadline countdown and view-all | Existing goal/funding reader at selected end date | Seven existing goals | Source composition | Existing goal and browser regressions |
| Net Worth Overview | Adapted `net-worth-content.tsx` | Existing household wealth authority | Yes | Paired reference | Financial/privacy/browser |
| Net Worth chart | Source chart adaptation retained | Actual dated household values, explicit gaps | Yes | Paired reference | Negative/empty/missing/browser |
| Asset breakdown | Source responsive subgrid, collapses and composition | Existing exact categories | House/car/equipment/collection, cash and investments | Paired reference | Grouping/keyboard/browser |
| Liability breakdown | Source subgrid, individual debt rows | Signed component histories, no inferred amortization | Mortgage and vehicle debt | Source composition | Signed-cash regression/financial |
| Category sheets | Adapted source Sheet and avatars | Existing components and investment allocation | Yes | Paired drilldown | Keyboard/navigation/browser |
| Category trends | Adapted source compact AreaChart | Exact dated category/component histories | Yes | Source geometry | Missing/signed history |
| Momentum | Adapted `momentum-card.tsx` | New exact read-only equal-window/monthly projection | Yes | Source composition | Exact/negative/missing windows |
| Velocity | Source driver presentation; local five-driver bridge retained | Existing reconciled driver service | Yes | Paired reference | Driver sums/coverage |
| Attention | Source warning/list composition, existing linking API | Dated >90-day observations and unlinked mortgages | One genuinely stale collection | Source composition | Staleness/demo preservation |
| Personal asset actions | Reused migrated editors; source action palette | Existing audited manual-position APIs | House, car and other assets | Source detail workflow | Create/detail/audit regressions |
| Liability actions | Restored existing safe actions | Existing dated debt and property-link services | Yes | Source detail workflow | Existing financial/CRUD tests |
| Privacy controls | Shared temporary context and source toggle behavior | Display-only; queries unchanged | Yes | Source control | Values/tooltips/titles/browser |
| Mobile layouts | Source container/grid and responsive controls | Same services | Yes | 390/834 checks | Overflow/navigation/browser |
| Cross-page navigation | Thin canonical hash adapters | Separate household and investment scopes | Yes | Source hierarchy | Caller snapshot/Back/Forward |

## Deliberate differences and postponed capabilities

- Spending remains first. Existing sidebar, themes and self-hosted fonts remain
  authoritative. Full two-decimal Brazilian monetary labels replace source compact
  figures; original user/security text is not translated or renamed.
- The account selector supports one/all investment accounts. Named portfolios and
  account groups remain postponed, rather than appearing as nonfunctional choices.
- Top Holdings keeps original currencies and ranks separately within each currency;
  it does not pretend native values are converted reporting-currency metrics.
- Exact Money labels do not tween through floating-point intermediate amounts.
  Controls/charts retain the existing reduced-motion policy. Native haptics/device
  sync and upstream broker/health engines are not copied.
- Net Worth Momentum is **Net Worth change**, not investment performance. Velocity
  retains explicit ledger funding and cash/FX reconciliation rather than claiming
  the source's full economic attribution. Loan amortization and full trading/cash/FX
  attribution remain postponed. New properties use the existing asset workflow;
  linking existing debt remains an explicit metadata action.
- Cash/valuation events produce legitimate jumps in history. They are preserved;
  no invented daily observations are added to imitate a reference chart shape.
- Public screenshots are cached official 1440x900 fallbacks and can predate the
  pinned source. The local gallery pairs those references at identical resolution.
  1920x1080, 1280, 834 and 390 captures are source-guided layout checks, not a claim
  of a running upstream app at those sizes. No pixel-identical claim is made.

## Review and reproduction

Build `frontend/` with `npm run build`, then run the browser commands above from
that directory with `DEMO_E2E_PORT=5174` on a free approved port. They refuse an
existing server and create their own migrated databases. Normal demo startup is
unchanged; an existing owned demo is extended through the validated backup path.
The generated gallery is `docs/screenshots/v014-dashboards/index.html`.

No commit, push, merge, tag, release or version increment is part of this task.

### Browser results and live demo

The populated and fresh-database Playwright suites pass. Preset/custom date
selection, metric/sort/name controls, coverage popover, masking, account scope,
property/security/account drilldowns, caller-date restoration and browser
Back/Forward were actually exercised. Native 1440x900 dark pairs cover both
dashboards; an additional cached official Net Worth light reference is paired
with the local light capture. Dark captures use the available Mono font; light
captures use Inter to match their respective official visual references.
1920x1080, 1280, 834 and 390 layouts were checked in both themes.

Neighboring isolated browser suites pass for Holdings/Activities/imports,
Spending/Budgets/Insights/Life Events, Goals/Savings Planner and
Performance/Portfolio Insights. The existing rich Income regression is included
in the dashboard runner: 135 real seeded cash payments, ten sources and
2564.587500 BRL net income, with transparent inner card bodies in both themes.
No financial response is invented to fill a chart. A synthetic 503 is used only
to exercise Retry, followed by a real API response.

The existing live unified demo on loopback 8001 was restarted after identifying
its project-owned launcher. Its new read API and Momentum respond successfully.
All pre-existing account records/balances and manual records compare unchanged;
only the documented collection is added. No data reset or normal database
migration was performed. Refresh the browser to load the rebuilt assets.

Final review should focus on the local comparison gallery and the deliberate
differences above. There are no new financial-engine approval questions. Existing
postponed capabilities remain postponed. The working branch is unchanged and
all changes remain unstaged for review.

### Regressions caught during validation

- Corrected an extra 16px chart gutter and supplied the imported Card's missing
  semantic tokens, which initially produced an unintended square white border.
- Restored independent caller dates/scope after detail-page filters change;
  entering one account from the all-account dashboard no longer changes the
  scope used by Back. Household Net Worth never inherits that investment scope.
- Preserved future/voided observations in the audit tab while excluding them
  from the selected historical valuation. Removed a duplicate detail Back control
  and cleared the empty legacy `position` parameter correctly.
- Kept a prior positive bank balance out of an individual debt's history when
  the account later becomes overdrawn; added an exact regression test.
- Fixed a mobile style-specificity conflict that hid the active third dashboard
  tab despite there being no document overflow. Playwright now checks every tab's
  bounds inside the visible navigation at 390px, in both themes.
- Updated the running demo's stale backend, whose old process returned 404 for
  the new read endpoint; verified existing account/manual records after restart.
