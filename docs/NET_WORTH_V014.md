# v0.14 Net Worth source adaptation

Current continuation: [dashboard completion](DASHBOARD_MIGRATION_V014.md).
The November 9 dashboard request restores Momentum and liability actions and
implements shared URL periods. It supersedes the earlier removal/deferral notes
retained below as implementation history. Manual asset links now reuse the migrated
Holdings detail/editor rather than creating a second editing workflow.

Status: implementation and automated/browser validation complete; awaiting visual
review. Unreleased; canonical version remains 0.13.0.
Upstream baseline and permanent process: [frontend workflow](FRONTEND_V014_WORKFLOW.md).
Feature page: https://wealthfolio.app/features/net-worth-tracking/.

## Technical comparison

| Concern | Upstream, under `apps/frontend/src/` | Finance Tracker |
| --- | --- | --- |
| Composition | `pages/net-worth/net-worth-content.tsx` | `pages/wealth.tsx` |
| Hero chart | `pages/net-worth/net-worth-chart.tsx` | `components/portfolio-value-chart.tsx`, `WealthChart` |
| Breakdown | `pages/net-worth/components/breakdown-table.tsx`, `composition-bar.tsx` | Existing category/component tables |
| Category drawer | `pages/net-worth/components/category-detail-sheet.tsx`, `category-trend-chart.tsx` | `DetailDrawer`, category constituents and manual-position details |
| Insights | `velocity-card.tsx`, `utils.ts` in the Net Worth directory | Not previously implemented |
| Attention | `pages/net-worth/components/net-worth-attention.tsx` | Existing dated observations and property/debt edit APIs |
| Shared card | `components/dashboard-card.tsx` | Shared primitives and semantic appearance tokens |
| Data | `hooks/use-alternative-assets.ts`, upstream command/settings providers | `lib/wealth-api.ts`, `app/wealth.py`, `wealth_routes.py` |

The upstream card, grid, collapse, chart and drawer organization can be adapted.
Replace upstream package aliases, command hooks, routing, number conversion and
platform features. Keep Finance Tracker's exact strings, date/reference policies,
historical quote/FX eligibility, responsive shell, themes and accounting guards.
AGPL-3.0 source attribution remains applicable; no branding or proprietary images
are shipped. Existing manual-position CRUD/corrections/closing remain available.

## Missing-capability decisions

The user approved all five additions on 2026-11-04:

1. Momentum was initially approved, then removed completely at the user's request
   on 2026-11-05: no card, calculations, API field, styles or translations remain.
2. Velocity/monthly pace: exact read-only change drivers, including explicit FX
   and coverage handling. Never infer investment return from contributions.
3. Category history, changes and drawer trends.
4. Attention for manual valuations older than 90 days and optional mortgage links.
5. Balance masking, including tooltips.

Shared period synchronization with Spending and Investments is explicitly postponed
until those dashboard tabs are adapted (user decision, 2026-11-04). Net Worth
keeps URL-based local period selection; financial filters are not persisted in
localStorage. Native device haptics are omitted under
the platform-specific scope boundary. No AI, allocation targets/rebalancing,
retirement/FIRE or tax-aware funding is introduced.

## Financial adaptation requirements

Net worth continues to count brokerage cash/holdings once through the existing
valuation reader. A Caixinha reserved for a goal remains one financial asset.
Investment account categories retain their brokerage cash rather than subtracting
it using a present-day allocation fetched for a historical screen.

Velocity must reconcile to exact closing-minus-opening net worth. Ledger funding
includes recorded openings and net ordinary postings, not just bank deposits;
internal transfers cancel. Investment gains use the existing scope-aware external
flow reader. Manual asset changes include additions/disposals and valuation/FX
changes; manual liability balance changes are not proof of principal repayments.
Cash/FX reconciliation must remain explicit rather than silently being called a
contribution or investment gain. Estimated redemption taxes never replace gross
fixed-income value. Insufficient coverage withholds affected metrics.

## Visual evidence

Official public `networth/dashboard.png` was downloaded and visually inspected at
1440×900. It shows the hero, 280px chart, interval strip, 2:1 breakdown/insights
grid and card hierarchy. Reference files and captures stay under ignored local
directories. A screenshot is not evidence of a running pinned upstream application.
Local paired gallery: `docs/screenshots/v014-net-worth/index.html` (ignored).
The official image is paired with a naturally scrolled Finance Tracker capture at
1440 by 900, light mode/Inter. The raw capture also shows the existing demo
banner. No elements were hidden to construct the aligned comparison. Dark mode
at 1440 by 900, 1920 by 1080 and mobile at 390 by 844 are source-guided checks;
there is no matching current official dark/wide screenshot or running upstream
application in this validation.

Adapted measurements: 32px normal-weight primary balance, 280px hero chart,
160px drawer chart, zero chart margins, source gradient stops and monotone line,
centered range strip, 40px desktop breakdown gutter, three-column grid with left
span two/right span one and 48px gap, 16px card padding, compact category rows.
Dimensionless power-of-ten coordinates retain source-style nice-axis geometry
without converting monetary values to binary floating point.

Remaining intentional differences:
- Preserve the approved Spending-first shell, demo disclosure, existing fonts and
  palettes; no copied logos or proprietary graphics. Existing card surfaces/category
  colors differ from the public image's theme.
- Real local ledger/manual valuations produce a stepped curve and fewer categories,
  not the reference portfolio's figures/curve. Missing observations remain gaps.
