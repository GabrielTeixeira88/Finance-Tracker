# Portfolio Showcase - Simulated ETFs

> Current demo lifecycle: run `uv run python -m app.demo` for the complete unified
> household/investment demo. All data below is available together, without scenario
> switching. Earlier scenario launch/switch instructions below describe retained
> regression fixtures and are superseded by [DEMO.md](DEMO.md). Original fixture
> workspaces remain archived. No personal database is changed.


This optional scenario is entirely fictional. It does not contain WRLD11, IVVB11,
real index returns or downloaded ETF quotes. The existing Real Market Portfolio -
Brazil remains the default with unchanged official CDI/Treasury observations and
its optional authorized private ETF setup.

## Launch and switch

Build the frontend, then start from `backend`:

```sh
uv run python -m app.demo --scenario etf-showcase
```

Open http://127.0.0.1:8001. Or start the normal Brazil demo, expand **Demo** and
choose **Portfolio Showcase - Simulated ETFs** under **Demo scenario**. Selection
and reset of this scenario open Investments; direct CLI startup retains section
bookmarks, so choose Investments if your browser opens Spending. Switching
preserves each scenario's saved edits; Reset demo resets only the selected owned
workspace. Neither operation uses the personal financial database. Preparation
without serving is `uv run python -m app.demo --prepare --scenario etf-showcase`.

Storage is server-selected: `data/demo-v012-etf-showcase-1/`, owned and ignored,
with baseline backups, generation guards and process locking. It cannot reuse the
Brazil snapshot-fingerprinted root or adopt a normal database. Public startup still
excludes the retired international/European household; its explicit regression
fixture remains unchanged.

## Fictional instruments and generation

- `SIM-GLOBAL-ETF`: Fictional Global Equity ETF, BRL, SYNTHETIC exchange.
- `SIM-SP500-ETF`: Fictional S&P 500-style ETF, BRL, SYNTHETIC exchange.

The second instrument illustrates an S&P 500-style investment; it does not model or
claim the actual index's historical performance, constituents or returns. Both
identifiers are application-only, not exchange symbols.

`backend/app/demo/etf_showcase.py` generates 522 weekday observations per instrument
from 2024-10-01 through 2026-09-30. An integer linear-congruential generator with
fixed seeds supplies bounded daily variation; explicitly fictional negative regimes
in February-April 2025 and February-March 2026 supply declines and subsequent recovery.
All price arithmetic is Decimal with 60-digit working precision, settled to six
places. There are no live APIs, downloaded quotes, random machine/time seeds or
frontend financial arrays. Weekend values use the existing bounded prior-observation
policy; no new exchange-calendar claims are made for these fictional instruments.

Observations use the existing `SYNTHETIC` source, `RAW_CLOSE` convention and synthetic
asset pricing adapter. The snapshot creation stamp is 2026-09-30 UTC, not a genuine
provider retrieval. Asset names, details, scenario disclosure and chart tooltips
identify simulation. The ordinary production synthetic/official eligibility guards
are unchanged. No official fixed-income contracts, CDI rates, Treasury prices or
real FX observations are mixed into this workspace.

## Funding and activities

The fictional investor starts with BRL 100,000 in Showcase Checking. An atomic
internal transfer funds the Simulated ETF Brokerage with BRL 75,000 on 2024-10-02.
Checking retains BRL 25,000. Purchases/sales go through `investments.post`, with
single activity cash postings, oversell/funding checks and weighted-average basis.
Execution prices equal each generated dated close. Fees/taxes are zero assumptions,
not a jurisdictional tax simulation. No dividends or benchmarks are fabricated.

| Date | Instrument | Activity | Quantity |
| --- | --- | --- | ---: |
| 2024-11-05 | SIM-GLOBAL-ETF | BUY | 100 |
| 2025-02-05 | SIM-SP500-ETF | BUY | 45 |
| 2025-07-07 | SIM-GLOBAL-ETF | BUY | 80 |
| 2025-11-05 | SIM-SP500-ETF | BUY | 35 |
| 2026-04-06 | SIM-GLOBAL-ETF | BUY | 90 |
| 2026-06-05 | SIM-GLOBAL-ETF | SELL | 40 |
| 2026-08-05 | SIM-SP500-ETF | BUY | 30 |

The closing positions are 230 and 110 units. At 2026-09-30, authoritative services
produce BRL 70,016.974320 holdings plus BRL 18,707.594185 brokerage cash, for
BRL 88,724.568505 portfolio value. Remaining cost basis is BRL 57,434.512488;
realized gain is BRL 1,142.106673 and unrealized gain BRL 12,582.461832. Net worth is
BRL 113,724.568505 including the separate BRL 25,000 checking balance exactly once.
Full-window TWR is 18.299425% and annualized actual/365 XIRR is 8.790649%.
TWR/XIRR and allocations use the existing read-only analytics and dated cash flows;
portfolio contributions never become investment returns.

Repeated initialization resumes edits without reseeding. The generator and
financial results are deterministic; opaque database record IDs are not financial
observations. A reset restores the existing snapshot rather than accumulating more
activities. A dataset algorithm change must increment its dataset revision and
use a new owned workspace, never silently rewrite saved edits.

## Validation and limitations

Tests independently reconstruct weighted-average sale basis and gains, verify
quantities, dense dated histories, exact cash/holdings/net-worth reconciliation,
non-null valid TWR/XIRR, allocation quality, seed idempotence, declines/recovery,
scenario switching, reset and stale-generation protection. The personal database
sentinel and original Brazil report remain unchanged. Playwright covers selection,
Overview, Holdings, security history, Performance and responsive captures.

This scenario demonstrates the engine and visual behavior, not real-market results.
It has no real corporate actions, transaction costs, distributions, exchange-holiday
calendar, real ETF tracking error or benchmark returns. The original private ETF
import path and unavailable-coverage messages in the historical demo are preserved.

An additional approved [Income Showcase](INCOME_V014.md) starts from a new copy of
this seed and adds a fictional dividend-paying ETF and cash-interest credits.
Select `income-showcase` explicitly. Its versioned root is separate: this original
`etf-showcase` dataset, prices, no-distribution behavior and saved edits are unchanged.


Validation (2026-11-05): full backend suite 485 passed (three pre-existing seed
warnings); frontend 236 passed; lint, formatting and TypeScript/production build
passed. The build retains its existing large-chunk advisory and dependency PURE
annotation warnings. Both scenarios passed the isolated Playwright chart/showcase
suite, including simulated tooltip labels, full range, security history,
performance, exact reset snapshots and unchanged Brazil account responses.
Local screenshots and exact financial checks are in the ignored
`docs/screenshots/v014-charts/` gallery. No data snapshots, secrets, restricted
exports or generated databases were staged or published.


## Empty Spending in the ETF showcase

The ETF showcase intentionally has no household income, expenses, budgets or goals.
Its funding transfer and investment activities must not be counted as spending.
If Spending shows zero in this scenario, use **Return to household demo** in the
persistent scenario banner, or select Real Market Portfolio - Brazil from Demo.
This reopens that scenario's saved records; do not reset/reseed or combine the two
price sources to populate the screen. Normal/default startup remains the Brazil
household; an explicit `--scenario etf-showcase` is opt-in.

Regression coverage switches Brazil -> ETF -> Brazil and verifies the exact
original spending response and personal-database sentinel remain unchanged. The
browser exercises the direct return button and confirms household spending returns.
