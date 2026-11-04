# UX redesign decision register

All 40 decisions were confirmed in the 2026-10-26 to 2026-10-27 interview.
Implementation is not authorized by this record. See [the approval draft](UX_REDESIGN_SPEC.md).

Entries retain their interview context: details described as unresolved in an earlier
entry may be settled by a later entry or proposed in the consolidated draft.

**Q1 — Confirmed, with amended order (2026-10-26): Dashboard ownership.**
One Dashboard replaces the current separate cash-only Overview, Investments
overview and Net Worth overview destinations. Modes are **Spending / Investments /
Net Worth**, with Spending shown first. Existing cash/account information remains
available in the appropriate views. The user explicitly changed the reference's
investment-first ordering to spending-first. See
[ADR 0001](adr/0001-unified-spending-first-dashboard.md).

**Q2 — Confirmed (2026-10-26): analytical workspace ownership.** One Insights
sidebar destination contains Overview / Performance / Income, following the
inspected reference. Overview owns portfolio composition/exposure and replaces
the ambiguous Allocation label. Performance and Income retain their distinct
financial meanings. Remove duplicate analytical entry points from the long
Investments tab row while preserving bookmarks and contextual links. See
[ADR 0002](adr/0002-unified-investment-insights.md).

**Q3 — Confirmed (2026-10-26): Accounts in primary navigation.** Retain Accounts
as a dedicated sidebar destination for checking, savings, cash, credit cards and
investment accounts. This is a deliberate addition to the inspected reference's
primary navigation, justified by Finance Tracker's everyday banking workflows
and spending-first entry point. It costs one sidebar row but avoids making the
account directory discoverable only through dashboard summaries. Account-detail
layout, sidebar order and Holdings/Activities placement remain separate decisions.

**Q4 — Confirmed (2026-10-26): shared Activities destination.** Adopt one
Activities sidebar destination with distinct Transactions and Investment Activity
views, replacing the current Transactions destination and Investments / Activity
entry point. This groups navigation, not ledger records or posting services:
ordinary transactions, linked transfers and investment activities retain their
existing types, financial behavior and editing safeguards. The trade-off is a
less immediately familiar name for everyday transactions and one view selection
when switching between banking and investing. Placement of Scheduled, Imports,
Gmail review and Reconcile remains unresolved; this decision does not approve
a long combined tab row or a merged financial table.
See [ADR 0003](adr/0003-shared-activities-distinct-financial-records.md).

**Q5 — Confirmed (2026-10-26): Holdings in primary navigation.** Give Holdings
its own sidebar destination, as in the inspected reference, replacing its current
Investments subtab as the canonical position-list destination. Dashboard /
Investments remains the summary; Holdings is the detailed position directory;
Activities / Investment Activity is movement history. This adds a sidebar row
but avoids burying position inspection inside the dashboard. Brazilian fixed-income
presentation, detail routing and the final sidebar order remain separate decisions.

**Q6 — Confirmed (2026-10-26): complete sidebar order.** Dashboard, Accounts,
Activities, Holdings, Insights, Goals; Settings pinned near the bottom. This keeps
the reference's compact navigation pattern and approved analytical groupings but
puts everyday account/transaction work before investment inspection and analysis.
The trade-off is departing from the reference's investment-first ordering. Existing
Reports preview remains accessible through a secondary location to be decided;
no feature removal is implied. Budget, Life Events and operational tool placement
within the approved destinations still require their own decisions.

**Q7 — Confirmed (2026-10-26): desktop sidebar default.** Use the inspected
reference's 70px collapsed icon rail by default, with an explicit toggle to a
220px expanded sidebar and a remembered appearance preference. Collapsed items
must have visible labels on hover and keyboard focus plus accessible names.
Keep normal/demo appearance preferences separate. This favors reference geometry
and content width at the cost of reduced first-use label discoverability; users
can expand it. Mobile drawer behavior is a separate decision.

