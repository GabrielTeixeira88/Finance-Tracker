# Complete local demo

The public demo is one BRL household and investment portfolio. Spending, Accounts,
Transactions, Budgets, Goals, Investments, Performance, Portfolio Insights, Income
and Net Worth use the same persisted ledger. No scenario switching is necessary.
The fixed replay window is October 2024 through September 30, 2026.

## Start

From the repository root:

```sh
cd frontend
npm ci
npm run build
cd ../backend
uv sync --frozen
uv run python -m app.demo
```

Open **http://127.0.0.1:8001**. Stop with Ctrl+C. `--prepare` validates without
serving. Older `--scenario` CLI names now resolve to this same complete demo.
No key, OAuth, Docker or live network access is required. Normal application startup
remains separate; never change `DATABASE_PATH` to enter the demo.

## Included data and accounting

- 24 months of fictional household income and 555 expenses, monthly savings transfers,
  category budgets and seven goals. Checking/Savings balances and goal funding are
  preserved from the historical Brazil household.
- Fictional house/car/equipment with dated manual valuations, plus a linked home
  mortgage and vehicle loan with explicitly recorded debt balances. These are not
  generated loan schedules or inferred principal/interest payments.
- Four illustrative CDBs, Tesouro Selic 2029 and seven Caixinha/RDB applications,
  valued from official CDI/Treasury observations.
- Eleven fictional SIM securities, including global/S&P-style ETFs, income ETFs,
  property/logistics/credit/infrastructure income funds and a partial ETF sale.
- 135 fictional dividend/paid cash-interest events across ten sources and two
  investment accounts. Received Income is separate from unpaid CDB/RDB accrual.
- Two additional fictional completed ETF trades, `SIM-CLOSED-GAIN` and
  `SIM-CLOSED-LOSS`, demonstrate closed positions and realized outcomes. Their
  dated simulated prices are `SYNTHETIC`, never quotes for genuine securities.
  Existing funded brokerage cash covers the purchases. Net realized results are
  BRL 116 and BRL -154 after BRL 2 per trade; combined cash effect is BRL -38.

The added securities are funded by a documented BRL 93,000 opening-capital entry
in an inactive, zero-ending-balance cash account, transferred into Checking, then
BRL 75,000/8,000/10,000 transferred to the two added brokerages. The original
Checking opening and financial history are unchanged. Funding never counts as
income/expenses. Holdings, cash, gains, TWR/XIRR and Net Worth use existing services;
goals reserve existing assets rather than adding value.

All currencies are BRL. `fx_provider=SYNTHETIC` permits the SIM security history;
there are no synthetic FX observations. Official contracts retain their `MANUAL`
CDI factors and `OFFICIAL_PU` Treasury observations. Production source-eligibility
guards are unchanged. Real ETF exports, if authorized locally, remain explicit
MANUAL observations. Never describe the whole mixed demo as real market performance.
Investment pages show a compact provenance footer; charts/tooltips distinguish the
mixed demo. Security names/tickers/details identify fictional SIM instruments.

See [official history/assumptions](REAL_MARKET_DEMO.md), [SIM generation](ETF_SHOWCASE.md)
and [Income accounting](INCOME_V014.md).

## Saved edits, ownership and reset

The server derives `data/demo-v012-unified-1-<snapshot fingerprint>/`. No client
database path is accepted. Ownership checks reject links/hardlinks and normal data.
One process owns the workspace; migrations, foreign keys, WAL and generation guards
remain enabled.

On first launch, an existing validated `real-market-brazil-3` household generation
is copied with SQLite backup and extended atomically. Its original IDs, transaction
history, balances and saved edits are preserved in the copy. Original demo files
remain unchanged. The earlier ETF/Income/legacy workspaces are archived, never
deleted or automatically merged as a second investor. Invalid source ownership fails
closed. New launches resume the unified active generation without reseeding.

The unreleased Holdings/Activities content extension is versioned in the owned
fixture payload. Startup extends a validated SQLite backup of an older unified
baseline/active generation, checks relational integrity, then publishes it atomically.
Original saved rows and the previous generation remain intact. Repeated startup
does not duplicate fixtures. Injected-failure tests verify that a failed extension
leaves the active pointer and original generation unchanged. This path never runs
for personal data or archived scenarios. It is an additive extension, not a reset.

**Reset demo** requires confirmation and restores the unified baseline only.
It does not reset personal data or archived demos. Stale-generation writes return
409. Appearance/language preferences survive reset. A changed official/private
snapshot fingerprint opens a different owned workspace rather than rewriting history.

Gmail/Pluggy/provider refresh, vault access and integration workers remain blocked.
Services bind to loopback. Public per-session isolation is not implemented; do not
expose this local writable demo as a shared public service.

## Validation

Backend tests cover combined exact accounting, holdings, paid income, preserved
household edits, archive hashes, idempotence, unavailable data and reset isolation.
Legacy scenarios remain explicit internal regression fixtures, not public pages.

After building, from `frontend` (use an available approved local port):

```powershell
$env:DEMO_E2E_PORT='5174'
node scripts/demo-e2e.mjs --unified
```

The runner creates its own temporary owned workspace, never uses saved demo or
personal data, checks Spending/Goals/ETFs/fixed income/Income/Net Worth, chart and
account/range controls, themes, responsive navigation and reset. Local screenshots
and reports are under `.tmp/unified-demo-e2e/` and excluded from Git.

