# UI foundation (Phase 1.5)

## Shell and navigation

AppShell owns a persistent 244px desktop sidebar at widths of 1024px and above.
Primary navigation contains Dashboard, Transactions, Transfers, and Categories.
The Accounts section provides management navigation and active account balances.
Selecting an account opens its detail view: calculated balance, metadata, and the
existing ledger filtered to that account. Inactive accounts remain available in
management and dashboard totals, but do not crowd the sidebar.

Below 1024px, navigation uses a native modal dialog with focus trapping, Escape,
an explicit close button, and dismissal after navigation. Tables scroll within
their containers. The existing React state navigation model is retained; deep links
and browser back/forward routing are intentionally deferred.

Light and dark themes use shared CSS surface, border, text, and semantic tokens.
The initial theme follows the system preference. Only the chosen appearance is
stored in localStorage; financial records come from the local API. No placeholder
future pages or external assets/services were added.

## Financial hierarchy

The dashboard presents total account value, monthly income, monthly expenses, and
net cash flow in a compact strip, separately for each currency. Total account value
includes all recorded dates and inactive accounts; it is not a historical snapshot
for the selected month. Investment accounts show ledger cash only.

Previous/next month controls query the existing dashboard and transaction APIs.
Activity bars compare actual income and expenses for that month. Transfers and
opening entries are excluded. Net cash flow is exact income minus expenses.
Account balances and the latest eight monthly ledger entries complete the overview.
There is no fabricated history, exchange conversion, or investment valuation.

## Reusable conventions

- Use PageHeader, Panel, SectionHeader, SummaryMetric, and shared state components
  from `components/primitives.tsx`. Keep padding and spacing compact.
- Use TransactionTable for ledgers. Amounts align right. Income and expenses have
  explicit signs plus semantic colors; transfers use neutral amounts, Sent/Received
  labels, and linked transfer identifiers. Color is never the only cue.
- Use Money and `lib/money.ts` for formatting. Exact decimal strings go to
  Intl.NumberFormat.formatToParts; do not coerce money to JavaScript Number.
  Subtraction uses scaled BigInt. Only dimensionless chart percentages become
  numbers. Compact balances expose full values via title and accessible label.
- Use labeled fields and existing Zod-backed editors. Forms appear on explicit
  add/edit actions; account administration stays separate from navigation.
- Preserve keyboard focus, semantic headers, loading/error/empty states, and local
  scroll regions. Do not hide financial errors with formatting.
- Recent transfers show 20 ledger sides; a pair may cross that boundary. Transfer
  IDs identify relationships. A grouped transfer browser is deferred.

## Balance investigation and local demo correction

On 2026-10-05, the synthetic demo contained an additional BRL 56,745,747 transfer
from Investment Account to Savings. PostgreSQL recorded two correctly linked sides.
The local frontend access log matched its creation at 15:16:26 UTC (12:16:26 Sao
Paulo) to a successful browser POST /api/transfers. This identifies the request's
entry point, not who submitted it or their intent.

This was not a Decimal, aggregation, seed, or test-isolation defect. The seed creates
one BRL 500 transfer and refuses a nonempty financial database. Backend tests use
separate generated databases. The extra transfer explains both anomalous balances
and why the overall total stayed unchanged.

After a local backup, an equal opposite transfer was posted through the existing
API, with a description identifying the original transfer. No history was deleted,
no balances were overwritten, and no schema or accounting rules changed. The
backup is ignored at `data/backups/phase15-before-demo-correction.dump`. Both the
original and correction remain visible, including their large historical amounts.
This is a one-time synthetic demo correction, not a new reversal feature or an
automatic startup repair.

Restored balances: Checking BRL 5,265; Savings BRL 2,500; Cash BRL 300; Investment
Account BRL 0. Total BRL 8,065; October income BRL 1,000; expenses BRL 235. A new seed
regression test verifies those values and exactly one transfer in a fresh demo.

## Validation

Phase 1 accounting and integrity tests remain in place. Frontend tests cover shell
navigation, account details/balances, real month queries, summary values, neutral
transfers, exact localized money, theme switching, and drawer dismissal.

Browser verification used a separate generated PostgreSQL database and local
Compose frontend/backend to keep test activity out of the review demo. It exercised
account creation/edit/activation, category CRUD, income/expense creation/edit/soft
deletion, filters, transfers, account navigation, and dashboard calculations.
Desktop widths 1440, 1280, and 1024 and narrow widths 768 and 390 were checked,
including dialog focus trapping, Escape, navigation, and theme persistence.
Future browser write checks must likewise use an isolated database.
