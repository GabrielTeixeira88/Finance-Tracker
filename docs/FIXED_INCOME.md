# Brazilian fixed income (unreleased)

The current [historical Brazil demo](REAL_MARKET_DEMO.md) adds `RDB_CDI` as
distinct dated Caixinha application lots using the same accrual/tax services.
Fictional ownership/terms are independent of observation provenance: a fictional
contract may use real manually imported CDI. Only `SYNTHETIC` observations require
the synthetic valuation universe. `OFFICIAL_PU` identifies dated Treasury morning
redemption marks; it is not a market closing price. Migration `sqlite_0017`
preserves existing contracts/prices and restores the retained-term triggers.

Investments → Fixed Income records completed BRL subscriptions and explicit
redemptions. CDB/CDI, fixed-rate CDB and Tesouro Selic use immutable contract terms,
existing investment activities and their sole brokerage-cash posting. No ordinary
income/expense twin is created. Positions, net worth and performance reuse the
historical price/FX and activity reconstruction services.

## Supported contract

One acquisition, account and asset per contract: issuer, settlement/maturity,
redemption availability, daily/maturity-only liquidity, principal quantity,
contractual rate, source, fictional flag and stated FGC eligibility. CDB quantities
represent one-real principal units; Tesouro uses fractional units and an explicit
purchase price. Products do not require an exchange ticker. A contract UUID identifies
its generated security. Normal purchases use MANUAL observations; SYNTHETIC is
restricted to explicitly fictional contracts. API request UUIDs prevent duplicate posting.

`sqlite_0014` adds contracts, dated index factors, foreign keys, exact-text checks
and immutable-term triggers. It does not rewrite existing transactions or holdings.
Use the dedicated subscription/redemption service: generic activity editing/voiding
and manual CDB price overrides are rejected. A contract correction/replacement UI
is not implemented; do not edit the database to bypass these guards.

## Accrual and history

All calculations use Decimal (60-digit working precision), exact money storage and
decimal-string transport. Daily factors retain 18 fractional digits. CDB unit prices
use the existing six-place settlement convention. This is an application accounting
precision, not a claim to reproduce every broker's cent-rounding statement.

- Fixed rate: daily factor `(1 + annual_rate / 100) ** (1 / 252)`.
- CDI: each dated factor contributes `1 + (factor - 1) * CDI_percentage / 100`.
  Multiply the factors for business days in `[settlement, valuation_date)`.
- No fallback from a missing factor to a flat/current rate. Missing daily observations
  make the affected valuation unavailable. Factors are dated, never taken from the future.
- Gross contractual accrual stops at maturity. Maturity does not automatically redeem
  or post cash. Actual redemption applies the calendar holding period for estimated taxes.
- Tesouro Selic uses dated market/manual prices and fractional quantity. A contractual
  spread is descriptive; CDI/Selic accrual is not substituted for its traded market price.
  The existing seven-day prior-price carry and missing/blocked coverage guards apply.

The built-in business calendar excludes weekends, national holidays, Carnival Monday/
Tuesday, Good Friday and Corpus Christi; November 20 applies from 2024. It does not
model municipal holidays or exceptional exchange closures. Effective settlement and
maturity must be business days. Contracts are bounded to ten years.

Method references: [B3 DI methodology](https://www.b3.com.br/pt_br/market-data-e-indices/indices/indices-de-segmentos-e-setoriais/di/metodologia-de-apuracao-da-taxa/),
[ANBIMA holidays](https://www.anbima.com.br/feriados/) and
[Tesouro rules](https://www.tesourodireto.com.br/sobre-o-tesouro/regras-e-regulamento).

## Redemption, tax and income

Preview validates the same posting inside a rolled-back savepoint. Confirmation
creates one SELL, releases weighted-average principal and credits net proceeds
atomically. Partial/full redemptions reject overselling, unavailable liquidity,
missing required valuation and invalid funding/history. Tesouro requires an actual
executed unit price. Fees are explicit; no implicit custody-fee deduction is invented.

On positive gross interest only, the estimated IOF table applies before day 30,
then is zero. Estimated IR is 22.5% through day 180, 20% through 360, 17.5% through
720 and 15% thereafter, on positive interest after IOF. Losses do not create a tax
credit. Estimates are shown before confirmation; this is not a tax-return engine.
Issuer-specific withholding, tax exemptions, custody accrual, FGC coverage-limit
aggregation, tax-lot election and automatic maturity processing are not supported.

Unrealized accrual never becomes a dividend or personal income. Income displays
paid DIVIDEND/INTEREST activities separately from dated redemption principal,
gross proceeds, fees/taxes, net proceeds and realized result. Fees already in proceeds
or basis are not deducted twice. A redemption is a capital transaction, not consumption.

## Synthetic demo and sources

The isolated demo adds CDB 100%, 110%, 120% CDI, fixed 13.5% and Tesouro Selic positions
using existing funded brokerage cash. All index regimes and Treasury prices are
explicitly fictional, deterministic October 2024–September 2026 fixtures. Treasury
prices include a dated spread change and genuine mark-down. They are not verified
current BCB/CDI observations, even where the rates look plausible.

Normal users can record verified daily factors through **Record dated index** and
Treasury observations through the existing dated manual price workflow. No live BCB,
ANBIMA or Treasury downloader is introduced. Missing real observations remain visible.

The Securo inspection found a Treasury quote adapter and bond identity tests, not
a reusable tested CDB compounding/tax/redemption engine. This implementation is native
and preserves the application's exact storage and ledger boundaries; see the
[reference audit](WEALTHFOLIO_PARITY_v0.13.md).
