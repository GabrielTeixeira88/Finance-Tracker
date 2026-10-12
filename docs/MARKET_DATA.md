# Market data and valuation

## Implementation approach recorded before coding

The reference implements provider capabilities and symbol resolution separately from
quote storage, synchronization and portfolio calculations. Its sync state tracks
coverage and activity dates, and its security UI separates manual tracking from
provider history. We adapt these boundaries, explicit errors, cached reads and
activity-scoped backfills. We do not port its Rust plugin registry, writer framework,
provider fallback chain or performance engine. No reference source is copied.

Reference inspected: [architecture and source](https://github.com/wealthfolio/wealthfolio/blob/main/docs/architecture/market-data-quotes.md),
provider traits/Alpha Vantage adapter, SQLite sync-state repository and asset quote toolbar.
The existing weighted-average activity ledger remains authoritative and unchanged.

## Provider decisions

- Brapi v2 quote/historical endpoints, bearer authentication. Public test symbols
  are PETR4, MGLU3, VALE3 and ITUB4; other securities require a configured key.
  Plan-dependent batch size defaults to one. Crucially, ordinary daily close can
  be adjusted: only explicit rawClose is eligible as historical valuation data.
  Requesting raw history requires an explicitly configured Pro entitlement.
  Adjusted/unknown-convention history remains inspectable but cannot value holdings.
  [Quotes](https://brapi.dev/docs/acoes/cotacao),
  [history](https://brapi.dev/docs/acoes/historico),
  [authentication](https://brapi.dev/docs/authentication),
  [official SDK](https://github.com/brapi-dev/brapi-python).
- Alpha Vantage is the initial international provider: documented raw daily series,
  US stocks/ETFs and exchange-qualified symbols such as Xetra .DEX. Symbol-search
  metadata must verify exact symbol, region and currency before accepting prices.
  Free keys have 25 calls/day and only 100 daily observations; full history needs
  premium access. Latest means latest daily close, not real-time. AAPL/MSFT/VOO
  can use US listings; VWCE.DEX availability must be verified, never assumed.
  Unlike undocumented Yahoo endpoints this is a supported API contract. Other
  providers can be added through the same interface, without accounting changes.
  [Daily data and search](https://www.alphavantage.co/documentation/),
  [limits and terms](https://www.alphavantage.co/support/).
- Frankfurter v2 ECB rates supply dated EUR-based BRL/USD/JPY observations without
  a key. Conversion uses same-date cross rates rather than mixing dates/sources.
  This avoids Brapi FX plan dependencies. These are reference rates, not executable
  trading rates. [API documentation](https://frankfurter.dev/).

## Storage and accounting contract

Migration `sqlite_0008` extends price_observations with provider, convention,
retrieval timestamp and optional provider observation timestamp;
uniqueness becomes asset/date/source/convention. Provider corrections update only
the corresponding provider observation. Manual observations remain separate.
Prices keep exact millionth storage; FX uses exact decimal TEXT with 18 fractional
digits. Provider JSON numbers are decoded directly to Decimal, never binary float.

Automatic pricing uses the explicitly selected provider, then an explicit manual
fallback if no eligible provider quote exists. Manual mode uses only manual data.
Synthetic observations are an explicit demo provider, never a live failure fallback.
The selected FX source also separates synthetic and live quote universes. Incompatible
provider observations become unavailable, not mixed totals; manual values remain explicit.
Existing assets with manual observations migrate into manual mode. Posting a new
manual observation switches that asset to manual mode; automatic mode can be restored
without deleting either source's history.
No corporate-action engine exists: adjusted history is excluded, and users can
mark an asset's affected date range unavailable pending ledger correction.

Current valuation may show an old cached quote with its date/staleness warning.
Historical valuation carries an earlier eligible quote/FX observation for at most
seven calendar days, never a future quote. Missing coverage makes the total null
and exposes a known subtotal and missing components. Manual values follow the same
historical window. Corporate-action gaps also make affected values unavailable.
Portfolio history processes dated activities and ordinary cash entries in order,
using batched database reads, so historical quantity is never today's quantity.
Cash plus securities is portfolio value, not investment return. Overview remains
ordinary cash history. Reporting conversion does not rewrite original currencies.

## Synchronization contract

Only explicit refresh or opt-in in-process scheduling accesses the network; read
endpoints remain offline. One local worker, no overlapping runs, and no database
write transaction while waiting for HTTP. Short write units persist validated
results and status. Restart retains cache/status; no jobs run while the API is closed.
Backfill begins seven days before first activity; incremental fetch overlaps seven
days for corrections. Held/recently closed assets and explicitly requested history
are eligible. Refresh honors cooldowns even when forced. Requests have bounded
timeouts, response sizes, throttling and retries; long Retry-After becomes a durable
cooldown rather than blocking a worker indefinitely. Errors expose safe codes only.

## Run and configure

From `backend/`, run `uv run alembic upgrade head` before starting the API. No new
service or dependency is required. Keep one Uvicorn worker: refresh exclusion is
in-process, while quota/cooldown state is persisted in SQLite.

Optional root `.env` configuration (never commit credentials):

- `BRAPI_API_TOKEN`: server-side bearer token; blank permits public test symbols.
- `BRAPI_RAW_HISTORY=false`: enable only with a plan permitting raw history.
- `BRAPI_BATCH_SIZE=1`: raise only within the account's batch entitlement.
- `ALPHA_VANTAGE_API_KEY`: required for international requests.
- `ALPHA_VANTAGE_FULL_HISTORY=false`: enable only with full-history entitlement.
- `MARKET_SYNC_INTERVAL_MINUTES=360`: automatic interval, minimum 60 minutes.

Restart the API after environment changes. Settings > Market Data shows credential
availability without revealing values. Choose reporting currency and explicitly
refresh, or opt into automatic refresh while the application is running. Reads never
refresh. Recent successful cache is reused for six hours; Force bypasses freshness,
not provider cooldowns or daily quotas. Failed assets do not erase successful cache.
Alpha's 25-request daily local budget remains conservative even with a premium key.

Open a security in Investments for its original-currency price, quote/retrieval dates,
history and refresh. Expand Pricing preferences for manual/automatic mode, exact symbol
override and corporate-action coverage gaps. Cached observations exposes convention
and source. Portfolio/account history supports 1M/3M/6M/1Y/ALL and reporting currency.
History is bounded to ten years per request. Incomplete histories have gaps and a
known subtotal; current stale cache stays labeled. No graph is a performance return.

## Local APIs

All paths have prefix `/api/market-data`:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/status` | Provider capabilities, availability, coverage and safe sync errors |
| PUT | `/settings` | Reporting currency, FX source and opt-in automatic sync |
| GET/PUT | `/assets/{id}` | Cached observations/current price and pricing preferences |
| POST | `/sync` | Explicit refresh; optional asset, start/end, force and FX inclusion |
| GET | `/valuation` | Original-currency portfolio plus exact reporting conversion |
| GET | `/history` | Dated holdings/cash valuation; optional account and start |
| GET | `/assets/{id}/history` | Eligible security-price history with bounded carry |
| GET | `/fx` | Persisted dated rate observations |
| GET | `/fx/rate` | Exact same-date cross rate and provenance, or unavailable |

FX direction is units of target currency per one source unit. With EUR-based rates,
source-to-target = target/EUR divided by source/EUR, at the latest common date no
later than valuation, within seven days. Convert unrounded derived values before final
six-decimal API settlement. Original amounts/currencies and activity postings are untouched.

## Deterministic demo

Select a separate empty local `DATABASE_PATH`, migrate, then run
`uv run python -m app.seed_market_demo` from `backend/`. Repeating the command preserves
all edits; it does not retrofit an older populated demo. Never reset a database to seed.

The fixture contains eight accounts, nine securities, 30 investment activities and
508 ordinary ledger entries. Weekday synthetic quotes/FX cover September 24, 2025
through September 30, 2026. US/EUR examples include AAPL, MSFT, VOO and VWCE, alongside
the Brazilian fixture. They are fictional holdings/prices, not historical market claims.
VALE3 is deliberately unpriced, IVVB11 manual-only and MSFT deliberately stale; a closed
position, realized losses, contributions, dividends and charges exercise real services.
The SYNTHETIC provider performs no network requests. Demo FX stays separately identified.

## Validation and limits

Validation uses isolated temporary SQLite databases, deterministic provider mocks and
local browser servers. It covers fresh/populated upgrades (all old financial tables
unchanged), manual-mode preservation, restart persistence, duplicate-safe cache writes,
historical quantities/cash, exact FX and conversions, missing/stale/adjusted exclusions,
network failures, cooldowns, symbol identity, transport bounds and source separation.

Live public checks retrieved PETR4's Brapi latest quote and three historical observations,
then ECB reference rates. Brapi's available ordinary history was classified ADJUSTED and
excluded from valuation. Cache persistence, repeat refresh and dated FX conversion passed.
No Alpha key or Brapi Pro entitlement was available: international live coverage and raw
Brapi history remain unverified live; their contracts are covered by mocks.

Browser acceptance exercises market settings, refresh, account/currency/range controls,
security history, manual/automatic mode, existing investment posting and brokerage
imports. Desktop 1440x900/1920x1080 and 390px mobile screenshots remain ignored in `.tmp`.
Budget totals and existing activities were unchanged by pricing-only operations.

Validation checkpoint, October 12, 2026:

- Backend: **223 passed**, including 30 new market-data/migration/transport cases.
- Frontend: **75 passed**, including four new settings/chart/pricing interaction tests.
- Ruff lint/format, ESLint, Prettier, TypeScript and production Vite build passed.
- Fresh/populated migrations and Alembic drift checking passed. API restart preserved
  the complete reporting valuation response exactly.
- Browser market acceptance and existing investment posting/import acceptance passed;
  no browser JavaScript errors were reported. Screenshots were inspected against the
  available security-page reference while preserving the approved shell. The compact
  chart and coverage controls intentionally omit reference performance statistics.
- Existing build warnings remain: Zod annotation comments and a main chunk above
  500 kB. They do not prevent the production build.
- System-temp pytest permission errors were resolved by using an isolated workspace
  `--basetemp`; no financial data or permissions were changed to run tests.
- Generated databases, screenshots, logs and build output are ignored. Nothing was
  staged, committed or published at that implementation checkpoint. The subsequent
  [v0.6.0 release audit](RELEASE_0_6_0.md) updates metadata and records final checks.

The release audit also restricts incremental raw-price coverage to RAW_CLOSE rows,
backfills FX for newly added older cash history, and checks cancellation between batches.

No exchange calendar, corporate-action reconstruction, security transfers, TWR/IRR,
benchmarks or investment tax reports are implemented. Seven-day carry is a stated
approximation; provider gaps/entitlements remain visible. Next v0.7 work should define
cash-flow-adjusted return calculations and coverage policies before adding performance.
