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
totals. Investment accounts contain cash only. Accounts administration retains
all-recorded-date balances; Overview uses the selected ending date.

## Shell and navigation

Desktop starts with a 70px collapsed sidebar; the footer control expands
it to 220px. Accessible names and hover titles remain available when labels collapse.
Find a page filters navigation destinations only, not financial records. The existing
Overview, Accounts, Transactions, Budget, Investments, Performance, Net Worth, Reports,
and Settings destinations remain; future sections retain Preview labels in expanded
navigation, accessible names, tooltips, and their pages. Settings stays at the bottom.
Account rows open the existing filtered account ledger. React state navigation remains;
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

Budget compares separately stored fictional monthly targets with actual demo expenses.
It offers no budget editing or persistence domain. Investments displays fictional
allocation, holdings, activity, and a link to a Performance illustration. Those
fixtures are deliberately independent of investment-account cash and cannot affect it.
Performance points illustrate a chart only, with no TWR, benchmark, or valuation claim.
Net Worth uses actual ledger history and account breakdown, labeled Total balance.
Reports composes the existing spending, flows, and balance information; no report
builder, exports, or reporting engine is implemented.

Budget/Investments/Performance require the explicit historical demo fixture; an ordinary
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
