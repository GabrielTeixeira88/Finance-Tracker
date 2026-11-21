# Spending, Budgets and Insights — v0.14 migration

Status: source adaptation implemented; final validation is recorded below.
Unreleased work, not a v0.14 release or a claim of pixel-identical upstream runtime parity.
Reference baseline: `92b4647f74ec51fbbb1a772db4f42ea91060c518`.

## Approved boundaries

- Persist category and budget-group icons/colors as classification metadata.
- Retain monthly category spending targets, effective-month default versions,
  one-month overrides and signed rollover reconstructed from ledger history.
- Recorded income is read-only. Planned income targets and manually entered
  starting rollover balances are postponed by user decision.
- Category hierarchy, group-level buffers/rollover, an event-type catalog and
  saved/multiple-account spending scopes remain postponed.
- Arbitrary-range budget target proration remains postponed. Budget comparisons
  use labeled whole-month targets, spending and drilldowns; selected-period cash
  flow and change analysis remain separate.
- No split-transaction engine, AI, envelope allocation or automatic posting.

## Adaptation

The source Budget editor, category list/treemap, amount input, color/icon pickers,
period/date controls, dashboard composition and budget/event/recent-activity cards
are adapted under `frontend/src/features/spending`. Thin adapters preserve
local hash navigation, TanStack Query and exact decimal API strings. Source
layouts are retained; provider hooks and binary-float financial math are replaced
at the data boundary. The source manifest records 41 Spending-related adaptations;
139 upstream source hashes across the complete manifest match the pinned checkout.

## Screen and workflow coverage

| Surface | Supported source interactions and local integration |
| --- | --- |
| Overview | Source hero/bar geometry, exact delta and cash-flow strip, period/calendar controls, grouped/ranked category list and treemap, recent Activities links, monthly budget pace, event summaries, insight shortcuts and deterministic attention signals. |
| Budget | Native source editor, expandable groups, exact localized inline amount editing, defaults effective from a selected month, monthly overrides and restore, group management/order/icons/colors, advanced category targets/activation/signed rollover, previous-month copy with replacement confirmation, linked refunds. |
| Where I am | Monthly pace versus available target, selected-period spending and after-saving cards, source money-flow Sankey, flat category/group budget table, filters/sorting and month-scoped Activities drilldowns. |
| What changed | Source structured deterministic headline, exact absolute/percentage comparisons, increases/decreases, sparse daily/monthly sparklines, comparison table and preserved payee disclosure for a matching monthly period. |
| When & where | Compact recorded-date/weekday heatmap, source event timeline/calendar and event selection. No hourly evidence is manufactured. |
| Life Event details | Source summary, category/daily charts, peak day, recorded seven-day-before/three-day-after rhythm, event jump controls, edit/delete, explicit linking/unlinking and retained planned amount. Unavailable FX/baselines remain unavailable. |
| Required settings | Existing Settings Categories and deterministic Rules remain authoritative; metadata-only category/group appearance pickers reuse source components. Full Settings migration is separate. |

The runtime entry is the existing `pages/spending.tsx`; it selects the three source
pages only after the report loads. The previous interactive loading fallback is
removed so actions cannot be entered into a disappearing legacy editor. No second
frontend, financial engine or state-management layer was introduced.

## Migration acceptance matrix

“Adapted” means the actual pinned JSX/render or interaction implementation is
retained with local data boundaries, not an unrelated replacement. Visual checks
below are screenshot/source reviews, not approval of pixel-identical runtime parity.
PW denotes the isolated Playwright browser workflow.

| Screen/component | Original source copied | API integrated | Demo populated | Visual parity | Functional tests |
| --- | --- | --- | --- | --- | --- |
| Spending Overview | Adapted page composition | Spending workspace + transactions | Yes | Paired 1440 dark; wide/phone reviewed | Unit + PW |
| Cash Flow | Adapted strip | Exact income/spending/saving projection | Yes | Source strip layout; full BRL labels retained | Unit + financial PW |
| Category Treemap | Extracted source renderer | Category totals/styles | Yes | Map capture reviewed | Unit + PW map |
| Category Breakdown | Adapted ranked/grouped renderer | Exact category/group totals | Yes | Overview pair reviewed | Unit + PW drilldown |
| Budget Progress | Adapted source budget card | Existing monthly report/pace | Yes | Overview pair reviewed; forecast differs as disclosed | API + PW |
| Recent Activity | Adapted source rows | Existing transaction list | Yes | Desktop capture reviewed | Unit + PW route |
| Budget Editor | Adapted full supported editor | Workspace/target services | Yes | Paired light 1440; dark/phone reviewed | Unit + PW six-decimal edit |
| Budget Groups | Adapted editor/dialog | Existing group API + appearance metadata | Yes | Source group rows reviewed; dialog not independently reference-paired | API + unit editing |
| Rollover | Adapted category controls | Existing signed carry chain | Positive/negative | Editor/advanced details reviewed | API + unit guards |
| Monthly Overrides | Adapted source controls | Existing override/restore/copy APIs | Yes | Budget/detail captures reviewed | API + unit + PW override |
| Where I Am | Adapted source cards/table/Sankey | Period projection + labeled monthly targets | Yes | Cached Insights pair/source review | Unit + PW |
| What Changed | Adapted headline/cards/table | Exact current/prior history | Yes | Source-guided capture review | Unit + PW |
| When & Where | Adapted stage composition | Existing event associations + daily spending | Yes | Source-guided desktop/phone review | API + PW |
| Heatmap | Source card/cell pattern, truthful date-grid adaptation | Recorded dates/weekday totals | Yes | Compact date cells reviewed; hours omitted | Unit + PW rendering |
| Life Events Calendar | Adapted source calendar | Existing event metadata/costs | Yes | Phone captures reviewed | API + PW rendering |
| Life Events Timeline | Adapted source SVG bands/history | Exact event/period summaries | Yes | Desktop capture reviewed | Unit + PW selection |
| Event Details | Adapted source detail panel | Existing costs/FX + recorded-date comparison | Yes | Detail capture reviewed | Projection unit + PW linking |
| Event Editing | Existing exact form in source dialog | Existing metadata APIs | Yes | Dialog source reviewed; not independently reference-paired | PW create/edit/delete |
| Category Drilldowns | Source interactions, local route adapter | Existing Activities filters | Yes | Route/ledger checked | Unit + PW |
| Supporting settings/dialogs | Source pickers + existing Categories/Rules/Refunds | Existing APIs; appearance table | Yes | Source pickers/detail reviewed; full Settings parity outside scope | API + form tests |
| Mobile variations | Source responsive layout with local header wrap | Same APIs | Yes | 390/768 captures; no page overflow | PW drawer navigation + containment |

