# Financial chart presentation (unreleased v0.14)

Reference: pinned upstream `92b4647f74ec51fbbb1a772db4f42ea91060c518`,
`apps/frontend/src/components/history-chart.tsx`. The shared conventions adapt its
monotone curve, restrained gradient, thin stroke and hover marker while retaining
local themes, responsive containers and the existing reduced-motion hook. We do
not copy upstream's unconditional `connectNulls=true`.

## Modes and authoritative values

`frontend/src/lib/chart-presentation.ts` defines three explicit modes:

| Data | Mode | Presentation |
| --- | --- | --- |
| Bank ledger balances and goal reservations | `ledger` | `stepAfter`; a discrete posting stays discrete |
| Manual asset detail valuations | `manual-observations` | `monotoneX` through sparse recorded observations; visible recorded dots |
| ETF/security prices, portfolio/fixed-income valuations | `market` | `monotoneX` through supplied dated values; no generated prices |

Portfolio/security charts share 1.5px strokes, light gradient stops, active dots,
responsive dimensions, exact source-value tooltips and null breaks. A single manual
observation renders a dot, not an invented second observation. Zero is a valid
financial observation and remains zero. Missing coverage remains null. Normalized
BigInt ratios become dimensionless coordinates; monetary values never become JS
Numbers. Monetary/percentage labels and data tables use the fixed two-decimal Brazilian
display convention. Original exact strings remain authoritative in APIs and
financial calculations; display rounding is never fed back into valuations.

Manual detail charts consume only eligible, non-voided, actual dated observations,
not daily forward-filled net-worth points. The connecting curve is explicitly a
visual estimate. Tooltips identify recorded valuations; no intermediate monetary
values are written, returned as observations or used for net-worth calculations.
Latest eligible values still carry forward in financial reporting. Disposal is an
ownership event: existing historical net-worth services remove the asset on its end
date; a manual observation graph does not fabricate a zero-price valuation.

Performance portfolio/benchmark curves use the shared market mode with the same
normalization domain and preserved gaps. Fixed-income accrued value/returns use
market mode; principal steps remain ledger mode.

Net Worth retains its authoritative daily projection and explicit missing-coverage
breaks. Its category trends remain daily aggregate projections, not standalone
asset-price estimates. Overview's existing continuous composition chart remains
unchanged. Genuine discrete bank histories continue to use the ledger chart.

## Car endpoint diagnosis

An isolated replay of the Brazil Car detail returned recorded valuations ending at
BRL 38,000.000000 on 2026-09-30. Before the change, the SVG stroke ended with
`L833,189.294L833,252.345`: the same x-coordinate and a vertical final step. There
was no final null, zero fallback, disposal or unexpected database valuation.
`stepAfter` held the prior BRL 40,000 observation until the final date and drew its
valid decline as an abrupt vertical edge. Changing only the presentation to
`monotoneX` preserves the BRL 38,000 endpoint and displays a gradual connection.

Reproduction and visual evidence (ignored local files):

```powershell
cd frontend
$env:DEMO_E2E_PORT='5174'
$env:CHART_STAGE='after'
node scripts/demo-e2e.mjs --real-market-only --charts
```

The runner uses an owned temporary database and refuses an occupied port. It also
exercises the separate ETF showcase, holdings, security chart, performance and
cross-scenario reset. `docs/screenshots/v014-charts/index.html` pairs before/after
1440x900 Car captures and links ETF views. The official Net Worth reference is
shown separately as a visual-language reference, not a same-data comparison or
claim that the upstream application ran locally.


Validation: 485 backend tests and 236 frontend tests pass. Chart tests cover exact
sparse increasing/decreasing values, single observations, null gaps and explicit
ledger versus market modes. Existing financial tests cover disposal, unavailable
valuations and ownership boundaries. The owned browser replay verifies the Car
endpoint/path, two ETF histories, scenario selection, allocations/performance,
reset isolation and responsive captures. No financial calculation was changed.

## Investment Income adaptation (v0.14, unreleased)

Received Income uses actual monthly payment totals: grouped prior/current bars,
optional account stacks and a source-style cumulative area. The curve connects
calendar-month aggregates for display only; it does not create intermediate payments
or modify cash reconstruction. Coordinates use bounded BigInt ratios and tooltips
retain exact monetary strings. No received-income history chart is rendered when
there are no recorded payments. The existing fixed-income chart can separately show
dated gross and estimated-net outstanding earnings; null observations retain gaps and a fully missing
history is explicitly unavailable. Treasury price-based results are not contractual
CDB/RDB accrual. The approved historical net/period-earnings projection reuses
contract pricing and tax services. Its dashed net curve may change with dated
IR/IOF reserves; no cash movements are inferred. It starts at the first application
instead of drawing years of invented zero history. See [Income](INCOME_V014.md).

Income's nice-step tick generation and aligned cumulative axis now use BigInt money
units with normalized display coordinates. The plot fills its source-style panel
beside the ten-source list; mobile retains exact tooltip values with a single axis.
The Net Worth card-body styles are feature-scoped so visiting it cannot add nested
surfaces to Income. The isolated income portfolio supplies actual fictional payment
history rather than presentation arrays. See the [refinement record](INCOME_V014.md#source-parity-correction-2026-11-06).