**Q8 — Confirmed (2026-10-26): canonical reference version.** Pin the inspected
Wealthfolio revision `d86c20194b4b61ad8133ce820739d5ac83f9045e` for this redesign,
using its rendered screens as the visual baseline and its source for interactions.
Public feature screenshots support the review where consistent; they do not
silently override conflicting layouts from the pinned revision. Capture reference
states at the agreed comparison resolutions before implementing affected screens.
If a screen cannot be rendered, explicitly agree on an available screenshot
fallback before coding that screen. Approved Finance Tracker deviations and
financial safeguards take precedence. This avoids mixing design generations but
requires reference setup and freezes the baseline rather than tracking upstream
changes throughout implementation. No new reference captures have yet been made.
See [ADR 0004](adr/0004-pinned-visual-reference.md).

**Q9 — Confirmed (2026-10-26): durable entity detail navigation.** Account,
holding and goal details open as bookmarkable full pages within the persistent
shell. Reserve drawers for quick edits and contextual drilldowns rather than
using them as the sole home for these detailed views. Preserve the originating
list's filters and position when returning. This provides reference-like room for
history, metrics and planning while costing a page transition for inspection.
Life Event and manual asset/debt details remain separate decisions; this does not
mandate replacing every existing drawer or introducing new financial calculations.
See [ADR 0005](adr/0005-bookmarkable-financial-details.md).

**Q10 — Confirmed (2026-10-26): monetary display precision.** Format headline
balances, totals and ordinary money columns using each currency's standard minor
unit precision (two decimal places for BRL/USD/EUR), while preserving exact source
values and making them available in accessible details. Keep quantities and unit
prices on separate precision rules; do not force them to two decimal places.
Formatting is a presentation operation only: aggregate exact values before display
rounding, never round stored values or convert money to binary floating point.
The trade-off is that sub-cent changes are not visible in everyday summaries and
individually rounded rows can differ from the correctly rounded aggregate. Exact
detail disclosure and a clear rounding explanation must remain available.

**Q11 — Confirmed (2026-10-26): demo chrome.** Replace the dedicated full-width
demo toolbar with a persistent, text-labeled **Demo** control in the existing
header, opening a menu for the guided tour, scenarios and reset. Keep the synthetic
environment unmistakable, show fictional-profile/date context in the menu, and
preserve explicit reset confirmation and all isolation safeguards. The control
must remain accessible on every demo screen, including narrow layouts; normal
mode has no demo control. This restores vertical space without hiding demo identity,
at the cost of an extra action to reach demo tools. Detailed header placement must
be verified against the pinned visual baseline rather than adding another row.

**Q12 — Confirmed (2026-10-26): Spending cash-flow strip.** Retain the reference's
compact strip layout but show **Income / Spending / Net cash flow**, omitting its
Saving metric for this redesign. Net cash flow keeps Finance Tracker's existing
income-minus-expenses calculation and shared refund classification; transfers
are not spending and do not reduce this total. Category spending composition
continues to exclude transfers. This is a visible, explicit semantic deviation
from upstream, whose Saving represents investment transfers and whose Net deducts
them. The trade-off is losing an at-a-glance investment-contribution figure here;
those movements remain inspectable through Activities. Do not introduce a new
contribution metric or redefine the current cash-flow calculation to fill the slot.

**Q13 — Confirmed (2026-10-26): Spending period and budget-month relationship.**
Follow the pinned reference's synchronize-then-browse behavior. Open on This month
(month-to-date); choosing a specific month sets both spending and budget to that
month. Broader/custom date ranges set the budget summary to the current month,
with an explicitly labeled budget month and independent previous/next controls.
Changing that budget month does not change the spending-chart period. Normal mode
uses the application's current date; demo mode respects its existing deterministic
as-of date. This preserves reference flexibility but can show different periods
on one screen, so the two labels must remain unambiguous. Do not imply that a
single month's target is a budget for a multi-month spending range. Availability
of broader ranges in local services must be verified before implementation; no
new budgeting calculations are approved by this navigation decision.