### Consolidation validation — November 6, 2026

- Full backend run: 501 passed; final unified-demo suite: 3 passed, including the
  additional injected-failure/retry test. Three pre-existing legacy seed warnings.
- Frontend: 263 tests passed; ESLint, Prettier, TypeScript and production build passed.
  Existing bundle-size and third-party annotation warnings remain.
- Playwright: unified public workflow and retained historical/Income fixture
  regressions passed. Light/dark 1440/1920 and mobile captures were inspected.
- Live local restart verified all original household transactions/accounts/goals/
  manual-asset rows, archive hash and personal database hash unchanged. No live reset.

### v0.14 Spending content extension

The owned unified workspace receives the repeat-safe `spending_ui_content` marker.
It adds four appearance-enabled budget groups, category icons/colors, dated target
examples and overrides, signed category rollover, four linked Life Events,
a BRL 90 uncategorized bicycle repair and a BRL 35 partial purchase refund.
On a fresh fixture the two postings change checking cash by BRL -55; events and
targets add no ledger movements. Existing versions, user styles and associations
are preserved. Renamed/inactive fixture records are handled conservatively.
Personal and archived scenarios are never adopted or reset for this extension.

The isolated browser runner is `node scripts/demo-e2e.mjs --spending-migration` from
`frontend/`, after a production build. It owns a fresh temporary demo root, requires
a free approved loopback port, and never uses the saved demo or personal database.

## v0.14 Goals content extension

Owned unified workspaces gain two manual planning examples (Wedding celebration
and an archived Photography workshop), plus saved template/monthly assumptions for
the five existing goals only when absent. Wedding history includes a withdrawal;
Photography retains a voided correction and its replacement. The seven goals cover
on-track, at-risk, off-track, paused, completed and archived states. The existing
Caixinha reservation is preserved. This extension posts no cash, assets or quotes.
A fixture marker makes repeats safe; existing user edits are not overwritten.
Explicit demo reset recreates the same stable goal/entry IDs and dated values.
See [Goals migration](GOALS_V014.md) for the source inventory and browser checks.

Run its isolated browser check from `frontend/` after building:
`$env:DEMO_E2E_PORT='5174'; node scripts/demo-e2e.mjs --goals-migration`.
The runner owns a new temporary demo root and never attaches a saved workspace.

### v0.14 Performance and Insights examples

The owned unified demo gains an additive `performance_insights_content: 1` marker
and one fictional “Household investment plan”: 60% ETF, 30% BOND, 10% CASH,
5-percentage-point minimum tolerance with a 20%-of-target relative band. This is
an illustrative configuration, not financial advice or a recommended portfolio.
Its UUID5 identities, BPS and timestamps are deterministic. Repeated initialization
preserves edits; upgrades extend a validated backup generation and publish atomically.
The normal database and prior archived scenarios are never adopted or modified.

Existing SIM-GLOBAL-ETF/SIM-SP500-ETF histories supply explicitly fictional
price-only comparison proxies. Existing gain/loss periods, closed holdings, paid
income and contract accrual supply the remaining views. This extension creates no
market observations, investment activities, income or cash postings, and does not
change official CDI/Treasury data. The ordinary unified launch/reset commands
remain unchanged. Browser validation uses a separate temporary demo root.

## Dashboard coverage extension (v0.14)

The owned unified demo adds one fictional Vintage audio collection, held before
replay, with recorded BRL valuations of 2,200 on 2024-10-01 and 2,600 on
2026-05-15. Its 138-day-old closing valuation legitimately exercises Attention.
There is no purchase/cash posting, income or new security. Existing house, car,
mortgage, vehicle debt, goals, official fixed income and simulated ETF records
remain intact. The `dashboard_content=1` extension uses deterministic identities
and the existing backup/atomic generation upgrade; repeated runs preserve edits.
No normal or archived scenario database is adopted or reset.

Investments and household Net Worth now share dashboard periods through URL state.
Investment account scope remains separate. See [dashboard migration](DASHBOARD_MIGRATION_V014.md).

## Settings examples (unreleased v0.14)

Two deterministic account groups demonstrate local organization. The versioned
metadata extension preserves saved descriptions/membership and all original financial
records. Personal backup/restore is unavailable in demo; the existing explicit demo
reset remains separate. Settings exports include only reviewed synthetic datasets.
Provider connections are not fabricated and real sync/OAuth/vault access stays disabled.

## Application audit examples and checks

The additive, once-only `audit_content` extension supplies missing fictional
security-level sector/region classifications and a monthly rent expectation
starting October 5, 2026. Existing metadata and financial postings are preserved.
These are not researched ETF holdings or an automatic posting schedule. All demo
prices retain their official-versus-simulated provenance boundaries.

After building the frontend, run the read-only, isolated application inventory:

```powershell
cd frontend
$env:DEMO_E2E_PORT='5174'
node scripts/demo-e2e.mjs --app-audit
```

It rejects an occupied port, creates its own temporary demo, and captures both
themes at five viewports plus all pages in pt-BR/es-419. Evidence goes to ignored
`docs/screenshots/v014-audit/`. `AUDIT_QUICK=1` limits captures for diagnosis.
Existing `--unified` verifies the current seven-goal household and explicit reset;
no saved user workspace is reset. See [audit](AUDIT_V014.md).
