# UX reference audit

Read-only findings recorded on 2026-10-26 and 2026-10-27, before implementation.
These observations explain the design decisions; the [approval draft](UX_REDESIGN_SPEC.md)
is the current proposed implementation contract. Public screenshots and the pinned
source are distinguished below. No fresh running-reference comparison is claimed.

## Evidence baseline

Local evidence: `AGENTS.md`, `README.md`, `docs/UI_FOUNDATION.md`,
`docs/WEALTHFOLIO_PARITY_v0.13.md`, `docs/APPEARANCE_AND_LOCALIZATION.md`,
`docs/PRODUCT_SPEC.md`, `docs/INVESTMENT_ANALYTICS.md`, `docs/BUDGETS.md`,
`docs/NET_WORTH_GOALS.md`, `docs/LIFE_EVENTS.md`, `docs/FIXED_INCOME.md`,
the current frontend, and the screenshot galleries under `docs/screenshots/`.

Upstream source inspected in the separate ignored `.tmp/reference-v013` checkout:
**d86c20194b4b61ad8133ce820739d5ac83f9045e** (2026-10-22).
This is the confirmed canonical revision, not a claim that public screenshots
show the same revision. Capture its rendered reference states before implementing
affected screens; where rendering is unavailable, agree on a specific screenshot
fallback first. Public screenshots supplement the pinned baseline where consistent.
See [ADR 0004](adr/0004-pinned-visual-reference.md).

Source paths below are relative to `apps/frontend/src/` in that checkout:

