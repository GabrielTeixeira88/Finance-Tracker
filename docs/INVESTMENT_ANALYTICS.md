# Investment analytics — v0.7.0

## Reference inspection and decisions

Inspected the reference checkout at commit
`392f272c5b15a4af45dc2ff71dcbec474f47112a`: performance service and its
TWR/XIRR tests, scope-aware flow classifier, and the public performance comparison
and income screenshots. References: [performance](https://wealthfolio.app/features/performance-dashboard/),
[income](https://wealthfolio.app/features/income-tracking/), and
[source](https://github.com/wealthfolio/wealthfolio/tree/392f272c5b15a4af45dc2ff71dcbec474f47112a/crates/core/src/portfolio/performance).
The implementation is original Python/TypeScript; no reference source or image is
copied into the application. Existing source/license notices remain intact.

Reuse the existing historical valuation, dated FX, activity reconstruction and
linked-transfer identities. Analytics reads never post activities or fetch providers.
An account group includes inactive accounts explicitly selected in that scope.
Both sides of a transfer inside the scope are internal; one side inside is external.
Opening balances are external funding, not profit. BUY/SELL, investment income,
fees and taxes remain internal. Ordinary investment-account income/expense postings
are owner funding/withdrawals; investment income must use investment activities.

The initial daily TWR convention treats external flows at end of day:
`factor = (closing value - net external flow) / previous closing value`.
This differs deliberately from the reference's beginning-of-day inflow convention.
It reproduces the specified 10,000 → 11,000 plus 9,000 contribution example as 10%.
Date-only records cannot establish intraday flow timing. A zero-capital funding day
starts the chain without manufacturing a return; unexplained gains on such a day
are unavailable. Negative capital, missing valuations/FX and unknown transfer
boundaries invalidate the affected chain rather than presenting a priced subset.

XIRR uses actual dates, a 365-day annualization basis and Decimal arithmetic.
Beginning value and contributions are investor outflows; withdrawals and ending
value are investor inflows. Short periods must be labeled as annualized. Solver
limits and ambiguous roots must be exposed instead of selecting an arbitrary rate.
Monetary rounding occurs only at the API boundary, never between valuation and returns.

## Queries and periods

All endpoints are under `/api/investments/analytics`:

| Method/path | Purpose |
| --- | --- |
| GET `/performance` | `end`, optional `start`, currency, repeated `account_ids`, benchmark_id |
| GET `/income` | Inclusive start/end, optional accounts and asset_id; original currencies |
| GET `/allocation` | as_of, reporting currency and optional accounts |
| GET `/insights` | start/end, reporting currency, optional accounts and asset_id |
| GET/PUT `/assets/{id}/classification` | Explicit sector/geography, no financial mutations |

Return periods use **closing value on start** through **closing value on end**;
external flows after start through end are included. Missing start on performance
means the day before the first non-void activity or ordinary ledger record in scope.
Inactive accounts remain part of the history. The API accepts explicit account groups;
the UI currently selects one account or the whole portfolio. Date-only ordering is
the existing ledger date/activity sequence; no intraday timing is invented.
Historical requests are bounded to ten years. ALL performance uses actual inception
and rejects longer ranges rather than silently discarding older return history.
Income dates are inclusive; each original currency has a separate chart and totals.

`absolute gain = ending value - opening value - net external flows`. This is a
currency amount, not TWR or XIRR. Missing interior valuations invalidate TWR's chain;
XIRR needs endpoints and exact flows but does not require interior daily prices.
Zero-capital days with only new funding are neutral. An unexplained gain with no
capital, negative capital or unknown linked-transfer boundary is unavailable.

XIRR combines same-date investor legs for solving, retaining the individual source
flows in the response. One chronological sign change guarantees at most one root.
More sign changes are conservatively labeled POTENTIALLY_MULTIPLE_ROOTS, even when
a particular stream might have one root; no arbitrary root is selected. Decimal
log-rate bisection searches annual rates `exp(-20)-1` through `exp(20)-1`, with at
most 200 iterations. Missing signs, bounds, dates or convergence have explicit
reasons. The independent irregular-date regression uses the published
[Microsoft XIRR example](https://support.microsoft.com/pl-pl/excel/functions/xirr-function)
and its documented precision. Unlike the reference's solver, no money becomes float.

## Benchmarks and data quality

Select an existing security as a **price-return proxy**, including unheld securities.
The exact listing/currency/provider mapping and existing refresh controls live on
its security page. No unsupported index or CDI feed is implied. Prices use the same
raw/manual policy as holdings, with dated FX at each comparison date and the same
opening boundary. Dividends are not reinvested in this price-only series; comparing
it with a net portfolio return is informational, not total-return-index outperformance.
Difference is in percentage points. Benchmark choice is local component state, not
a persisted preference. Quote source/date/retrieval and missing-day counts are exposed.

COMPLETE means all required inputs for that metric exist under the seven-calendar-day
carry policy. PARTIAL allocation exposes a known subtotal but no complete total or
weights. PARTIAL benchmark coverage can retain an endpoint return while exposing
interior gaps. UNAVAILABLE returns are null with reason codes, never zero. Missing
asset/FX coverage and corporate-action blocks use the existing shared price/FX readers.
An endpoint price may be carried; complete does not mean an intraday/live quote.
Synthetic and live sources remain separated by existing settings. Read requests
never refresh market data or mutate the ledger.

## Income, allocation and components

Income is actual non-void DIVIDEND/INTEREST gross, recorded fees/taxes and net cash,
grouped monthly, yearly, by account/security and type. Closed securities retain past
income. No forward yield or annualized dividend estimate is inferred from a payment.
The reference income service's fallback to an unconverted amount is deliberately
not adopted: this implementation keeps original currencies separate.

Allocation includes cash plus historical security quantities times eligible prices.
Cash is not counted again as a security. Group by security/listing, account, asset
class, currency, sector or geography. Unpriced or unconvertible holdings invalidate
weights rather than making the known subset look like 100%. Top-1/3/5 concentration
uses security value divided by the complete cash-inclusive portfolio; cash is not a
security leader. Metadata is explicit and current even when viewing a past date;
Unknown is visible. There is no issuer inference, ETF look-through or target engine.

Position components use the existing weighted-average reconstruction at both
boundaries: period realized change, ending unrealized, period unrealized change,
net income and standalone charges. Trade fees/taxes already affect basis/proceeds;
income charges already affect net income. Their displayed totals are disclosures,
not amounts to deduct again. Period position gain is realized change + unrealized
change + net income - standalone charges. Closed positions stay visible. Ranking
compares absolute amounts **within each original currency**, not security TWR.

For unchanged quantities with no trades and complete boundary prices/FX:
`local effect = quantity * (end price - start price) * start FX`;
`FX effect = quantity * end price * (end FX - start FX)`.
These sum to the reporting-currency security value change. Other cases are
unavailable. This is not full cash/flow/trading FX attribution. P&L components are
not claimed to sum to a time-weighted percentage.

## UI and synthetic demo

The approved shell remains intact. Investments adds Performance, Allocation and
Income beside existing internal views. The previous primary Performance destination
opens the same real analytics, without requiring demo fixtures. Overview contains
a compact three-month return summary, not a second performance chart. Security
detail adds results and explicit classification. Performance controls select ranges,
custom dates, reporting currency and benchmark; Income adds grouping; Allocation
exposures and result rows drill into actual securities. Tables, accessible exact
chart data, loading/error states and query invalidation reuse existing primitives.

Run `uv run alembic upgrade head`, then `uv run python -m app.seed_analytics_demo`
against an **empty separate DATABASE_PATH**. It extends the market fixture with two
funded accounts, three fictional securities (one unheld benchmark), nine activities,
three linked contributions/withdrawals/internal transfers, classifications and dated
synthetic raw prices. Total: ten accounts, twelve securities, 39 investment activities,
516 ordinary ledger rows, with the earlier 18-month spending history preserved.
Fixed dates, UUID5 identities and timestamps produce identical database snapshots.
Repeated seeding preserves edits; it never retrofits/reset-populates an existing DB.
Choose Synthetic Analytics Portfolio through September 30, 2026 for full coverage;
legacy deliberate price gaps remain visible in other scopes.

## Validation and remaining boundaries

Baseline before changes: 226 backend and 75 frontend tests passed. Validation uses
isolated synthetic databases, fresh migrations and a populated v0.6 upgrade with
every old table compared unchanged. A 1,200-activity, twenty-security, ten-account,
three-year test checks exact results and bounded database query count.
Final validation: **262 backend tests and 81 frontend tests passed**. Ruff lint and
format checks, ESLint, Prettier, TypeScript checking and the production build passed.
The build retains non-blocking dependency annotation and bundle-size warnings.
Fresh/populated migrations, foreign-key integrity, deterministic seed repeatability
and unchanged responses across an API restart passed on isolated SQLite databases.

Real browser checks exercised Performance, account/range selection, a cached benchmark
overlay, Income/year grouping, Allocation/sector drill-down and classification editing.
Screenshots were inspected at 1440×900, 1920×1080 and a 390px mobile viewport; the
mobile drawer and page-overflow checks passed without browser JavaScript errors.
The existing investment browser regression also passed funding, BUY/SELL, weighted
average cost, dividends, fees, manual prices and brokerage preview/confirmation/reimport.
Budget totals and investment activities remained unchanged by analytics interactions.
Privacy review found no sensitive project files; generated databases, logs, build
artifacts and validation screenshots remain ignored. No user database was reset or
modified. The release audit adds explicit 10,000 funding / 7,000 purchase and 5,000
inter-brokerage scope regressions, preserving zero artificial gain and cash-inclusive
allocation. Version metadata is synchronized at 0.7.0; Gmail remains future work.

Deliberate limits: date-only end-of-day timing; ten-year requests; conservative
multiple-sign-change XIRR; price-only benchmark proxies; no persisted benchmark
preferences or multi-account selection UI; current classification metadata; no yield
forecast, look-through, corporate actions, full FX attribution, tax reports or risk
scores. These limitations are not silently replaced by estimates. Gmail, trading,
rebalancing, reconciliation and later product phases are not implemented here.