**Q14 — Confirmed (2026-10-26): contextual Spending navigation.** Remove the
permanent Overview / Budgets / Insights / Life Events tab row from the Spending
dashboard. Reach the focused monthly budget page through **Manage budget** beside
the monthly budget summary; reach Spending Insights and Life Events through
clearly labeled contextual links in their relevant dashboard sections. Keep these
entry points available in empty states, preserve existing deep links, and provide
a clear route back to Spending. This follows the reference's overview-to-drilldown
pattern and reduces header depth, at the cost of less globally visible navigation
between spending tools. Do not hide these destinations solely behind conditional
data rows or an overflow menu. Their detailed page and drawer layouts remain open.

**Q15 — Confirmed (2026-10-26): monthly target editing default.** When editing
an existing target from the monthly budget page, default to **This month only**,
using the existing month override. Make **Update ongoing plan** a separate explicit
choice, explaining its effective month, next saved version boundary and override
precedence. Keep default-plan setup distinct; new-target setup behavior is not
settled by this existing-row edit decision. The trade-off is an additional choice
for habitual plan changes and potentially more monthly overrides, in exchange
for avoiding an accidental ongoing change from a monthly screen. Clearly warn
that one-month target adjustments can alter later derived rollover when enabled;
do not promise they have no downstream effect. Preserve all existing version,
override, complete-configuration and rollover semantics.

Implementation constraint from the existing model: monthly overrides replace
amount, active state, rollover, group and order together. An amount-only editor
must preserve the other fields. Saving an ongoing version does not remove an
existing override; explain this precedence and retain the explicit Restore monthly
default action. No immutable target audit or past-month lock is being introduced.

**Q16 — Confirmed (2026-10-26): Spending Insights structure.** Follow the pinned
reference's three-stage view: **Where I am / What changed / When & where**.
Where I am contains spending pace, cash flow and category breakdown; What changed
contains period/category comparisons; When & where contains supported daily/weekday
patterns and Life Events. Use existing deterministic data and clearly labeled
projections, not AI or unsupported analytics. The local ledger stores dates rather
than transaction times, so do not copy the reference's hour-of-day heatmap or
fabricate geographic information. Preserve selected-period context and deep links
while moving between stages. The trade-off is more navigation than an all-in-one
report, in exchange for a clearer sequence and less visual overload. Detailed
comparison windows and event interactions remain unresolved.

**Q17 — Confirmed (2026-10-26): Life Events timeline and detail pattern.** Follow
the reference's date-scaled timeline over daily spending, with overlap lanes and
the selected event's details displayed inline underneath. Replace the large
detail drawer as the primary inspection experience; retain dialogs/drawers for
editing or linking transactions. The timeline selection must be keyboard-accessible
and keep the selected event visibly identified. Show existing actual cost, category
breakdown and linked activity without fabricating upstream baseline/lift metrics.
Daily spending supplies context, not automatic attribution: event costs still
derive only from explicit purchase links and their refunds. This keeps event
inspection in its time context but makes the page longer than a drawer-based
workflow. Mobile representation and exact event URL behavior remain to be resolved.

**Q18 — Confirmed (2026-10-26): Investments headline semantics.** Display the
selected period's ending **Portfolio value**, with compact **Period gain/loss**
and **Return (TWR)** underneath. Reuse the existing performance API's exact
`ending_value`, `absolute_gain` and `twr` for the same account scope, dates and
reporting currency, consistent with the chart's historical valuation basis.
Do not substitute raw balance change for gain or use a newer current-quote total
beside historical returns. The value chart still includes contributions and
withdrawals; gain/return metrics account for external funding under the existing
documented conventions. Preserve each metric's availability and reason codes;
missing coverage is not zero, and a valid ending value need not imply valid TWR.
The trade-off is that the summary may show unavailable historical metrics even
when a separate current valuation exists. Keep the existing calculation methods,
including end-of-day-flow TWR; do not adopt upstream arithmetic merely for parity.

Implementation evidence: `investment_analytics.py` exposes gain and TWR together
with historical valuation points; `PortfolioHistory` currently mixes separate
current/historical endpoints. Reuse the consistent historical payload and shared
month-end-clamped period boundaries. Fixed-income accrual can contribute to value
and gain but is not paid income; do not label aggregate gain as after-tax liquidation
profit or deduct fees/taxes again in presentation.

