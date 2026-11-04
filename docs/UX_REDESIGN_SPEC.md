# Finance Tracker UX redesign specification

Status: **Approved on 2026-10-27. Implemented screens/workflows await visual acceptance.**

Prepared and approved 2026-10-27. All forty interview decisions and the proposed
defaults below are approved. No application code was changed during the interview.
This document defines the implementation contract;
it does not claim that the redesigned screens or their visual validation exist.

## How to review this specification

- **Confirmed** requirements come from [Q1â€“Q40](UX_REDESIGN_DECISIONS.md).
- **Proposed defaults** below resolve routine details left to this final draft.
  They were accepted with approval of this document, not another interview round.
- The [reference audit](UX_REDESIGN_AUDIT.md) records inspected code, screenshots,
  capability gaps and intentional differences. [GLOSSARY.md](../GLOSSARY.md)
  defines the financial terms. Consequential choices are recorded in [ADRs](#adrs).
- This specification governs the future redesign. Existing product/setup docs
  continue to describe the current application until implementation lands.

## Scope and invariants

Confirmed: redesign the shell, Investments, Performance, Portfolio Insights,
Income, Net Worth, Spending, Budgets and Goals; adapt fixed income, Life Events,
imports, Gmail, rules and reconciliation to the same visual language.

Preserve the local-first, single-user React/FastAPI/SQLAlchemy/Alembic/SQLite
architecture, existing API clients and financial posting services. This is not
a database migration, ledger redesign or new analytics engine. Additive read-only
display helpers are limited to the explicit gaps described below.

- No AI, allocation targets/rebalancing, Retirement/FIRE or tax-aware goal funding.
- No cloud persistence, telemetry, new authentication, Redis or Celery.
- Money remains Decimal/exact strings; JavaScript money never becomes Number.
  Charts may use dimensionless coordinates derived from exact values.
- Transfers are not income/spending. Preserve refund classification, opening
  history, atomic linked transfers, investment cash-posting uniqueness and audit.
- Missing coverage is unavailable, not zero. A known subtotal is not a full total.
- Keep source provenance, manual metadata precedence, immutable fixed-income
  terms, reconciliation locks and explicit confirmation boundaries.
- Preserve normal/demo separation, opt-in network behavior and existing features.
  No real data, source payloads, secrets or generated databases enter screenshots/Git.
- Application implementation was authorized after the interview. Commit, merge,
  tag and push remain unauthorized. The Q8 reference-fallback gate still applies.

## Reference contract

Canonical upstream revision:
[`d86c20194b4b61ad8133ce820739d5ac83f9045e`](https://github.com/wealthfolio/wealthfolio/tree/d86c20194b4b61ad8133ce820739d5ac83f9045e).
Its rendered screens define geometry; source defines interactions. Approved local
differences take precedence. Public screenshots supplement the baseline only where
consistent: some depict a different design generation.

Before implementing a screen, capture its pinned reference state at the required
viewport. If it cannot run, agree on a specific screenshot fallback first. Existing
cached official images establish review evidence, not proof of a running pinned
application. Do not silently revert to text-only interpretation.

Main source files, relative to upstream `apps/frontend/src/`:

| Area                     | Reference source                                                                                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell                    | `pages/layouts/navigation/app-sidebar.tsx`, `app-navigation.tsx`, `pages/dashboard/portfolio-page.tsx`                                                         |
| Investments              | `pages/dashboard/dashboard-content.tsx`, `balance.tsx`                                                                                                         |
| Insights                 | `pages/insights/portfolio-insights.tsx`, `overview/insights-layout.ts`, `overview/insights-dashboard.tsx`                                                      |
| Performance              | `pages/performance/performance-page.tsx`                                                                                                                       |
| Income                   | `pages/income/income-page.tsx`                                                                                                                                 |
| Net Worth                | `pages/net-worth/net-worth-content.tsx`, `components/breakdown-table.tsx`, `components/category-detail-sheet.tsx`                                              |
| Asset/debt details       | `pages/asset/asset-profile-page.tsx`, `alternative-asset-content.tsx`                                                                                          |
| Spending                 | `features/spending/components/spending-tab-content.tsx`, `cash-flow-strip.tsx`                                                                                 |
| Spending Insights/events | `features/spending/pages/spending-insights-page.tsx`, `components/reports/insights/when-where-stage.tsx`, `events-timeline-card.tsx`, `event-detail-panel.tsx` |
| Budgets/rules            | `features/spending/components/budget-editor.tsx`, `rule-item.tsx`, `rule-edit-modal.tsx`, `rule-form.tsx`                                                      |
| Goals                    | `features/goals/save-up/components/save-up-detail.tsx`                                                                                                         |

Official feature references: [Investments](https://wealthfolio.app/features/investments-tracking/),
[Performance](https://wealthfolio.app/features/performance-dashboard/),
[Income](https://wealthfolio.app/features/income-tracking/),
[Net Worth](https://wealthfolio.app/features/net-worth-tracking/),
[Spending and Budgets](https://wealthfolio.app/features/spending-budgets/).
Portfolio Insights and Goals feature-page retrieval failed during inspection;
their source and cached official screenshots were inspected instead. Preserve
AGPL/OFL attribution in `THIRD_PARTY_NOTICES.md` and local licenses if adapting code;
do not copy branding, logos or product graphics.

## Navigation and route contract

Confirmed primary order:

```text
Dashboard    Spending | Investments | Net Worth
Accounts
Activities   Transactions | Investment Activity
Holdings
Insights     Overview | Performance | Income
Goals

Settings     pinned near the bottom
```

Dashboard opens Spending on initial/generic entry, including repeated sidebar
clicks. Explicit mode links and browser Back restore their actual destination.
Accounts remains a deliberate addition to the reference's primary navigation.
No separate Transfers, Categories, Budget, Investments or Performance sidebar item.

Activities has context-appropriate creation actions and a labeled **Tools** menu:
Scheduled transactions, Imports, Gmail review, Reconciliation. Imports explicitly
distinguishes bank CSV/OFX from investment CSV; workflows remain separate.

Settings contains Appearance & Language, Categories, Payees, Rules, Budget setup,
Market data and Gmail connection. Reports remains an explicitly read-only preview
under Settings â†’ Previews, with its old bookmark preserved.

**Proposed grouping:** General (appearance/language), Classification (categories,
payees/rules), Planning (budget setup), Data & connections (market data/Gmail),
Previews (Reports). Use compact grouped Settings navigation, not another long
horizontal tab row. Account administration stays in Accounts.

### Proposed canonical hash routes

Extend the existing hash router; do not introduce a second routing/state library.
Examples use canonical untranslated IDs. Keep existing API paths unchanged.

| Destination             | Hash route example                                                                                                           |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Dashboard               | `#/dashboard?view=spending`, `view=investments`, `view=net-worth`                                                            |
| Accounts/detail         | `#/accounts`, existing `#/account?account=<id>`                                                                              |
| Activities              | `#/activities?view=transactions` or `view=investment-activity`                                                               |
| Tools                   | `#/activities?tool=scheduled`, `tool=imports&kind=bank`, `tool=imports&kind=investment`, `tool=gmail`, `tool=reconciliation` |
| Statement               | `#/activities?tool=reconciliation&section=statements&statement=<id>`                                                         |
| Holdings/detail         | `#/holdings`, `#/holdings?type=fixed-income`, `#/holdings?asset=<id>` or `contract=<id>`                                     |
| Insights                | `#/insights?view=overview`, `view=performance`, `view=income`                                                                |
| Budget                  | `#/dashboard?view=spending&detail=budget&month=YYYY-MM`                                                                      |
| Spending Insights/event | `#/dashboard?view=spending&detail=insights&stage=where`, `stage=changed`, `stage=when&event=<id>`                            |
| Manual asset/debt       | `#/dashboard?view=net-worth&position=<id>`                                                                                   |
| Goals/detail            | `#/goals`, `#/goals?goal=<id>`                                                                                               |
| Settings/preview        | `#/settings?view=rules`, `view=budget-setup`, `view=market`, `view=gmail`, `view=previews&preview=reports`                   |

Filters, validated entity IDs, applicable scope/currency and explicit dates belong
in the local hash. Never put secrets or source payloads there. Financial filters
and drafts do not belong in localStorage; preserve appearance-only storage.
Filter typing replaces history; discrete navigation creates a history entry.
List return restores filters, page and scroll position. Pending financial decisions
are never silently submitted by navigation or viewport changes. Stale demo
generation state is discarded through the existing reset guards.

Compatible contextual links carry investment account scope, dates and reporting
currency. Income retains its original-currency selection semantics; banking scope
is not silently coerced into investment scope. Use a single validated period helper
and explicit adapters for endpoint date-boundary conventions.

**Required legacy mapping:** `overview` â†’ Dashboard/Spending; `spending` â†’ Spending
and its former Budgets/Insights/Life Events views; `investments` and its former
Overview/Performance/Allocation/Income/Holdings/Activity/Accounts/Imports/Fixed Income
views â†’ the corresponding canonical destination; `performance` â†’ Insights/Performance;
`net-worth` â†’ Dashboard/Net Worth; `transactions` and its tool views â†’ Activities;
`reports` â†’ Reports preview. Preserve valid existing account/settings/goals bookmarks.
Inventory actual current parameter spellings before implementation; translate aliases,
not financial values. Invalid or missing entities show recovery, not a blank page.

## Shared visual and interaction system

Confirmed desktop sidebar: 70px collapsed by default, 220px expanded, explicit
toggle and remembered appearance choice. Accessible labels appear on hover/focus;
active state is restrained. Preserve separate normal/demo preferences.

Confirmed baseline: JetBrains Mono and the existing Olive dark palette calibrated
to Classic dark. Reference anchors are background `hsl(0 3% 6%)`, surface
`hsl(30 4% 11%)`, divider `hsl(30 3% 15%)`, primary text `hsl(55 10% 79%)`,
olive accent `hsl(72 46% 41%)`. Match the remaining semantic roles from the pinned
source. Existing Olive users see new tokens, but selections are not reset. Other
fonts/palettes and light mode remain supported, not additional pixel-parity baselines.
Use existing self-hosted fonts and semantic variables; sync pre-render appearance.

Copy the measured reference hierarchy and intentional surfaces, not a universal
no-card rule. Income summary cards and account rows have deliberate grouping.
Avoid redundant page subtitles, repeated methodology paragraphs and stacked
control bars. Page-specific actions occupy the reference header/control locations.
The persistent text-labeled Demo control uses the existing header; its menu owns
tour/scenarios/reset and fictional profile/date context. Reset safeguards remain.

Money summaries use each currency's minor-unit precision; exact values remain
accessible. Quantities/unit prices retain appropriate precision. Aggregate exactly
before formatting; never calculate from rounded display strings. Nonzero sub-cent
reconciliation differences must stay visibly nonzero despite summary rounding.

Period/currency, partial/unavailable status, metric qualifiers and actionable
missing-data reasons remain beside affected values. Details disclosures contain
methods, source dates, exact tables and longer explanations. No known subset
masquerades as 100% allocation or a complete total.

**Proposed shared primitives:** refine existing page/section headers, section
navigation, Money, query/empty/error states, tables, detail drawers, exact charts
and period controls. Add only small reusable entity-header, scope-toolbar,
list/inspector and coverage-summary patterns where existing primitives do not fit.
No new generic design framework or second query/state system.

### Responsive and accessibility behavior

Confirmed: retain the current narrow-screen top toolbar/navigation drawer,
starting with the existing below-1024px boundary; stack financial grids. Review
inspectors become on-demand full-width sheets. Tables scroll within their container,
not the page. Closing restores focus/list context; resizing does not reset decisions.

**Proposed defaults:** use the reference phone calendar for Life Events below
768px, with selected-event details below; keep the date-scaled timeline above that
width. Long editing sheets have a visible title/close action, scrollable body and
reachable action footer. Simple confirmations remain compact. Support Escape,
focus containment/restoration and unsaved-change protection where data would be lost.
Keyboard-accessible chart selections have equivalent exact tables. Preserve semantic
tables, associated labels, readable contrast, reduced motion and non-color status cues.
Check English, pt-BR and es-419 without translating user/source text or changing
currencies/import parsing when language changes.

## Screen specifications

Confirmed choices are cited by Q number. Remaining details in this section are
**proposed defaults for approval**, constrained by the pinned source and existing
financial services. They do not reopen the forty interview decisions.

### Spending and Spending Insights

Reference order: period spending headline/change context; compact cash-flow strip;
approximately 280px spending-bar hero; range controls below; lower 2:1 layout.
Use Income / Spending / Net cash flow, excluding investment transfers (Q12).

Lower left: category/group breakdown with List/Map where valid, recent activity,
contextual links into insights. Lower right: monthly budget summary/Manage budget,
existing deterministic attention information where supported, Life Events entry.
No permanent Overview/Budgets/Insights/Life Events tab row (Q14). Empty states keep
links reachable. Chart/category selections open appropriately filtered Activities.

Start month-to-date. Reference controls: This month, Last month, 3M, 6M, YTD, 1Y
and a calendar range picker. Specific months synchronize budget month; broader
ranges select current budget month, then budget arrows can browse independently
(Q13). Label both contexts. Demo uses its authoritative synthetic as-of date.

Spending Insights has Where I am / What changed / When & where stages (Q16).
Use existing pace, cash flow, categories, changes and weekday/day data. No hourly
heatmap, geographic invention or AI narrative. Preserve current month-to-date
comparison against the same elapsed span of the prior month. For newly supported
broader/custom comparisons, propose an equal-length preceding calendar-day range,
explicitly labeled; no comparison if required data is unavailable. Future portions
are not historical actuals. Keep simple pace extrapolation labeled, not a promise.

### Budgets

Manage budget opens the displayed budget month. Use the reference's compact grouped
category rows: category, base target, rollover, available target, spent and remaining,
with clear status. Never equate remaining target with available bank cash.
Carry must retain its signed value; zero/negative denominators have no fake percentage.

Existing-row edits default to This month only; ongoing plan is explicit (Q15).
Preserve active/rollover/group/order fields in amount-only edits. Explain override
precedence and show Restore monthly default; ongoing edits do not delete overrides.

Proposed setup defaults: Settings/Budget setup manages effective-month defaults;
creating a target there defaults to ongoing. Adding a target from a monthly page
defaults to a one-month override with an explicit scope selector. Labels show the
effective month, later-version boundary and rollover consequences. Copy previous
month retains existing override/conflict confirmation rules. No envelope system,
group buffers, new target engine or ledger postings.

### Life Events

Use date-scaled bands over daily spending, overlap lanes and inline selected-event
details (Q17). Selection is keyboard/pointer operable and represented in the route.
On phones use the proposed calendar adaptation, preserving selection/date context.

Detail: name/date range/type, actual linked cost, optional planned amount/remaining,
daily cost, category breakdown and linked transactions. Keep native transaction
amounts and FX coverage accessible. Explicit linked refunds, including later refunds,
retain their existing treatment. Daily context never auto-tags purchases. Do not
copy unimplemented baseline/lift metrics or invent causation. Create/edit/link in
focused dialogs; unlink/delete preserves ledger history.

### Investments dashboard

Headline: selected-period ending Portfolio value, then Period gain/loss and Return
(TWR), sharing the historical scope/currency/basis with the hero chart (Q18).
Use the existing analytics valuation and metrics, not a separate newer-current-quote
headline. Gain and TWR may have different availability. Contributions may move the
value chart without being gains. Fixed-income accrual is valuation, not paid income.

Reference chart geometry: approximately 280px hero and controls below; compact
scope/end-date/reporting-currency actions in the header, not several full-width bars.
Use existing 1M/3M/6M/1Y/ALL where supported and shared date helpers; offer other
reference ranges only when their real backend semantics are available. Proposed
initial range is 3M ending at the application/demo as-of date.

Lower 2:1 Accounts / Top holdings (Q19). Show real brokerage accounts individually;
do not invent Taxable/Retirement wrappers. Top five known holdings use comparable
reporting-currency values, excluding cash; incomplete coverage is labeled rather
than a definitive full ranking. Links open canonical full views. Proposed compact
current savings-goal preview may sit below holdings, matching the source's secondary
placement: label its own as-of context and never include goal allocations in portfolio
value. Detailed composition remains in Insights.

### Portfolio Insights

Fixed responsive layout, no widget editor or allocation targets (Q20). Use the
pinned default ordering: summary strip; Accounts / Asset classes / Regions / Sectors;
composition; detailed breakdown; concentration. Expand composition into the removed
allocation-target column. Omit unsupported daily movers; period gains are not daily moves.

Reference grid starts at 12 columns/16px horizontal gap, 6 columns on smaller
containers and 2 on phones, with 1100/700px container breakpoints. Source initial
heights are content-measured, not clipping constraints: summary 100px, exposure 234px,
composition 622px, breakdown 552px. Inspect rendered values before implementing.

Proposed summary adaptation: Portfolio value, Cash, Invested in reporting currency;
Book cost and Unrealized P&L as explicitly native-currency subtotals in their compact
summary areas. Do not convert/aggregate basis or gains into the outer reporting
currency without a separately defined FX-basis policy. Unknown prices invalidate
the relevant P&L total; missing weights stay unavailable. Exact breakdown rows and
concentration reuse existing allocation results, including cash and Unknown classifications.
Suppress positive-composition visuals for unsupported negative/incomplete compositions,
while retaining exact rows and clear explanations.

### Performance

Dominant TWR comparison chart and compact existing metric strip (Q23), reference
height near viewport minus its header/controls rather than a small dashboard card.
One account or whole portfolio plus one optional benchmark (Q37). Controls may
look like the reference's selected comparison chips but never promise extra overlays.

Show Annualized XIRR, period gain/loss, ending value and net external funding with
method/coverage details. Benchmark labels disclose price return versus total return;
retain genuine gaps and cached-source dates. Do not infer volatility, drawdown,
attribution or multi-series capabilities from the reference screenshot. Selection
does not refresh providers. No zero substitute for unavailable returns.

### Income

Reference three summary areas: **Net income received / Average monthly net income /
Income sources**, then a 2:1 monthly-history / Top income sources grid. One original
payment currency across all three areas and the chart/ranking (Q21â€“Q22). Replace
the reference's converted-currency pie with a compact other-currencies indicator.

Proposed average: exact net receipts divided by the calendar-month buckets touched
by the selected range, including zero-payment months. Label partial boundary months;
this is an average of recorded income, not a forecast. Display the denominator in
Details. Dividends/interest breakdown uses net amounts; Top 10 sources ranks positive
net contributors and keeps adjustments/other sources accessible. Negative or zero
composition gets exact rows rather than a misleading pie/proportion chart.

Prior-year context uses the actual prior interval only when available; otherwise
omit the comparison with an explicit no-comparison state, not fabricated zeros.
Gross, fees, withholding and activity history remain accessible. Keep redemptions
and their principal/realized breakdown distinct; unpaid accrual is not income.

### Net Worth and manual assets/debts

Hero net worth/history followed by asset/debt breakdown, with current coverage and
dated observation context. Defer pace/momentum/change-driver widgets (Q36).
Proposed reflow: 2:1 breakdown/attention when genuine coverage issues exist;
otherwise expand the supported breakdown rather than retain an empty right column.
This is an explicit reference deviation, subject to final approval of this draft.

Category sheets show constituents and Open details. Full-page asset/debt details
use approximately 2:1 history/supporting data, with Overview / Values and contextual
Update value/Edit actions (Q24). Preserve observation correction/void history,
effective dates and missing FX; no inferred appreciation, repayments, amortization
or new cash movements. Linked property/debt presentation cannot create another
equity asset. Unknown net worth is not a known-value subtotal presented as complete.

### Goals

Full-page detail, proposed 2:1 progress/trajectory and planning-sidebar layout.
Show target, deadline, actual saved/progress and existing milestones; exact
overfunding remains visible even when a progress bar caps at 100%. Distinguish
actual history, required trajectory and contribution-only scenario (Q25).

Planning sidebar contains a clearly temporary contribution input and scenario result.
Adjust allocation or Record progress opens explicit editing for the existing mode
(Q38). Target/deadline edits have explicit Save, not implicit mutation from scenario
changes. Preserve dated corrections, same-currency shared savings, shortfall warnings,
unavailable progress and explicit completion/archive consequences. No expected-return
input, tax-aware funding, bank-transfer button, automated schedule or FIRE planner.

### Accounts and Holdings

Accounts remains a primary destination, using compact financial rows and full-page
details. Preserve account administration, calculated cash balances, inactive state
and account-specific activity. Do not sum unrelated currencies. Detail navigation
restores the originating list context; editing remains a focused dialog.

Holdings is the complete positions directory, separate from the dashboard's short
list. Show quantity, eligible price/date, value and available gain data with their
currency and coverage. Asset detail is bookmarkable. Missing quotes remain visibly
unavailable. Do not substitute current positions for historical quantities.

Fixed income is a Holdings filter, not a competing primary section (Q26). Contract
details show immutable terms, principal/quantity, dated valuation, liquidity and
eligible subscription/redemption actions. Use **Record subscription** and **Record
redemption** with existing previews and explicit confirmations. Preserve funding,
oversell and date guards. Neither action is broker execution. Keep CDB accrual
separate from paid income and redeemed principal; do not expose generic financial
editing or a manual CDB quote override.

Missing index coverage links to **Settings â†’ Market data â†’ Record dated index**
with contract/index/date context (Q27). No implicit network refresh or invented
factor. Proposed default: retain the existing fixed-income comparison as a contextual
action in the filtered directory, not a new sidebar item.

### Activities and tools

Transactions and Investment Activity share navigation, not a financial schema.
Retain their dedicated dense tables, filters, pagination, exact values and editing
restrictions. Transfer creation stays in Add Transaction; linked sides remain
coherent and neutral. Preserve payee/raw description, review status and page-scoped
bulk selection. Review is not clearing. Investment activities retain dedicated
posting/correction behavior and their sole cash movement.

The Tools menu exposes Scheduled transactions, Imports, Gmail review and
Reconciliation (Q40). Schedules remain expectations with explicit posting/matching.
Tool entry points from accounts or transactions preserve useful scope.

#### Imports and Gmail review

Use a dense candidate list with a focused right inspector on desktop (Q28â€“Q29).
The inspector separates original evidence, proposed classification, potential
matches and validation errors. Focusing a row never selects it for bulk approval.
On narrow screens use a full-width inspector sheet with a clear Back action.

Keep bank CSV/OFX batches, Gmail messages and investment CSV as distinct workflows.
Share presentation primitives where contracts match, not a combined approval queue.
Bank confirmation retains preview tokens and source identity. Gmail retains its
existing bounded eligible bulk confirmation; special movements require linking or
skipping. Investment CSV retains activity-specific quantities, prices, fees and
its own confirmation semantics. Never invent a generic LINK action for that parser.

Keep source data local and plain text; do not render email HTML or fetch attachments.
No cross-tool Approve all, automatic posting or client-side concatenation masquerading
as a complete paginated inbox. Loading/error states retain source context and do
not discard an explicit decision silently.

#### Reconciliation

Retain Source matching, Statements, Existing duplicates and Decision history.
Statements list opens one bookmarkable full-page workbench (Q30), rather than
expanding all unfinished statements. Its header shows account, currency, cutoff,
status and revision. The summary is **Statement balance / Cleared balance /
Difference**, followed by blockers and scoped ledger rows.

Completion requires the existing exact-zero difference, conflict checks and fresh
preview token. A sub-cent difference must remain visible and cannot round into a
Ready state. Explain reopening's effect on later statements before confirmation.
Keep immutable decision history; never offer an automatic balancing adjustment.
Paging visible rows must not change statement totals. Do not imply brokerage
statement support where the existing service rejects it.

### Settings and Rules

Settings contains the Q40 groups without creating unrelated preferences. Categories
and Payees retain their existing CRUD guards. Gmail connection is distinct from
Gmail review. Reports remains a labeled read-only preview.

Rules use compact summaries and a focused IF/THEN editor (Q31). Enabled state,
priority and scope remain visible. Advanced disclosure preserves ALL/ANY conditions,
actions and hidden values; editing must not discard them. Preserve the existing
first-matching-per-field behavior, explicit manual choices and protected legacy
metadata. Rules cannot change monetary posting.

Saving future behavior is separate from previewing/applying to history. Draft
changes invalidate a stale preview; show the full affected count even when examples
are limited. Suggestions require explicit acceptance. Deleting a rule does not
reverse past classifications. Do not import unsupported reference regex/taxonomy
features merely to match its editor visually.

## Bounded API and integration work

These are display gaps, not authorization for parallel financial engines. Reuse
existing services, preserve additive API compatibility and test any new projections.

| Area                 | Existing capability                                                                                      | Minimum permitted work                                                                                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Spending             | Arbitrary half-open date ranges, exact totals/categories; service already computes daily/monthly buckets | Expose bucket series additively and explicit comparison ranges; adapt period narrative. Keep monthly budget query independent.                                                |
| Investment dashboard | Historical performance includes ending value, gain, TWR, valuation and flows                             | Preserve needed fields in frontend schemas; use one selected historical scope. Expose existing historical valuation rows only if needed for scoped account/holding summaries. |
| Portfolio Insights   | Allocation endpoint already returns detailed rows                                                        | Retain those rows in frontend schemas. Keep book cost/P&L in original-currency groups; no implicit reporting-currency sum.                                                    |
| Income               | Actual income by date and original currency                                                              | Derive exact calendar-month averages through a small read-only helper if needed; query actual prior periods explicitly. No forecast engine.                                   |
| Statements           | Statement details, revision/token, balances and blockers exist                                           | Add an ID-oriented read endpoint or row pagination if necessary for a focused workbench. Preserve authoritative whole-statement calculations and completion checks.           |
| Routes               | Local hash routing and existing financial tools                                                          | Add aliases and scoped detail routes, not a second router or new persistence layer.                                                                                           |
| Review tools         | Dedicated bank, Gmail and investment import contracts                                                    | Reuse each contract and confirmation service. No new unified ingestion endpoint is required.                                                                                  |

Do not use ledger `/history` as a substitute for spending or investment analytics.
Its available ranges and financial meaning differ. Current valuation, historical
valuation and portfolio return are also distinct. Fields omitted by a frontend
schema should be restored before proposing a new backend calculation.

## Shared implementation ownership and delivery order

Reuse the existing section navigation, query states, monetary formatter, chart
normalization, dialogs and form controls. Refine a component only where at least
two screens share behavior. Suggested ownership boundaries are shell/navigation,
financial header/range controls, exact chart tooltip/data alternative, compact
financial rows, detail-page layout and candidate inspector. These are responsibilities,
not a requirement to create a new generic framework or rename working components.

1. Inventory current routes and capture the pinned reference at both desktop sizes.
   Record baseline screenshots and capability/coverage states before editing.
2. Establish shell, theme tokens, navigation aliases, demo control and shared exact
   formatting. Validate Spending-first behavior and mobile navigation.
3. Implement Spending/Budgets/Life Events, then Investments and Holdings/FI. Use the
   accepted screen order for review; complete one visual comparison before spreading
   styling changes to every destination.
4. Implement Insights Overview/Performance/Income, then Net Worth and Goals.
5. Adapt Accounts, Activities, ingestion inspectors, reconciliation and Settings
   without changing confirmation or posting semantics.
6. Run financial regressions, route/accessibility tests and paired screenshot review.
   Update current-product documentation only after the behavior actually exists.

Each slice must retain a usable application and bookmark compatibility. A discovered
financial gap must be documented and resolved explicitly; do not hide it with demo
values, styling or a silent change in calculation basis.

## Acceptance and validation contract

### Visual evidence

- Capture reference and Finance Tracker at **1440Ã—900** and **1920Ã—1080**, identical
  viewport, device scale, browser zoom and loaded fonts. Record reference commit,
  route, theme, font, scope, dates and synthetic data as-of date with each pair.
- Compare shell/sidebar, header, chart plot bounds, gutters, section positions,
  typography, controls, rows and numerical alignment. Major bounds/gutters must be
  within **Â±8 CSS px**, row/control dimensions within **Â±2 CSS px** (Q35). Sidebar
  widths follow Q7. Use actual rendered bounds, not screenshot file dimensions alone.
- Match reference font size/weight/line height and the selected token palette.
  Record source-specific chart axes, fill, line, tooltip and whitespace differences.
  Different data shapes are legitimate; altered layout is not automatically excused.
- Maintain a per-screen comparison sheet with pass/fail, measured differences and
  approved deviations. No unsupported blank chart counts as a successful comparison.
- Capture representative hover/focus, selected range, empty, error and missing-data
  states. Use synthetic fixtures through real APIs; do not change financial values
  to imitate the reference image.
- Check **390px** navigation, sheet focus/close, stacked sections and table overflow.
  No page-level horizontal overflow except deliberately scrollable data regions.
- An inaccessible reference screen requires the Q8 agreed screenshot fallback before
  its implementation; this specification is not permission to invent that screen.

### Behavioral and financial acceptance

| Area            | Required evidence                                                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Navigation      | Dashboard opens Spending; direct modes/details/tools and legacy bookmarks work; Back restores filters and position; filter typing replaces history.                      |
| Appearance/demo | Normal/demo preferences remain separate; all existing fonts, palettes, language and light/dark choices work; reset preserves appearance and existing generation guards.  |
| Spending/budget | Exact refunds and transfer/opening exclusions; arbitrary period agrees with service totals; budget month independence and whole-config target precedence/rollover tests. |
| Investments     | Header/chart share historical scope; gain/TWR have independent unavailable states; no double cash posting, current-price substitution or unsupported FX total.           |
| Insights/income | Native-currency cost/P&L groups; cash-inclusive composition coverage; net paid income excludes accrual/principal; zero months included in labeled averages.              |
| Net Worth/goals | No double-counted brokerage assets or goal allocations; missing coverage visible; scenarios never post, change allocations or add returns.                               |
| Activities/FI   | Existing income/expense/transfer and correction tests pass; immutable terms, funded subscription/redemption and exact dated index guards preserved.                      |
| Ingestion/rules | Focusing is not selection; separate confirmation contracts, stale-token rejection, source identity and manual metadata precedence remain intact.                         |
| Statements      | Exact sub-cent blockers; stale revision and completion checks; reopening invalidates later statements without ledger adjustment.                                         |
| Accessibility   | Keyboard-only navigation, visible focus, labels, semantic tables, dialog focus restoration, chart exact-data alternatives and non-color-only statuses.                   |

Run existing backend/frontend suites, lint, formatting, TypeScript and production
build during implementation. Add focused regression tests for changed routes,
historical display adapters, scoped controls and workflows. Test missing/partial
coverage and mixed currencies, not just the populated happy path. Use isolated
databases and synthetic data; never reset the user's normal database.

## Defaults accepted with specification approval

The forty interview decisions remain confirmed. The following routine details are
defaults accepted with the final specification, not additional interview answers:

- Flat hash-route examples and grouped Settings presentation.
- Previous equal-length comparison for broader/custom Spending ranges.
- New target defaults based on entry point; existing target edits remain This month only.
- Narrow-screen Life Events calendar with the selected details below it.
- Investments default 3M, top-five holdings, and a compact current-goal preview whose
  date/basis is explicitly separate from the historical portfolio.
- Native-currency grouping for book cost/P&L; omit unsupported Top Movers.
- Income's three supporting metrics, calendar-bucket average and top-ten ranking.
- Net Worth reflow after omitting deferred momentum/pace widgets; attention uses only
  real coverage issues.
- Contextual access to existing fixed-income comparisons.

Approving this specification accepts these defaults alongside the confirmed decisions.
It does not authorize new financial features outside the stated scope.

## ADRs

- [0001 â€” Spending-first unified dashboard](adr/0001-unified-spending-first-dashboard.md)
- [0002 â€” Unified investment insights](adr/0002-unified-investment-insights.md)
- [0003 â€” Shared Activities, distinct records](adr/0003-shared-activities-distinct-financial-records.md)
- [0004 â€” Pinned visual reference](adr/0004-pinned-visual-reference.md)
- [0005 â€” Bookmarkable financial details](adr/0005-bookmarkable-financial-details.md)
- [0006 â€” Preserve ingestion review boundaries](adr/0006-preserve-ingestion-review-boundaries.md)

## Readiness and approval

The interview and source-based specification are complete. Implementation covers
the approved screen and workflow slices; functional validation and current visual
evidence are recorded in the implementation report. Visual acceptance remains
open, including its documented geometry differences and tolerance checks.
Earlier audit screenshots remain historical evidence, not the current review set.

**User approved implementation on 2026-10-27. Git publishing remains unauthorized.**

Implementation now covers the ordered screen slices, scoped financial details,
shared Activities/tools, grouped Settings and the display adapters described above.
See [implementation and validation](UX_REDESIGN_IMPLEMENTATION.md) and the
[comparison gallery](screenshots/ux-redesign-shell/index.html) for current evidence.
The user approved cached official screenshot fallbacks for the remaining named
screens; 1920x1080 checks remain source-guided. Functional validation and final
visual acceptance are recorded separately. No Git publishing is authorized.