| Area                           | Source evidence                                                                                                                              | Official feature reference                                                                                               |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Shell and grouping             | `pages/layouts/navigation/app-sidebar.tsx`, `app-navigation.tsx`; `pages/dashboard/portfolio-page.tsx`; `globals.css`                        | [Repository](https://github.com/wealthfolio/wealthfolio/tree/d86c20194b4b61ad8133ce820739d5ac83f9045e/apps/frontend/src) |
| Investments                    | `pages/dashboard/dashboard-content.tsx`, `balance.tsx`                                                                                       | [Investment tracking](https://wealthfolio.app/features/investments-tracking/)                                            |
| Insights                       | `pages/insights/portfolio-insights.tsx`; `overview/insights-dashboard.tsx`, `insights-layout.ts`                                             | [Portfolio Insights](https://wealthfolio.app/features/portfolio-insights/)                                               |
| Performance                    | `pages/performance/performance-page.tsx`                                                                                                     | [Performance dashboard](https://wealthfolio.app/features/performance-dashboard/)                                         |
| Income                         | `pages/income/income-page.tsx`                                                                                                               | [Income tracking](https://wealthfolio.app/features/income-tracking/)                                                     |
| Net Worth                      | `pages/net-worth/net-worth-content.tsx`                                                                                                      | [Net worth tracking](https://wealthfolio.app/features/net-worth-tracking/)                                               |
| Spending, Budgets, Life Events | `features/spending/pages/spending-insights-page.tsx`; `components/budget-editor.tsx`; `components/reports/insights/events-timeline-card.tsx` | [Spending and budgets](https://wealthfolio.app/features/spending-budgets/)                                               |
| Goals                          | `features/goals/save-up/components/save-up-detail.tsx`                                                                                       | [Save-up planner](https://wealthfolio.app/features/goals-saveup-planner/)                                                |

Portfolio Insights and Goals feature-page retrieval encountered access errors;
source and cached official screenshots provide their review evidence. Other
listed feature pages were accessible. No new running-upstream comparison has
been performed in this interview. Existing 1440x900 screenshots support the
initial comparison; running validation belongs to eventual implementation.

Additional Spending source evidence: `features/spending/components/spending-tab-content.tsx`
is the Dashboard view, distinct from Spending Insights; `cash-flow-strip.tsx`
defines its summary metrics. The Dashboard defaults to month-to-date. Selecting
Last Month or an explicit month synchronizes the budget month; broader/custom
ranges select the current budget month. Budget arrows then allow independent
month navigation. The cached May-spending/June-budget screenshot therefore does
not establish the default behavior. Budget Manage opens a focused monthly page;
Life Events are reached through contextual insights links, not a permanent
Dashboard tab. These are reference facts, not yet approved local interactions.

Life Events reference detail behavior is verified in
`features/spending/components/reports/insights/when-where-stage.tsx`: desktop
`EventsTimelineCard` (mobile `EventsCalendarCard`) followed by an inline
`EventDetailPanel` for the selected event. This differs from Finance Tracker's
current detail drawer; event editing uses a separate dialog upstream.

Net Worth reference routing is verified in `routes.tsx` and
`pages/asset/asset-profile-page.tsx`: `/holdings/:assetId` hosts property and
liability detail pages; `pages/asset/alternative-asset-content.tsx` provides a
2:1 chart/details layout. Net Worth
category breakdowns instead open summary sheets, and their item rows do not all
provide direct detail links. Finance Tracker's canonical route shape remains to
be specified; following the interaction pattern does not imply reclassifying
manual assets as investment holdings.
The reference's liability pages also contain mortgage/loan engines; Finance Tracker
must retain its supported manual dated debt observations, not copy unsupported
amortization, payment or renewal actions. Its explicit category-sheet Open details
link is an intentional navigability improvement over upstream's plain item rows.

Responsive reference evidence: `pages/layouts/app-layout.tsx` and
`pages/layouts/navigation/mobile-navbar.tsx` use a floating bottom navigation on
phones, with a 768px desktop boundary and platform exceptions. The reference's
`packages/ui/src/components/ui/dialog.tsx` becomes a scrollable bottom sheet on
phones; tables scroll horizontally. Finance Tracker currently uses a top toolbar
and navigation drawer below 1024px (`frontend/src/index.css`, `app-shell.tsx`).
Retaining that shell would be an explicit mobile deviation, not reference parity.

Appearance evidence: the pinned source's fresh settings default to light mode and
`font-mono` (`crates/core/src/settings/settings_model.rs`); its mono face is
JetBrains Mono (`apps/frontend/src/globals.css`). The inspected Classic dark
tokens (`src/themes/definitions/classic.css`, relative to the reference frontend)
use background `hsl(0 3% 6%)`, secondary/card `hsl(30 4% 11%)`, divider/UI
`hsl(30 3% 15%)`, primary text `hsl(55 10% 79%)` and olive accent
`hsl(72 46% 41%)`. Public screenshots are consistent with mono/dark styling but
do not prove their saved settings. Finance Tracker already defaults to mono/olive/
dark; its current Olive background and brighter chart accent differ from those
reference tokens. Dark-first is an intentional local choice, not the source default.

## Observed gaps, not yet approved changes

1. **Page ownership:** Finance Tracker separates cash-only Overview, Investments,
   Performance and Net Worth, while Investments also contains nine internal views.
   Upstream groups Investments / Net Worth / Spending under Dashboard and
   Overview / Performance / Income under Insights.
2. **Vertical hierarchy:** in the compared 1440x900 investment screenshots,
   Finance Tracker's Accounts heading starts near y740; the reference near y470.
   Demo controls, descriptions, nine tabs and several selector rows push the
   financial content downward. Coordinates are approximate visual observations.
3. **Control consistency:** section tabs, period selectors and scope controls use
   several patterns. Performance has duplicate entry points; Portfolio Insights
   is labeled Allocation. Budget opens a Spending & Budgets workspace.
4. **Financial presentation:** the investment headline exposes up to six decimal
   places and lacks adjacent period-change context. Exact storage does not require
   this headline precision. Balance change must not masquerade as investment return.
5. **Composition:** the main Insights treemap falls below the 900px viewport.
   Income uses a currency strip and two arcs instead of the reference's three
   compact summary cards and 2:1 monthly-history/source layout.
6. **Details:** accounts/securities replace local page content, while goals,
   manual wealth and Life Events use drawers. Detail destinations generally lack
   entity-specific bookmarks. The reference distinguishes pages and sheets.
7. **Reference correction:** Life Events already exists upstream, including a
   date-scaled spending timeline. It is not a wholly Finance Tracker-exclusive UX.
8. **Baseline drift:** current upstream Insights supports an editable widget grid;
   some public screenshots show a different composition. Mixing generations
   without an explicit baseline would make acceptance subjective.
9. **Spending semantics:** upstream's cash-flow strip includes Income, Spending
   and Net, plus Saving when positive. Saving represents transfers to investment
   accounts, and Net subtracts that saving. Finance Tracker's existing net cash
   flow is income minus expenses, excluding transfers. Upstream also includes
   saving in its Where it went composition; that calculation must not be copied
   into Finance Tracker's consumption breakdown.
10. **Budget edit scope:** the current `TargetEditor` in `pages/spending.tsx`
    defaults to ongoing changes for ordinary monthly rows and new targets; only
    existing overrides default to one month. The existing API supports both
    scopes. One-month overrides participate in signed rollover, so their impact
    is not necessarily confined to the selected month's available amount.
11. **Investment headline consistency:** the existing performance API exposes
    `ending_value`, `absolute_gain` (ending minus opening minus net external flows)
    and `twr` for one account/date/currency scope. The current headline's separate
    reporting valuation can use different quote eligibility from the historical
    chart/analytics. A superficially aligned header must not mix current quote-based
    value with historical return figures without explaining the difference.
12. **Ingestion review boundaries:** Gmail already reuses `ImportReview`, but bank
    imports are file batches and Gmail has a message-oriented queue. Brokerage CSV
    uses a separate investment-activity contract. `/reconciliation/candidates`
    aggregates bank/Gmail source records for matching and corrections, including
    completed sources; it is not a pending-approval inbox with equivalent batching,
    filtering, pagination and confirmation semantics.
13. **Statement density:** the current Statements view expands unfinished sessions
    into inline accordions, each containing historical rows. The DTO already has
    exact statement/cleared balances, difference, pending source IDs and after-cutoff
    settlement IDs, but no readiness flag. Zero difference is necessary, not
    sufficient for completion; existing backend guards remain authoritative.
14. **Rule editing is already guarded:** local `pages/rules.tsx` has advanced-field
    disclosure, draft preview invalidation and separate saved-rule history application.
    The pinned reference's `features/spending/components/rule-item.tsx`,
    `rule-edit-modal.tsx` and `rule-form.tsx` use compact summary rows and a focused
    editor (640px desktop maximum). Its regex/taxonomy features are not local
    capabilities and must not be copied as functioning controls. Enabled saved
    rules affect future ordinary entries; history changes require an explicit
    token-validated preview/application. A preview's displayed examples are not
    the full affected set.