- Keep period controls and original management workflows in disclosures;
  custom dates use native date controls rather than upstream's calendar popover.
  Currency selectors were subsequently removed by user request; existing reporting
  defaults, original currency labels and explicit bookmarks remain supported.
- User follow-up standardizes every financial amount to two decimal places with
  period grouping/comma decimals, including the hero, rows, percentages, titles
  and tooltips. Whole/abbreviated source metrics are deliberately overridden.
  Backend/API precision remains exact; privacy masks the formatted labels.
- Five exact change drivers replace four upstream drivers when cash/FX requires
  a separate reconciliation. Labels describe what is actually derivable.
- Loading keeps the application's accessible loading state rather than an identical
  upstream skeleton. Haptics and cross-dashboard period synchronization are excluded.

## API and calculation contract

`GET /api/net-worth/history?start=YYYY-MM-DD&end=YYYY-MM-DD&currency=BRL&details=true`
adds per-point category magnitudes, investment/manual asset/manual debt totals and
read-only `insights`. Omitting `details` preserves the previous API response.
No migration, editable aggregate, extra cash posting or persistent analytics cache
is added.

The details reader can inspect prior history up to the existing 3,660-day bound.
Momentum and its previous-period/monthly-bar projections have been removed.
The details reader retains prior coverage only for the monthly-pace trailing average.

Monthly pace normalizes an observed change by `(365.25 / 12) / calendar_days`;
it is not a forecast. Its five drivers are net ordinary ledger funding/openings,
investment value change minus scope-aware investment flows, manual asset change,
negative manual debt change, and the exact residual cash/FX/settlement difference.
Internal transfers cancel. Investment gains include investment FX; manual debt
change is not evidence of principal repayment. Settled drivers reconcile exactly
to total change. Missing endpoints or required flow-date FX withhold the bridge.
A trailing 365-day average is shown only with a recorded baseline and endpoint
coverage; pace multiples require same-signed, nonzero values and a selected
interval shorter than 335 days. None of these are TWR or cash-flow income.

ALL uses the first recorded financial date inside the ten-year bound. Other
shortcuts use rolling dates with clamped month ends; YTD begins January 1. A period
before recorded history cannot supply an invented prior pace. Dates and currency
remain in the Net Worth hash route, independent of other dashboard tabs.

Attention is evaluated at the selected end date, not the execution clock. Only
included manual positions with actual observations older than 90 days are stale.
Mortgage linking uses the existing metadata API and same-currency owned properties.
The investment drawer reuses dated allocation, retaining brokerage cash once;
it withholds composition if allocation quality or the exact total disagrees.

Privacy is temporary in-memory state scoped to Net Worth. It masks money, ratios,
exact titles and tooltips without modifying queries/calculations. It is a screen
sharing aid, not access control; chart shape and account names remain visible.

## Validation and reproduction

- Backend: **481 passed**, including six new exact-projection tests. Three existing
  SQLAlchemy warnings remain in synthetic seed tests.
- Frontend: **230 passed across 40 files**; ESLint, Prettier and TypeScript/production
  build pass. Build retains the existing large-chunk advisory.
- Ruff lint/format: pass (161 Python files).
- Populated Playwright: source chart, category collapse/drawer, investment classes,
  privacy/tooltip, rolling shortcuts, mortgage association, valuation update,
  unchanged account balances, desktop widths, mobile overflow/navigation pass.
- Existing full demo browser regression: pass, including navigation, transaction/
  import/reconciliation workflows and owned-demo reset.
- Empty Playwright: fresh migrated SQLite, empty history without fake chart,
  missing valuation, retry after simulated transport failure, mobile layout pass.
- Browser fixtures own temporary workspaces. The populated test adds fictional
  property/vehicle/mortgage observations through existing APIs to exercise all
  categories. Its baseline is BRL 695,890.182600 (BRL 527,890.182600 existing demo
  plus 340,000 additional test property plus 38,000 test vehicle minus 210,000 mortgage). No normal
  financial database or user-running service is touched.

From `frontend`, after `npm run build`:

```powershell
$env:DEMO_E2E_PORT='5174'
node scripts/demo-e2e.mjs --real-market-only --net-worth
node scripts/net-worth-empty-e2e.mjs
```

Run browser commands sequentially; both refuse an occupied port. Cached official
reference imagery is optional for financial browser checks; without it visual
pairing must be prepared separately. Captures and temporary databases stay ignored.
No publishing or version bump was performed; subsequent feature work waits for
Net Worth visual approval.


User follow-up: add a house/car to the public demo and remove the Liabilities
management/chart option. Existing liability valuation and historical records are
preserved; menu removal is not debt forgiveness. See the dataset revision 3 notes
in DEMO.md. Existing explicit position links remain compatible.


Follow-up validation: 34 real-market/Net Worth backend tests and all 231 frontend
tests pass. Lint, format, production build and the populated browser suite pass.
The normal historical demo is now BRL 527,890.182600 at its reference date, including
BRL 378,000.00 of manual assets. `house-car-demo-1440.png` captures the unaugmented
public baseline; other browser captures include explicit test-only manual records.


Momentum removal validation (2026-11-05): 20 relevant backend financial/Net Worth
tests and 239 frontend tests pass. The browser verifies its absence from both the
UI and details API while monthly pace, category drawers, privacy, valuation edits
and transfers/account balances remain intact. The running demo was restarted in
its existing scenario without resetting financial data. Sidebar appearance
ordering is documented in APPEARANCE_AND_LOCALIZATION.md.