**Q19 — Confirmed (2026-10-26): Investments lower-section composition.** Follow
the reference's approximately **2:1 Accounts / Top holdings** layout immediately
below the value chart and range controls. Use compact account rows and a short
holding list with links to their canonical full views; keep detailed composition
in Insights rather than adding another dashboard chart. This favors account-level
inspection and limits the amount of holding detail shown directly on the dashboard.
Respect the selected scope/date/currency and expose incomplete valuations instead
of silently ranking incomparable amounts. Exact account grouping, holding count
and any reference goal-preview widget remain to be resolved in their relevant
screen decisions; no tax-wrapper account categories are implied.

**Q20 — Confirmed (2026-10-26): Portfolio Insights layout customization.** Begin
with a fixed responsive arrangement matching the pinned reference's default
composition/exposure hierarchy, rather than implementing its drag/resize/widget
visibility editor. Remove excluded allocation-target and AI widgets, if present,
and deliberately reflow the supported content without empty placeholders. Ordinary
scope filters, chart interactions and drilldowns remain available. This gives up
user-customized widget placement in exchange for a consistent, measurable design
and avoids a separate layout editor/persistence feature. Precise supported widgets
and their resulting arrangement still require screen-level agreement.

**Q21 — Confirmed (2026-10-26): Income currency presentation.** Show one selected
original payment currency at a time across Income's summary, monthly chart and
source ranking, preserving the existing income API contract. Keep a compact
currency selector and a visible indication when other payment currencies exist;
do not imply the selected-currency subtotal covers every payment. This trades a
single converted all-currency income total for clear native-currency reporting
without adding FX aggregation during a UI redesign. Keep original payment values
available in details, never sum unlike currencies, and do not let an investment
reporting-currency selection silently relabel original amounts. It remains possible
to match the reference's summary/chart/source geometry with this explicit deviation.

**Q22 — Confirmed (2026-10-26): Income headline basis.** Make **Net income
received** the primary figure and use the same net basis in the monthly chart
and source rankings. Preserve accessible gross income, recorded fees and withholding
taxes in details. This retains the existing local API's paid-income classification
and net presentation, explicitly distinguishing cash received from gross statements,
estimated yield and unrealized accrual. Unredeemed fixed-income interest and
redemption principal are not added to this income total. The trade-off is that
the headline may differ from a provider's gross-income statement; show the exact
gross-to-net breakdown rather than inferring taxes or silently mixing bases.

**Q23 — Confirmed (2026-10-26): Performance hierarchy.** Make the existing
time-weighted return series the dominant comparison chart, following the reference's
large-chart layout, with compact supporting metrics rather than equal-weight KPI
boxes. Retain **Annualized XIRR** as a separately labeled metric, together with
existing period gain/loss, ending value and net external funding. TWR and XIRR
are not interchangeable; do not plot annualized XIRR as the daily comparison
series. This emphasizes investment results separated from external funding while
giving the user's cash-timing-dependent return less visual prominence. Preserve
metric-specific unavailable reasons and explicit price-return versus total-return
benchmark labels. Benchmark selection/comparison count remain a separate decision;
no unsupported performance metrics are implied by the reference layout.

**Q24 — Confirmed (2026-10-26): manual asset/debt detail navigation.** Extend
the bookmarkable full-page pattern to manual assets and liabilities, with dated
value history and supporting details. Retain category-summary sheets and quick
edit dialogs, with a clear Open details link from a summary to the entity page.
Preserve originating Net Worth period/filter context on return. This replaces
the current large detail drawer as the sole inspection surface, giving history
and observations room at the cost of a page transition. Do not introduce cash
postings, inferred loan payments, fabricated history or new asset classifications;
manual assets/debts remain distinct from investment holdings.
This extends [ADR 0005](adr/0005-bookmarkable-financial-details.md).

