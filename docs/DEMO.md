# Isolated interactive demo

The v0.12.0 interactive showcase runs locally. No public demo is deployed.
See [release validation](RELEASE_0_12_0.md).

## Start and leave

From the repository root, build the frontend once:

```sh
cd frontend
npm ci
npm run build
cd ../backend
uv sync --frozen
uv run python -m app.demo
```

Open http://127.0.0.1:8001. The process binds only to loopback and uses one worker.
`uv run python -m app.demo --prepare` initializes/validates without serving.
Subsequent launches resume demo edits. Stop with Ctrl+C. Return to normal operation
with the README's port 8000/5173 commands. There is no in-process database switch.
Do not change DATABASE_PATH to enter the demo. No OAuth or provider credentials are
required. Use fictional inputs only, including any manually uploaded statements.

## Ownership and reset

The only production demo root is `data/demo-v012/`, outside the normal database.
The command accepts no database path. A versioned owner marker, fixed filenames,
UUID generation names and checks against traversal, symlinks, junctions and hardlinks
prevent adopting an arbitrary existing file. Unknown/nonempty directories are refused.
Configuring the normal database inside this root is also refused.

Initialization applies all Alembic migrations to a new build file, seeds it in one
transaction, validates integrity/foreign keys/demo identity and publishes `baseline.db`.
The running workspace is a separate `session-<UUID>.db`; `active.json` identifies it.
A held OS lock rejects a second process using the same demo root.

**Reset demo** requires confirmation. Requests are serialized through completion;
reset uses SQLite's backup API to create a new generation from the baseline,
validates it, then atomically replaces the active pointer. Only then does the process
switch engines. Old engines are disposed before cleanup; current and previous
generations are retained. Cleanup only considers validated, owned UUID files.
Failures before publication preserve the current database and edits. Cleanup failure
leaves extra demo files instead of invalidating a successful reset.

Every write includes the current generation. A stale browser tab receives 409 after
reset and must reload. React cancels queries, clears caches and remounts the application
after reset, discarding stale forms and selection. The normal app has no reset route.
Reset is an explicitly authorized demo-only feature, never a general repair tool.

## Fictional profile and deterministic data

Alex Morgan has fixed October 2024 through September 2026 history, with auditable
opening entries dated September 30, 2024. New-entry date defaults in the demo use
September 30, 2026. Normal mode uses the actual date. The fixture has a stable marker,
UUIDs, timestamps, amounts and source identities; no random/current-date financial data.
Repeating seed setup preserves edits. Two independently migrated/seeded databases are
compared table-for-table by the automated determinism test.

| Records | Baseline |
|---|---:|
| Accounts | 7 |
| Ledger entries, including openings and both transfer sides | 772 |
| Linked transfers | 97 |
| Categories / normalized payees | 14 / 5 |
| Classification rules / schedules | 3 / 6 |
| Budget targets / monthly overrides | 13 / 1 |
| Investment activities / securities | 28 / 5 |
| Dated synthetic prices / FX observations | 2,635 / 1,054 |
| Manual assets/debts / dated observations | 5 / 120 |
| Goals / progress entries | 5 / 30 |
| Import batches / source records | 4 / 6 |

Checking, Savings, Cash and Credit Card use BRL. Brazilian, International and European
brokerage accounts use BRL, USD and EUR respectively. Salaries grow in stages; groceries,
restaurants, transportation, utilities, subscriptions, shopping, insurance, travel and
education vary across months. Card repayments, savings and brokerage contributions are
linked transfers. Two explicit partial refunds reduce spending rather than income.
Manual classification examples demonstrate rule override protection. Two schedule
occurrences are linked to existing entries; overdue/upcoming expectations never post.
Budget targets apply over all 24 months, with shopping/travel rollover and a travel
month override. Other has a target with no recurring spending.

