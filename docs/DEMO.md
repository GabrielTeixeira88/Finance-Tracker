# Isolated historical Brazil demo

The current demo contains only **Real Market Portfolio - Brazil**. It replaces the
old household's international/European portfolios, invented securities, foreign FX,
manual property/debt and unrelated ingestion scenarios. It also contains fictional
BRL household spending and savings goals alongside the investments.

The investor, contributions and contracts are fictional. CDI and Tesouro Selic
observations are official historical data, with a fixed reference of September 30,
2026. WRLD11/IVVB11 remain explicitly unavailable until an authorized private raw
price export and corporate-action evidence are prepared. No observations are invented.
See [sources, exact dates, calculations and setup](REAL_MARKET_DEMO.md).

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

Open **http://127.0.0.1:8001**. Restart an older running demo to load this version.
`--scenario real-market-br` is optional and retained for command compatibility;
the old `--scenario synthetic` option is rejected. `--prepare` initializes and
validates without serving. Stop with Ctrl+C. Normal application startup remains
separate; do not change `DATABASE_PATH` to enter the demo.

## What is seeded

- Checking, Savings, Brazilian Brokerage and Caixinha - Emergency Reserve, all in BRL.
- Four illustrative CDBs: 100%, 110%, 120% CDI and fixed 13.5% p.a.
- A Tesouro Selic 2029 holding purchased using an official historical purchase PU.
- Seven dated 100% CDI RDB applications in the Caixinha account.
- Twenty-four months of salary/side income and 554 dated expenses across everyday categories.
- Monthly savings transfers, category spending targets and five savings goals:
  Emergency reserve, Vacation, Vehicle upgrade, Design course and Home studio.
- The emergency goal tracks Caixinha; the other four share existing Savings funds.
- Official dated CDI/Treasury observations and ledger-derived historical charts.

No international/European investment accounts, DEMOUP/DEMOUS/DEMOEU securities,
invented foreign price paths are seeded. Personal salary income populates Spending;
investment cash income remains empty because accrued fixed-income interest is not
a daily cash-income transaction. Transfers remain excluded from spending.

## Ownership, persistence and reset

The server derives `data/demo-v012-real-market-br-<snapshot hash>/`; clients cannot
supply database paths. Ownership markers, link/hardlink checks and process locks
protect the workspace. Initialization migrates an empty build database, seeds using
production services, validates integrity/foreign keys and publishes a baseline.
The active session is a separate owned generation; later launches preserve edits.

**Reset demo** requires confirmation and restores only the historical demo using
the validated SQLite backup/generation mechanism. Stale generation writes return
409. The normal database and archived old `data/demo-v012/` are not reset, copied
into the new portfolio, or deleted. A changed authorized snapshot opens a new
fingerprinted replay and preserves older workspaces.

Dataset revision `real-market-brazil-2` includes the restored household history and
goals in its workspace fingerprint. Restarting the demo opens that revision;
previous investment-only workspace files and edits are retained, not overwritten.

Services bind to loopback with one worker. Real integration workers, token vaults,
Gmail, Pluggy and provider refresh remain blocked in demo mode. There is no public
shared writable deployment, telemetry, live-price dependency or authentication.

## Validation

Backend regressions include the current historical portfolio and explicitly
isolated legacy fixtures. The old fixture exists only to preserve previous financial
workflow coverage; it is not a selectable public demo.

From `frontend/`, after building:

```sh
# PowerShell: $env:DEMO_E2E_PORT='5174'
node scripts/demo-e2e.mjs --real-market --real-market-only
```

This starts the actual Brazil-only demo factory in an owned temporary test root,
checks BRL-only accounts, charts, ranges, goal funding and reset, and captures
[screenshots](screenshots/real-market-demo/index.html). Omitting `--real-market-only`
also runs the explicit legacy workflow regression before checking Brazil. Tests
never attach to the saved demo or personal database.
