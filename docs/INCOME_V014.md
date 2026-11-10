# v0.14 Investment Income dashboard

> Current demo lifecycle: run `uv run python -m app.demo` for the complete unified
> household/investment demo. All data below is available together, without scenario
> switching. Earlier scenario launch/switch instructions below describe retained
> regression fixtures and are superseded by [DEMO.md](DEMO.md). Original fixture
> workspaces remain archived. No personal database is changed.


Unreleased implementation; no Git publication or version change.

## Reference and adaptation

Pinned source: Wealthfolio [`92b4647f74ec51fbbb1a772db4f42ea91060c518`](https://github.com/wealthfolio/wealthfolio/tree/92b4647f74ec51fbbb1a772db4f42ea91060c518),
`apps/frontend/src/pages/income/income-page.tsx`, `income-history-chart.tsx`,
comparison/currency/mobile tests and shared card/chart/toggle components. The official
[feature page](https://wealthfolio.app/features/income-tracking/) and dark/light
summary/by-account screenshots were inspected on November 5, 2026. No change of pin.
Public screenshots are visual references, not a running pinned application.

Directly adapted: three tinted summary cards, typography, 24px desktop spacing,
combined/account chart modes, monthly current/prior-year bars, cumulative monotone
area, currency mini-pie, source shares, ranked sources and calendar-period controls.
Thin local adapters replace upstream APIs and monetary Number arithmetic with
exact decimal strings/BigInt ratios. Existing themes, localization, reduced motion,
Brazilian two-decimal formatting and security navigation remain in use.

Deliberate differences: Received/Accrued modes, payment-date FX coverage details,
exact original-payment/redemption tables and existing as-of control. Account scope
remains one/all. All Time has no invented prior-period headline comparison. Axis
labels retain two decimal places rather than compact K abbreviations. The ranking
includes cash interest and is accurately titled Top income sources. Its length
reflects recorded sources; there are no placeholder holdings. The shared shell is
preserved, with explicit demo disclosures rather than hidden synthetic provenance.

## Approved capabilities and financial boundaries

The user approved payment-date reporting FX, historical estimated-net accrual,
redemption-aware period earnings and the fictional income dataset below. Ad hoc
multi-account selection is postponed; named account groups remain postponed too.
No forecasting, yield prediction, tax reporting or distribution inference was added.

### Received Income

Only actual non-void DIVIDEND/INTEREST investment activities count. Salary,
contributions, transfers, returned principal, realized trading gains and unrealized
growth do not enter those totals. Original gross/fees/taxes/net values are retained.
Redemptions appear separately. Monthly averages include zero-payment calendar months
inside the selected period. All Time begins with the first recorded payment inside
the existing ten-year API bound, not an unlimited-inception claim.

YTD starts January 1, not Performance's December 31 opening-value boundary. Last
Year uses the full previous calendar year. Comparisons use matching dates one year
earlier with leap-day clamping. Legacy custom/range links remain under More periods.

`GET /api/investments/analytics/income` accepts optional `currency`. Existing native
events/months/breakdowns remain compatible; an additive `reporting` projection uses
eligible cached FX on the payment date or at most seven prior calendar days, never
future quotes. No network refresh occurs. Each converted field settles to six
decimal places per payment before aggregation, so report events, months and source
groups reconcile; original postings and performance calculations do not change.
The UI still displays money to exactly two places. FX evidence is inspectable by
payment. Native-currency details never sum unlike currencies.

User follow-up (2026-11-06) removes currency and amount-basis selectors. The default
reporting view, read-only original payment details, missing-FX states and existing
explicit native/reporting currency bookmarks remain supported. Record-creation
currency fields remain available; no values or backend settings were rewritten.

Missing FX makes affected group/total fields unavailable. A separately labeled
known subtotal is retained; incomplete charts/shares are suppressed. Missing prior
rates do not become zero comparison bars. Currency slices use converted values for
geometry while preserving original-currency payment labels.

### Accrued Earnings

`GET /api/investments/analytics/income/accrual` is a read-only projection of existing
CDB/RDB contract positions, dated indices and tax estimates. It shares the original
weighted-average reconstruction and fixed-income pricing, including separate RDB
applications. No daily interest transactions or schema migration are introduced.

- Current outstanding gross earnings = eligible gross value minus remaining basis.
- Current estimated-net earnings = existing estimated net redemption minus basis.
- Period gross earnings = closing outstanding earnings minus outstanding earnings
  immediately before the period, plus gross gains redeemed during the period.
- Period estimated-net change uses corresponding estimated-net endpoints plus
  actual net redeemed gains. It includes changes in hypothetical IR/IOF reserves;
  it is neither received cash nor a promised return.

Partial/full redemptions reduce outstanding history but do not erase earned gains
from the period projection. Gross principal returned is not income. Historical net
estimates reuse calendar-day tax ages and existing IR/IOF rules. History starts no
earlier than the first application; missing observations remain null gaps. Unknown
endpoints make period totals unavailable. Gross and dashed estimated-net histories
are available for all contracts or an individual contract.

Tesouro Selic price-based results remain separate and are excluded from contractual
CDB/RDB accrual and Received Income. They may include market-price movements.

## Approved fictional income showcase

The original Brazil demo and `etf-showcase` remain unchanged. Select **Income
Showcase - Simulated ETF Distributions** in Demo, or from `backend` run:

```sh
uv run python -m app.demo --scenario income-showcase
```

`--prepare --scenario income-showcase` initializes without serving. The version is
`simulated-income-showcase-2`, in its own owned, ignored
`data/demo-v012-income-showcase-2/` workspace. Existing saved scenarios are neither
reseeded nor adopted. Initialization resumes edits; explicit reset restores only
this scenario's validated baseline and rejects stale-generation writes.

It starts from a fresh copy of the fictional ETF seed through the same services,
with a second investment account, Simulated Income Brokerage. An internal BRL 8,000
transfer on 2025-02-03 funds its purchase of 75 `SIM-DIVIDEND-ETF` units on
2025-02-04 at the generated fictional close. Checking retains BRL 17,000. The asset,
prices and cash distributions are explicitly fictional, not exchange observations.
No official CDI/Treasury or real ETF histories are mixed into this scenario.

| Payment dates | Kind | Calculation | Total BRL |
| --- | --- | --- | ---: |
| 2025-03-31, 06-30, 09-30, 12-30; 2026-03-31, 06-30, 09-30 | 7 dividends | 75 units × fictional per-unit amounts 1.20, 1.30, 1.10, 1.40, 1.35, 1.45, 1.50 | 697.50 |
| February 2025–September 2026 | 20 cash-interest credits | 18.00 increasing by 0.75/month; processing day 20 or next existing-calendar business day | 502.50 |

Fees/withholding are zero fictional assumptions, not real ETF distributions or a
tax-law claim. Cash interest goes to the original Simulated ETF Brokerage, not a
CDB/RDB. The new workspace contains three fictional assets, 1,566 synthetic price
observations and 35 investment activities, including 27 paid-income credits.

All Time received income is BRL 1,200.00; monthly average over February 2025–September
2026 is BRL 60.00. Calendar 2025 pays BRL 614.25; 2026 YTD through September pays
BRL 585.75. The original ETF scenario still has no distributions. Purchases and
funding redistribute cash; only actual credits and price movements change wealth.
Portfolio value plus separate checking equals Net Worth exactly once.

## Validation

Backend regressions cover payment-date/stale/future FX, per-payment precision and
group reconciliation, missing indices, account scope, partial/full redemptions,
historical net estimates, bounded history, seed repeatability, cash/holdings/net-worth,
valid performance, scenario switching/reset and personal-data isolation.
Frontend tests cover calendar boundaries, exact summaries, native/payment currency
selection, complete/partial reporting adapters, empty received/accrual states,
Treasury separation and source navigation. Browser checks run only against owned
temporary roots and never reset the live demo or personal database.

Validation results and ignored matching-resolution comparison captures are recorded
in `docs/screenshots/v014-income/`. No restricted market data, generated database,
credentials, reference graphics or screenshots are part of application source.

Final checks: **497 backend tests** and **262 frontend tests** passed. Ruff lint/
format, ESLint, Prettier, TypeScript and production build passed. Three existing
seed-connection warnings and existing dependency annotation/large-chunk build
advisories remain. No new runtime dependencies or schema migrations were needed.
Playwright passed all three isolated scenarios, exact totals, account selection,
YTD/Last Year/custom dates, native/reporting and missing-FX behavior, chart modes,
holding links, dark/light captures, 1440/1920/390px overflow and mobile drawer.
Original Brazil and ETF account snapshots match after switching back. The live
Brazil demo was restarted with the same workspace and unchanged account responses.

Open local `docs/screenshots/v014-income/index.html` for paired 1440×900 reference/
implementation images and larger/mobile checks. Remaining intentional differences
are listed above and in the gallery; no pixel-identical or running-reference claim.

## Source-parity correction (2026-11-06)

The empty screenshot was the original Brazil portfolio, which has no distributed
investment cash income. CDB/RDB accrual must not be turned into invented payments.
An additional visual defect depended on navigation order: Net Worth's lazily loaded
`.dashboard-card-body` CSS was global and added nested panels to Income. The rules
are now scoped to Net Worth, with Income's own single-surface body styling explicit.
Browser regression visits Net Worth before Income and verifies transparent,
borderless, zero-padding summary bodies in both themes.

The pinned Income page and history-chart source were inspected again. The refinement
adds full source names next to ticker badges, a top-five/Other strip, ten ranked
sources, a proper legend, evenly spaced date ticks and the source nice-step axis
algorithm adapted to exact BigInt units. Monthly/cumulative axes align. The history
panel stretches with the source list instead of leaving an undersized chart; mobile
uses fewer date labels and hides the secondary axis while preserving tooltip values.
No cash postings or financial values are inferred by chart interpolation.

**Income Portfolio - Dividend Showcase** is a fourth optional scenario,
`--scenario income-portfolio`, in its own owned `data/demo-v012-income-portfolio-1/`
workspace. It preserves the original Brazil, ETF and 27-payment Income showcase
workspaces. In the empty Brazil Received view, **Open income demo** explicitly
switches to the populated scenario and keeps the Income tab open. It never silently
replaces household data. A return-to-household action remains available. Income
shows a compact simulation label; the full simulation explanation is in the footer.

When launching the rich scenario directly from the CLI, open
`http://127.0.0.1:8001/#/insights?view=income`. Household spending remains in the
separate Brazil workspace and can be reopened with Return to household demo.

The new seed starts from a fresh original Income fixture, then funds the second
brokerage with another BRL 10,000 transfer on 2025-02-04. Eight additional fictional
income securities are purchased on 2025-02-05, using deterministic SYNTHETIC prices.
No real ETF prices, official observations or personal records are mixed into it.
SIM-DIV is the same initial fictional income holding, with a shorter rich-scenario
display symbol; the original showcase is unchanged.

| Additional fictional symbol | Units | First simulated price | Base distribution / unit | Frequency |
| --- | ---: | ---: | ---: | --- |
| SIM-REIT | 15 | 100 | 0.85 | Monthly |
| SIM-LOG | 15 | 90 | 0.75 | Monthly |
| SIM-CREDIT | 15 | 75 | 0.65 | Monthly |
| SIM-INFRA | 15 | 50 | 0.40 | Monthly |
| SIM-UTIL | 20 | 40 | 1.10 | Quarterly |
| SIM-BANK | 20 | 30 | 0.90 | Quarterly |
| SIM-VALUE | 10 | 85 | 2.20 | Quarterly |
| SIM-QUALITY | 10 | 70 | 1.70 | Quarterly |

First simulated prices initialize the generator in October 2024; execution prices
use the actual generated February 5 observation, not the initialization value.
Monthly payments run February 2025–September 2026 on day 18 or the next existing
calendar business day. Quarterly dates match the original seven dividend dates.
Distribution multipliers rotate through 0.90/1.00/1.05/1.10 with fixed offsets.
These are explicitly fictional distributions, not historical yields or tax claims.

The rich dataset has **11 assets, 5,742 synthetic observations and 151 investment
activities**, including **135 cash distributions/interest credits**, **10 income
sources** and **2 paying accounts**. Exact received income is BRL 2,564.587500:
BRL 2,062.087500 dividends and BRL 502.500000 cash interest. The 20-month average is
BRL 128.229375. Display values are **R$ 2.564,59** and **R$ 128,23**. Checking retains
BRL 7,000 after internal funding. Cash remains nonnegative; portfolio plus checking
equals Net Worth once. Repeat initialization, reset and source grouping reconcile.

Validation: full backend suite **499 passed**; full frontend suite **264 passed**.
The existing three seed warnings and build advisories remain. No new dependencies,
schema migrations, live integrations or financial-calculation changes were needed.