Investments use fictional DEMOUP, DEMOLOSS, DEMOUS and DEMOEU securities plus DEMOBENCH.
BUY/SELL, a closed loss position, dividends, interest, fees and taxes pass through
existing posting services. Cached prices use synthetic weekdays, not real exchange
holiday calendars. FX is dated and exact. TWR/XIRR and histories use the existing
analytics; DEMOBENCH is a **price proxy**, not a total-return index. No live prices,
corporate actions or new performance mathematics are added.

Property appreciates, a vehicle depreciates, and collectibles have dated valuations.
Mortgage and personal-loan principal remain constant in this illustrative history;
no amortization or principal/interest split is inferred. Goals include active,
nearly complete, newly funded, completed and paused examples. Their allocations share
existing same-currency savings and never increase net worth.

## Imports, notification simulation and reconciliation

**Demo scenarios** and **Settings > Gmail** offer generated synthetic CSV/OFX downloads
and one-click preview preparation. Samples are allowlisted text generated in Python;
React does not contain financial fixture arrays. Preview preparation runs the real
upload/parser path, opens the resulting batch and requires normal review/confirmation.

- `demo-checking.csv`: an existing 85 BRL purchase, a new 18.75 stationery purchase,
  and an ambiguous 42 BRL cafe row with multiple plausible ledger matches.
- `demo-credit-card.csv`: a new purchase, a refund requiring explicit purchase linking,
  and a card-payment movement requiring transfer classification/linking or skipping.
- `demo-checking.ofx`: the exact source identity already attached to the 85 BRL purchase;
  replay demonstrates duplicate protection.

**Gmail Notification Simulation** builds fictional MIME content and uses the existing
normalizer, bank-template parser, source records, rules and candidate review pipeline.
It does not connect to Google, request a token, read the OS vault or claim to be connected.
Repeating simulation returns the same source identity. Approving the candidate posts
through normal ingestion. Skipping remains available in row review.

The baseline's 85 BRL purchase has one Gmail notification and one OFX source linked to
one transaction: one expense, not two. There is a cleared example, an exact-repeat draft,
ambiguous cafe candidates and a completed historical Cash statement. These are real
database states, not screenshots or presentation mocks.

## Demo API boundary

Normal `/api/runtime` returns `mode: normal`; the separate demo app returns its profile,
fixed dates and generation. Only the demo app has `/api/demo-control/reset`,
`/notification`, `/sample/{name}` and `/files/{name}`. Reset accepts only the confirmation
phrase, never a path. GETs are uncached; writes require local headers and the generation.
Host/Origin checks permit only the local application origins. Real Gmail endpoints,
provider configuration/refresh and background workers are blocked/absent. The demo
copies production routes with isolated dependencies, not the normal lifespan.

## Tests and screenshots

Run `uv run pytest tests/test_demo_workspace.py` in backend. Run `npm run build` then
`npm run test:demo` in frontend (Edge installed by default). The runner refuses a running
port 8001 (or set `DEMO_E2E_PORT=5174` to use that approved free port) and creates its own ignored `.tmp/demo-e2e-*` workspace, never the user's saved
demo. `npm run test:demo -- --screenshots` captures only that synthetic workspace into
`docs/screenshots/v012/`. Test databases/logs stay ignored. See
[validation results](DEMO_READINESS.md) and the [walkthrough](PORTFOLIO_WALKTHROUGH.md).

The existing shell was retained. The demo entry/isolated exploration pattern was
informed by the publicly accessible [demo](https://demo.actualbudget.org/budget) and
[installation guide](https://actualbudget.org/docs/install/); reset follows the
[SQLite backup API](https://www.sqlite.org/backup.html). No third-party source was copied.

## Limits

The fixed date is not a live financial feed. Goal queries explicitly use the demo
reference date, including deadline urgency; normal mode keeps its existing calendar.
Reports remains a preview. There is no hosted session manager or public deployment.
One local user/process owns the demo; serializing requests favors reset safety over
multi-user throughput. Long analytics requests can delay reset. See
[deployment requirements](DEMO_DEPLOYMENT.md) for the unimplemented hosted design.
