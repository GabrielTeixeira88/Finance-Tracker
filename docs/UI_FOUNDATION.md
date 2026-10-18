# UI foundation - Phase 1.7 shell / Overview review

## Application hierarchy

Overview uses compact section tabs, a 30px JetBrains Mono balance, a 280px
edge-to-edge chart, a centered range selector, and a two-to-one lower grid.
The left column contains account rows; the right contains Cash flow and Recent
activity. Spending is a related Overview view; Net Worth opens the existing
explicitly labeled preview. See the [validation report](PHASE_1_7_VISUAL_REVIEW.md)
and [source attribution](../THIRD_PARTY_NOTICES.md).

The headline represents **Total balance**, never investment valuation or investment
return. Its change compares closing and opening ledger values. The chart carries
closing values across inactive days and renders the reference's monotone curve;
intermediate curve geometry is not additional financial data. Hover and the exact
data table display actual decimal strings. Range controls (1M, 3M, YTD, 1Y, ALL)
query the existing API. Overview options contains ending-month navigation and currency
selection when needed. The initial range is 3M; the synthetic demo is anchored to its
fixed end date, identified by the information control and options popover.

Currencies remain separate. Account rows show their own currency, including account
type metadata. Opening entries and transfers affect balances but not income/expense
totals. General account balances show investment cash only; the Investments workspace adds
separate activity-derived security valuation. Accounts administration retains
all-recorded-date balances; Overview uses the selected ending date.

## Shell and navigation

Desktop starts with a 70px collapsed sidebar; the footer control expands
it to 220px. Accessible names and hover titles remain available when labels collapse.
Find a page filters navigation destinations only, not financial records. The existing
Overview, Accounts, Transactions, Budget, Investments, Performance, Net Worth, Reports,
and Settings destinations remain; future sections retain Preview labels in expanded
navigation, accessible names, tooltips, and their pages. Settings stays at the bottom.
Account rows open the filtered ledger, or investment account workspace for INVESTMENT. React state navigation remains;
URL deep links/back-forward are deferred.

Transactions has one Add Transaction action with Expense / Income / Transfer modes.
Transfer mode submits once to the atomic backend operation; there is no top-level
Transfers item. Settings contains Categories, not unrelated configuration.

Dark mode is the initial default, with the Flexoki dark/light palette and its olive
chart/landscape gradient. Existing saved light preference is respected. Semantic income/expense
colors supplement signs; transfers remain neutral with explicit direction labels.
The sidebar is session-local. Only theme preference is stored in localStorage. All financial data comes from the API.

Below 1024px the sidebar becomes a native modal drawer: trapped focus, Escape,
close button, dismissal after navigation, and focus restoration. Tables scroll in
bounded regions; forms and two-column layouts reflow on narrow screens. The primary
validation widths are 1440, 1280, 1024, 768, and 390 pixels.

## Reusable components

- AppShell, PageHeader, SectionHeader, Panel (borderless section), SummaryMetric,
  Money, Badge, and compact loading/error/empty states keep spacing consistent.
- DateRangeTabs, PercentageChange, AccountRows, RecentActivity, SpendingList, and
  BalanceChart serve related previews. OverviewChart is scoped to Overview. useHistory centralizes
  range/end-date queries, currency selection, and the explicit demo date anchor.
- ChartTooltip rendering uses exact monetary strings. BigInt normalization produces
  dimensionless plotting coordinates; no money becomes a binary float. The expandable
  chart-data table provides a keyboard-accessible exact-value alternative to hover.
- TransactionComposer reuses ordinary and transfer editors, associated labels and Zod
  validation. TransactionTable has semantic headers, right-aligned tabular amounts,
  neutral linked transfer indicators, and compact metadata.
- Currency formatting is centralized, locale-aware, and preserves up to six fractional
  digits. Detailed values are not abbreviated. Financial arithmetic uses exact strings
  and BigInt. The shell/Overview tokens live in application.css; other layouts retain index.css.

## Preview boundaries

Budget is the real Phase 4 Spending & Budgets workspace; Investments is the Phase 5
activity-derived workspace. Legacy fictional holdings are no longer presented there.
Performance points illustrate a chart only, with no TWR, benchmark, or valuation claim.
Net Worth uses actual ledger history and account breakdown, labeled Total balance.
Reports composes the existing spending, flows, and balance information; no report
builder, exports, or reporting engine is implemented.

Performance requires the explicit historical demo fixture; an ordinary
workspace gets a compact demo-required state. All preview payloads come through
`/api/demo` from an isolated SQLite record, never hardcoded financial arrays in React.
The seed is fixed through September 2026; Overview information/options and preview notices expose this context.
User edits are persisted. Re-running the seed never undoes them.

## Data continuity and validation

The former oversized PostgreSQL balances were caused by a large browser-submitted
transfer and its auditable correction, not Decimal formatting. Those development
entries were not carried forward. The old PostgreSQL storage, backup, checkpoint,
and earlier small SQLite demo remain preserved. The Phase 1.6 historical workspace
uses a new ignored `data/finance-tracker-demo.db` file; tests use separate databases.

Preserve Phase 1 financial tests. Verify exact history, seed repeatability/rollback,
preview labeling, ranges, navigation, category configuration, transfer creation, and
responsive layouts. Never write browser test activity into the review demo. See
README for native startup, expected balances, and validation commands.

## Phase 2A ledger interactions