**Q25 — Confirmed (2026-10-26): Goals projection assumptions.** Retain the current
contribution-only projection and omit the reference's expected-return input for this
redesign. Show actual progress, required trajectory and a clearly labeled monthly
contribution scenario in the reference-inspired full-page layout. Do not introduce
compounding assumptions, promised returns or automatic contributions through a
visual adaptation. The trade-off is no investment-growth what-if scenario; goal
progress remains based on existing eligible savings and the hypothetical path on
planned contributions only. Retirement/FIRE and tax-aware funding remain excluded
regardless of this decision.

**Q26 — Confirmed (2026-10-26): Brazilian fixed-income placement.** Include CDB
and Tesouro Selic positions in **Holdings**, with a Fixed income filter and
specialized contract detail pages following the shared holding-detail geometry.
Keep dedicated **Record subscription** and **Record redemption** actions reachable
from the relevant fixed-income view/detail, using existing services and safeguards;
do not substitute generic Buy/Sell or imply that the app executes a broker order.
The resulting movements remain visible in Investment Activity. Preserve existing
comparison tools and deep links; their precise placement and dated-index maintenance
location remain to be resolved. This avoids a separate product section but requires
type-aware rows/details rather than forcing contracts into ticker-centric fields.
Do not merge distinct contracts or change immutable terms merely to simplify display.

**Q27 — Confirmed (2026-10-26): dated-index maintenance placement.** Move
**Record dated index** into **Settings / Market data**, alongside existing market
data configuration, rather than keeping it in the main fixed-income toolbar.
When a holding cannot be valued because required dated observations are missing,
show a clear reason and a contextual link to the relevant maintenance view, carrying
the missing index/date context and providing a return to the holding. This keeps
routine inspection focused but adds a navigation step for manual data maintenance.
Do not imply automatic downloads, infer missing factors, use fictional observations
for real contracts, or weaken source and date validation. Existing manual quote
workflows and comparison tools are not removed by this placement decision.

**Q28 — Confirmed (2026-10-26): Imports and Gmail review organization.** Keep
Imports and Gmail review as separate focused tools under Activities, reached through
clearly labeled actions rather than separate primary-sidebar entries or another
long permanent tab row. Reuse common review presentation while retaining each
workflow's source/batch context, readiness, preview tokens and explicit confirmation.
Keep investment CSV review distinct from ordinary transaction candidates and route
it through its existing activity service. This means switching tools to review
different sources, but avoids introducing a new unified-inbox aggregation and bulk
posting contract during the redesign. Do not repurpose reconciliation as ingestion
approval or add a cross-tool Approve all action. Precise action placement and
review-screen composition remain open.
See [ADR 0006](adr/0006-preserve-ingestion-review-boundaries.md).

**Q29 — Confirmed (2026-10-26): shared review layout.** Use a dense candidate
table/list with a selected-row inspector alongside it on desktop for Imports and
Gmail review, adapted to each workflow's batch/message context. The inspector
separates original source evidence, proposed values, existing-ledger matches and
validation/decision controls. Preserve visible row statuses and a clear confirmation
summary. Focusing a row for inspection is not selecting it for bulk approval and
never posts anything. This makes scanning and exception handling more efficient
than expanding every row into a large form, at the cost of less horizontal list
space and an extra selection to inspect details. Use shared visual primitives;
do not flatten file batches or extend Gmail bulk eligibility. This is a Finance
Tracker-specific adaptation, not a claim that upstream has an identical inbox.
Narrow-screen inspector behavior remains part of the responsive decision.

**Q30 — Confirmed (2026-10-26): statement reconciliation workspace.** Replace
the many expanded statement accordions with a statement list leading to one
bookmarkable full-page account/statement workspace. Show account, cutoff, status
and revision above a compact **Statement ending balance / Cleared ledger balance /
Difference** strip, followed by known blockers and a dense clearing table. Keep
source matching, duplicate correction and decision history as separate tools.
Explicit completion and reopening preserve all existing guards; a displayed zero
must not imply readiness when the exact difference is nonzero or blockers remain.
Expose sub-cent differences clearly despite ordinary summary rounding. Table
filters must not change statement totals. The trade-off is one selection to open
a statement instead of several expanded simultaneously, in exchange for clearer
scope and less clutter. Brokerage statement reconciliation remains unsupported.
Efficient statement-detail loading/pagination may require an additive read endpoint;
no new reconciliation engine or automatic balancing adjustment is implied.