The additional read-only `/api/spending/workspace` response separates household
income/spending from explicit transfers into/out of savings and investments.
`net_flow` retains income minus expenses; `after_savings` separately subtracts
net saving transfers. Refunds reduce spending on the credit date. Currencies
remain separate. `/api/budgets/workspace` exposes existing reports plus effective
configurations for an editor without flattening away future versions or overrides.

The spending projection includes sparse recorded category `daily_history` and
monthly history for sparklines. Empty dates inside the report window represent
zero recorded activity; future dates are excluded. Saving destinations expose
gross outward transfers, while returns are separate inflows, so the Sankey balances
without misclassifying either as income/consumption. A deficit is visibly labeled
as the funding shortfall, not posted as fictitious income.

`sqlite_0018` adds only `classification_appearance`, with exactly one category or
budget-group owner. Foreign keys and financial deletion guards remain intact.

## Demo content

The owned unified demo receives a repeat-safe content marker. Existing edits and
saved styles are preserved. Added household examples include four budget groups,
category appearances, dated targets/overrides, four linked Life Events, an
uncategorized bicycle repair (90 BRL) and a linked partial refund (35 BRL).
Fresh checking cash therefore changes by -55 BRL through real posting services.
Official market observations and investment postings are untouched. Personal and
archived workspaces are excluded from this extension.

## Validation

The complete backend suite passes **523 tests**. Three existing SQLAlchemy
execution-options warnings originate in the older seed helper. Backend Ruff lint
and formatting checks pass (186 files).

The complete frontend suite passes **300 tests across 67 files**. The final
inclusive comparison-label correction is additionally covered by **31 focused
Spending tests**. API range boundaries remain exclusive; display labels use the
last included day. A further targeted regression verifies neutral, explained
unavailable timeline comparisons and retained keyboard selection. ESLint,
TypeScript/production build and Prettier checks pass.
The build still reports the existing large-shared-chunk warning; no financial
dependency or architecture change was made to suppress it.

The isolated browser runner is `node scripts/demo-e2e.mjs --spending-migration` from `frontend`.
It owns a fresh demo root and checks API balances before/after target, metadata and
event mutations. It never opens a saved or personal database. Local screenshot
evidence lives in `docs/screenshots/v014-spending-budgets/index.html` and is ignored.

The workflow verifies category-to-Activities navigation, the treemap and date
picker, a six-decimal monthly override, default-plan navigation, all three
Insights stages, event creation/editing/linking/unlinking/deletion, unchanged
ledger balances and dark/light rendering. Layout containment is checked at
1440×900, 1920×1080 and widths 1024/768/390. Sankey labels are checked against
their actual SVG bounds with the selected application font and the upstream
11px metadata scale. Phone headers wrap their controls rather than reducing
titles to zero width.

The final Spending browser run passes, including phone drawer navigation back to
the dashboard and all event lifecycle actions. The existing Holdings/Activities
browser regression also passes after the shared typography/category-form changes:
account creation, income/expense/atomic transfer (5,300/2,500), review, imports,
investment voiding, manual valuation correction/audit and phone layouts. Existing
accounts retain their exact starting balances. This is functional regression
evidence, not a new claim of visual approval for unrelated migrated screens.

Tests cover exact large/localized input, target version/override preservation,
source navigation/date controls, recoverable empty/loading/error states, signed
cash-flow/refund projections, gross savings and returns, immutable balances,
category appearance foreign keys, demo repeatability/reset/isolation, deterministic
narratives, out-of-window event refunds and incomplete event coverage.

## Practical differences

- Copy supports the previous month, matching the existing atomic API. Replacement
  requires confirmation. Individual override restore is available; no multi-write
  reset-all command is introduced.
- Income panels show actual receipts, never fictitious planned-income values.
- Budget pace uses the existing elapsed-day projection. It is not labeled as a
  seasonal historical forecast.
- Negative net refunds retain signed labels; a positive-only treemap must not
  imply that negative composition is a complete allocation.
- The existing shell, Spending-first tab order and exact two-decimal BRL convention
  remain. The reference sometimes abbreviates money; Finance Tracker does not.
- Event comparisons are descriptive recorded spending, not a causal cost model;
  zero/missing baselines do not yield invented percentage lifts. Future event days
  are not labeled observed spending. Negative refund histories retain signed charts.
  The timeline band's amount is a comparison against non-event days, not the
  event's total cost. When no baseline exists it stays a neutral dash with an
  accessible explanation; recorded cost remains available in event details.
- The upstream runtime was unavailable. Visual comparison uses approved cached
  official Overview/Insights/Event images and the official Budget screenshot at
  1440×900, cross-checked against the pinned source. Responsive 1920×1080 checks
  are source-guided rather than an identical screenshot pair. No claim is made
  that the upstream app was run locally, and reference images are not shipped.