The global shell, theme, navigation, Overview charts, and spacing system are unchanged.
Transactions adds payee/raw-description rows, review badges, search, combined filters,
date ordering, server counts, and current-page checkboxes. Amounts retain exact formatting
and transfers retain their neutral direction/link indicators. Existing editors now expose
payee search/create/rename and review state. Payee renaming is explicitly confirmed because
it affects all associated labels; it does not edit raw descriptions.

Bulk actions confirm the selection count and transfer counterpart behavior. Selection
clears when filters/pages change. Transfers/openings offer review only; ordinary records
retain amount/type corrections. Categories stay in Settings. Empty/error/loading states
and TanStack Query invalidation are reused. No global shell redesign accompanies this work.

## Phase 2B local subviews

Settings now switches between Categories and Rules. Transactions switches between
All Activity and Scheduled; account detail retains its focused ledger. These are local
subviews, not new primary navigation. Rule editing uses existing fields/selectors,
dry-run change/skip summaries, then explicit historical application. Suggestions expose
accept/edit/dismiss, never automatic enablement. Transaction editors show manual field
protection and allow explicit release without changing the financial posting.

Scheduled shows expected cash flow separately from balances, a compact schedule list,
and occurrence rows with dates/status/expected amounts. Inspect offers candidate
confirmation or explicit actual posting, with approximate actual amounts initially empty.
Existing styles, semantic controls, exact Money displays and mobile table scroll remain.

## Phase 3 imports

Transactions adds Imports alongside All Activity and Scheduled. The local workflow is
file/account selection, CSV format/profile and mapping, preview, explicit row decisions,
then account confirmation and atomic posting. Import history reopens drafts or committed
outcomes. Rules and schedule matches appear as proposals; uncertain rows block posting
until resolved. Existing shell, theme and financial formatting remain unchanged.

## Phase 4 Spending & Budgets

The existing Budget icon now opens a functional month/currency workspace. Overview,
Budgets and Insights are compact internal tabs; the shell is unchanged. Layout follows
the inspected spending reference: primary spending headline and daily bars, a 2:1
category/recent-spending and budget-pace layout, then a 3:1 grouped target/copy layout
in Budgets. All amounts come from APIs; only dimensionless chart geometry uses Number.
Signed daily refund values plot below zero. Light/dark tokens, shared Money, headers,
recent-activity rows and loading/error states are reused. Tables scroll locally and
two-column layouts collapse on narrow viewports.

Target and group editors are inline. Category/day/payee controls open paginated
Transactions with explicit spending filters and a clear-filter action. Numeric sort
controls provide ordering; drag-and-drop is deferred. Group disclosures can collapse
long lists. Projection copy distinguishes current, completed and future months.
See [behavior and limitations](BUDGETS.md).

## Phase 5 Investments

The existing Investments destination is functional; shell geometry/theme stay unchanged.
Internal Overview, Holdings, Activity, Accounts and Imports tabs share account/as-of
context. Compact right-aligned holdings show quantity, basis, dated manual price,
market value and results; missing prices remain visibly unavailable. Security detail
shows positions across accounts and actual activity. No historical price chart is
fabricated. General Accounts and cash-history pages identify the cash-only boundary.

ActivityForm shows backend-calculated gross/net cash before explicit confirmation.
AssetForm and PriceForm reuse associated fields, exact Money displays and mutation
invalidation. Brokerage import mapping, preview, row decisions and account confirmation
reuse the existing ingestion conventions. Tables scroll within the page on mobile;
loading, errors, empty positions and unpriced holdings have explicit states.

Public investment reference screenshots and its holdings/detail layout were inspected.
This phase adds no copied source or third-party assets. Existing attribution remains.

## v0.6.0 market-data additions

The existing shell, Overview, investment activity forms and budgeting views remain
unchanged. Investments adds a cached portfolio-value chart with range/currency controls;
security details put the daily price chart before positions and activities. Provider
mapping and corporate-action gaps sit under Pricing preferences and coverage. Cached
observations are an expandable table. Settings gains Market Data alongside Categories
and Rules. Quote date and retrieval/sync timestamps are distinct. Missing totals and
historical gaps remain explicit; no performance percentage is inferred from deposits.

## v0.7 investment analytics

Investments now has Performance, Allocation and Income subviews using the existing
account/as-of toolbar. The primary Performance destination opens the real subview;
it is no longer a synthetic preview. Re-selecting that destination resets the local
subview correctly. No sidebar geometry, theme tokens or general navigation design changes.

Reference performance comparison and income screenshots were inspected, alongside
the source calculations and allocation derivations. The adaptation keeps compact
metrics, a full-width comparison chart, internal tabs, exact tooltips and dense rows.
It retains Finance Tracker's approved dark palette and deliberately omits unsupported
volatility/drawdown statistics, forecast yield, look-through and allocation targets.
Chart geometry uses one shared dimensionless normalization for both return series;
benchmark lines are dashed. The original exact percentages remain in tooltips and
the keyboard-accessible table. Income uses separate charts for original currencies.

Allocation rows drill into securities; sector/geography editing lives on security
detail and leaves missing classification Unknown. Position rankings stay within each
currency and label absolute gains separately from returns. Existing value charts
remain labeled portfolio value, not performance. New controls wrap or scroll locally
at narrow widths, and page actions wrap without changing the global shell.


## v0.9 reconciliation views

Transactions adds Reconcile as a local subview, also accessible within account activity.
Source matching reuses ImportReview; Statements compares exact cutoff balances and
provides explicit clearing, completion and reopening. Existing duplicates requires a
preview and confirmation. Ledger rows show bank state/source count alongside review
and offer Evidence / clearing. The global sidebar, theme and financial semantics stay
unchanged. Decision history and source payloads remain local, text-only details.