**Q31 — Confirmed (2026-10-27): Rules editor and application clarity.** Use
compact rule rows and a focused **IF conditions / THEN metadata actions** editor,
refining existing progressive disclosure. Keep enabled state obvious and summarize
active scope, matching mode and priority; advanced settings may collapse but must
preserve all existing values, conditions and actions. Clearly separate saving a
rule for future transactions (if enabled) from **Preview/apply to existing history**.
Preserve draft preview, invalidate stale previews on edits, distinguish example
count from total affected count and require existing explicit confirmation/token
checks for historical application. Manual metadata precedence and per-field rule
priority remain unchanged. This reduces always-visible controls at the cost of
opening advanced details for uncommon settings; do not introduce unsupported
regex/taxonomy controls, financial actions or automatic historical application.
Rules remain configuration in Settings; transaction-to-rule shortcuts create a
draft for review, not a posting or silently activated historical change.

**Q32 — Confirmed (2026-10-27): narrow-screen adaptation.** Retain Finance
Tracker's top-toolbar/navigation-drawer shell on narrow screens rather than copy
the reference's floating bottom navigation. Stack financial grids, open the desktop
review inspector as an on-demand full-width sheet, and keep required table fields
accessible through horizontal table scrolling. Returning from the inspector preserves
list position, filters and pending decisions; resizing must not reset financial
context. Provide accessible names, focus management, close/back behavior and
visible demo identity. This accepts a deliberate mobile navigation difference in
exchange for accommodating all seven destinations without another bottom-navigation
hierarchy. Desktop fidelity remains primary. The existing below-1024px drawer
boundary is the starting point for viewport validation; exact sheet dimensions and
Life Events' phone timeline/calendar choice remain unresolved.

**Q33 — Confirmed (2026-10-27): financial explanations and coverage disclosure.**
Replace repeated methodology paragraphs with concise **Details** disclosures while
keeping interpretation-critical information beside the affected value: period,
currency, partial/unavailable status and essential metric qualifiers such as
Annualized XIRR or price-return benchmark. Keep actionable missing-data reasons
visible and link to further detail; never present a known subtotal as a complete
total. Exact values, source dates, calculation methods and supporting tables remain
accessible through keyboard-operable disclosures. This improves reference-like
density at the cost of an extra action for methodology, without hiding a warning
that changes the meaning of the displayed number or disguising unavailable data
as zero. Do not remove confirmation safeguards from financial actions.

**Q34 — Confirmed (2026-10-27): appearance baseline and palette calibration.**
Calibrate the existing **Olive dark** palette to the pinned reference's Classic
dark neutral surfaces and restrained olive accent, using **JetBrains Mono** for
the canonical comparison baseline. Keep mono/olive/dark as fresh local defaults,
without adding a near-duplicate sixth palette. Preserve all existing font/palette/
mode choices and saved normal/demo selections; never silently reset preferences.
Users already selecting Olive dark will see its updated colors: preserving the
selection does not mean preserving those old token values. Light mode and alternate
palettes/fonts remain functional and accessibility-tested adaptations, not additional
pixel-parity baselines. Synchronize any eventual token/default changes with the
existing pre-render appearance bootstrap, retain licensed local fonts and semantic
financial colors, and introduce no third-party product branding.

**Q35 — Confirmed (2026-10-27): measurable visual acceptance.** Require paired
1440x900 and 1920x1080 desktop captures using the agreed appearance, with major
section/chart bounds and gutters within **8 CSS pixels** of the pinned reference
and control/row heights within **2 CSS pixels**, except confirmed deviations.
Match reference typography/style tokens and preserve exact sidebar widths. Use
390px-wide checks for responsive usability rather than mobile pixel parity, given
the approved drawer deviation. Record measured differences, not just pass/fail
test totals; financial values and chart paths must remain data-derived. This costs
more comparison/iteration work but supplies a concrete rejection criterion for
layout drift. Any additional deviation needs explicit agreement rather than
silently relaxing tolerances. Reference captures/fallbacks still follow Q8.

**Q36 — Confirmed (2026-10-27): unsupported Net Worth analytics widgets.**
Defer the reference's monthly pace/momentum and change-driver widgets for this
redesign, retaining actual net-worth history, asset/debt breakdown and existing
valuation-coverage information. Reflow supported content without fake metrics or
empty placeholder cards. Local endpoint changes are not reconciled attribution:
newly recorded assets need not be appreciation, and debt-value reductions need
not be repayments. The reference's full driver decomposition is not an available
local calculation merely because history exists. This accepts a documented visual
deviation rather than introducing unvalidated analytics to fill the reference's
right column. Detailed layout defaults will be included in the final approval draft.

**Q37 — Confirmed (2026-10-27): Performance comparison scope.** Retain one
selected portfolio scope (one account or the whole portfolio) against **one optional
benchmark** in this redesign, using the existing performance API and compact
reference-style comparison controls. Do not display unsupported add-comparison
controls for multiple account/benchmark overlays. This limits simultaneous
comparisons but keeps loading, dates, reporting currency and coverage coherent
without adding multi-series orchestration. Benchmark method and incomplete coverage
remain explicit; price-return series must not be presented as total-return indexes.
Selecting a benchmark reads eligible cached data and does not silently trigger
provider refresh. Multiple overlays remain possible future work, not an alleged
fundamental limitation of the backend.

**Q38 — Confirmed (2026-10-27): Goals progress and scenario controls.** Separate
persistent goal-progress changes from the temporary contribution scenario. Use
explicit **Adjust allocation** for account-backed goals and **Record progress**
for manually tracked goals, opening focused editing controls with existing history
and validation. Keep the monthly-contribution what-if input in the planning sidebar,
clearly labeled as a scenario; changing it must not save progress or move money.
Account allocations designate existing savings, not transfers; manual progress
also does not create ledger entries. This adds an explicit edit step compared with
an always-open funding form, but makes the difference between saved progress and
planning unambiguous. Preserve both goal modes, over-allocation/coverage notices,
correction history and explicit lifecycle actions. Do not add a misleading Fund goal
button implying a bank transfer or automatic schedule.

**Q39 — Confirmed (2026-10-27): navigation and view-state policy.** Keep views,
entity IDs, filters, period and currency in validated local hash routes where
applicable, so direct links/reload and browser Back restore their intended context.
Preserve list position on return; filter typing replaces the current history entry
rather than adding an entry per keystroke. Contextual links between compatible
investment views carry scope/date/reporting currency, but do not force investment
scope onto banking views or reinterpret Income's original currency. Clicking the
generic Dashboard sidebar destination opens Spending; explicit Dashboard mode
links and browser Back still restore Investments or Net Worth. Preserve legacy
route aliases. Only appearance preferences belong in localStorage; do not persist
financial filters or draft payloads there. This trades automatic last-view recall
from the generic Dashboard button for a predictable spending-first entry point.
Unsaved edits and pending confirmations must not be silently submitted by navigation;
stale demo-generation/context state remains subject to existing reset guards.

**Q40 — Confirmed (2026-10-27): remaining tool placement.** Keep Activities'
Transactions / Investment Activity views uncluttered, with a clearly labeled
**Tools** menu for **Scheduled transactions, Imports, Gmail review and Reconciliation**.
Imports explicitly distinguishes bank CSV/OFX from investment CSV and retains
their dedicated workflows. Contextual account/transaction entry points remain
available; reconciliation retains source matching, statements, duplicate correction
and history internally. Settings groups **Appearance & Language, Categories,
Payees, Rules, Budget setup, Market data and Gmail connection**; the budget page's
Edit ongoing plan action links to the same existing-target setup workflow. Put
the existing read-only **Reports preview** under a clearly labeled Settings /
Previews entry, preserving direct bookmarks. This trades one menu step for fewer
permanent navigation rows; no new budget/import/schedule engine or connection
capability is introduced. The grouped Settings layout and exact route aliases will
be specified in the final draft, not expanded into more interview questions.
