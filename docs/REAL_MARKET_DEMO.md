# Real Market Portfolio — Brazil

The current demo is an isolated historical simulation: **actual observations plus fictional
holdings/contracts**. Reference window: **2024-10-01–2026-09-30**. It replaces the
old synthetic household, international and European demo investments. This is educational replay,
not an actual brokerage/Nubank account, a historical bank offer or advice.

## Run and select

Build the frontend as described in [DEMO.md](DEMO.md), then from `backend/`:

```sh
uv run python -m app.demo
```

The demo opens this portfolio directly; the retired household is not selectable.
`--scenario real-market-br` remains accepted for existing commands.
Stop the running demo before launching another server on
8001. No provider configuration, token vault or network request is needed to replay
the bundled official fixed-income data. `--prepare --scenario real-market-br`
validates/initializes without serving.

**ETF coverage is currently unavailable unless an authorized local export is
prepared.** No WRLD11/IVVB11 purchases, prices, returns or chart fluctuations are
invented in that case. A persistent message identifies the displayed portfolio as
fixed income only. Complete valuation quality for those included holdings does
not imply coverage of the omitted ETFs. Their proposed trades are not silently
booked at zero or substituted with another security.

## Isolation, replay and reset

- Retired household files: existing `data/demo-v012/`, retained locally but not opened
  by normal demo startup. The legacy seeder remains only for explicit regression fixtures.
- Historical scenario: owned `data/demo-v012-real-market-br-<snapshot hash>/`.
- Private ETF export: ignored `data/real-market-snapshot/etfs.json`.
- Roots are server-selected; the browser cannot supply a database/file path.
- The historical demo retains its own baseline, edited generation and OS lock.
  Old tabs cannot write using a previous generation. Public startup and the scenario
  endpoint exclude the retired household; test factories must explicitly opt into legacy fixtures.
- Reset uses the existing validated SQLite backup/generation mechanism, only for
  the historical demo. Archived legacy files and the normal database stay untouched.
- A changed authorized snapshot opens a new fingerprinted scenario, retaining old
  replays. It never overwrites the synthetic demo or the normal financial database.
- Repeated seeding/startup preserves edits. Only empty owned databases are seeded.
- No live/latest-price refresh was added; the frozen reference must stay fixed.

## Observations and rights

Retrieved **2026-11-03**, using official endpoints:

| Source | Included coverage/convention | Usage |
|---|---|---|
| [BCB SGS 12](https://www3.bcb.gov.br/sgspub/consultarvalores/consultarValoresSeries.do?method=consultarSeries&series=12) | 502 dated daily CDI percentages, 2024-10-01–2026-09-30 | Actual accumulation input |
| [BCB SGS 4389](https://www3.bcb.gov.br/sgspub/consultarvalores/consultarValoresSeries.do?method=consultarSeries&series=4389) | 502 annualized percentages, basis 252 | Independent unit/date cross-check only |
| [Tesouro Nacional / CODIP](https://www.tesourotransparente.gov.br/ckan/dataset/taxas-dos-titulos-ofertados-pelo-tesouro-direto) | 498 dated Tesouro Selic 2029 observations; morning purchase/sale/base PU | Purchase assumption and dated gross redemption marks |

The JSON snapshot in `backend/app/demo/observations/` retains exact source values,
source URLs, retrieval date, instrument identity and SHA-256 of each downloaded raw
response. Treasury data is ODbL-1.0; the extract's notice preserves that license.
BCB's [open-data policy](https://www.bcb.gov.br/acessoinformacao/dadosabertos)
describes reuse of its public observations. These public observations are distinct
from personal financial files, which must remain ignored.

No ETF series is bundled. The existing Brapi adapter was inspected. An
unauthenticated coverage request returned 401. Its
[raw-history documentation](https://brapi.dev/docs/acoes/historico) requires Pro
for `rawClose`; ordinary `close` can be adjusted. Its
[terms](https://brapi.dev/legal/terms-of-use) prohibit redistribution. The public
B3 archive request returned 403; no access restriction was bypassed. Authorized
local setup is therefore used rather than an unofficial replacement source.

For an explicit repeatable source check, run
`uv run python -m app.demo.prepare_real_market --verify-official`. It downloads
only the three fixed official public endpoints, with bounds/timeouts, and compares
the historical extract. It does not replace the snapshot or write any database.
Official corrections cause a visible failure requiring review, not silent drift.

## Fictional applications

All funding comes from the fictional Checking opening balance of **BRL 25,000**
on 2024-10-01. Linked same-currency transfers fund investment accounts; each
subscription/purchase creates one investment cash posting. There are no ordinary
expense/income twins, daily interest postings or second Caixinha savings balance.

| Contract | Application / effective settlement | Principal | Terms | Maturity |
|---|---|---:|---|---|
| CDB A | 2024-11-05 | 2,000 | 100% CDI, daily business-day liquidity | 2027-11-05 |
| CDB B | 2025-05-05 | 1,500 | 110% CDI, maturity only | 2027-05-05 |
| CDB C | 2026-02-05 | 1,000 | 120% CDI, maturity only | 2028-02-07 |
| CDB D | 2025-09-01 | 1,500 | Illustrative fixed 13.5% p.a., maturity only | 2027-09-01 |
| Tesouro Selic 2029 | Trade 2025-01-06; settle 2025-01-07 (D+1) | 2,995.089700 | 0.19 units × official purchase PU 15,763.63 | 2029-03-01 |

CDBs are fictional Example Bank contracts, not genuine offers from named banks.
Effective dates use the existing national business calendar. Return percentages,
liquidity and no-agent-fee terms are explicit illustrative assumptions.

### Caixinha — Emergency Reserve

A hypothetical standard **100% CDI RDB**, modeled after
[published Nubank terms](https://nu.com/pt/sala-de-imprensa/consumidores/nubank-disponibiliza-caixinhas-para-toda-a-base-de-clientes-da-conta-digital-no-brasil),
not Turbo, a mutual fund or synchronized Nubank data. Exact individual historical
terms could not be verified; this is disclosed in the contract notes.

| Application | Separate RDB principal |
|---|---:|
| 2024-12-02 | 1,000 |
| 2025-03-05 (after Carnival) | 300 |
| 2025-06-02 | 300 |
| 2025-09-01 | 500 |
| 2026-01-05 | 500 |
| 2026-05-04 | 400 |
| 2026-08-03 | 300 |

Each application has its own immutable contract, dated accrual and tax holding
period. Assumed maturity: three years from application, moved forward to a business
day. Business-day liquidity is modeled; 24/7 Nubank settlement is not simulated.
No automatic reinvestment or redemption is performed.

One investment account contains all seven lots. Its exclusive goal reservation
reads the account's gross dated holdings/cash value through the existing valuation
service. Contributions and accrued returns change progress; the goal does not add
an asset or post money. Missing coverage makes progress unavailable. The seeded
link is read-only in Goals: fund/redeem the underlying account instead of recording
duplicate progress. Generic investment-account reservation editing is not exposed.

## Calculation conventions

- SGS 12 is **percent per day**, not an annual rate. Daily factor is
  `1 + daily_percent / 100`; a P% CDI contract compounds
  `product(1 + daily_percent / 100 * P / 100)` over `[settlement, valuation)`.
  SGS 4389 verifies `(1 + annual_percent / 100)^(1/252)` within the precision of
  the published daily series; it is never multiplied into the balance again.
- The rate-per-business-day convention follows the
  [B3 fixed-income formula framework](https://www.b3.com.br/pt_br/produtos-e-servicos/negociacao/caderno-de-formulas/).
  The illustrative contracts explicitly use published SGS precision and existing
  six-decimal per-unit settlement, not a claim to replicate every issuer's
  truncation/cent rounding. Rounding a unit before multiplying principal can differ
  slightly from an unrounded broker calculation; financial mathematics was not
  changed to improve charts.
- Fixed-rate CDB accrues `(1 + 0.135)^(business_days/252)`, independent of CDI.
- Required missing CDI dates stop accrual; weekends/known holidays do not consume
  factors. No interpolation, current-rate extrapolation or future observation.
- Treasury uses **the same 2029 maturity** throughout. `PU Compra Manha` supplies
  the fictional execution; `PU Venda Manha` marks gross historical redemption.
  `OFFICIAL_PU` distinguishes this morning unit mark from `RAW_CLOSE`. It is not a
  CDI proxy. Prior observations carry at most seven days under the existing policy.
- [Tesouro rules](https://www.tesourodireto.com.br/sobre-o-tesouro/regras-e-regulamento):
  assumed zero broker fee; this fictional investor has only one Treasury holding,
  always below BRL 10,000, so the Selic B3 custody exemption applies. No general
  multi-account custody-fee engine is claimed.
- Resident-individual IR estimate on positive gain after IOF: 22.5% through 180
  calendar days, 20% through 360, 17.5% through 720, 15% afterward. IOF uses the
  existing daily schedule through day 29 and is zero from day 30. Taxes are
  estimated **per lot**, disclosed separately; gross value remains the valuation.
- Weighted-average cost, balances, cash-inclusive allocation, TWR, actual/365 XIRR
  and net worth reuse production services. Contributions are external investment
  flows, not profit or personal income. No brokerage cash or goal double count.

### Verified fixed-income-only result at 2026-09-30

| Holding | Principal | Gross value | Estimated IR | Estimated net |
|---|---:|---:|---:|---:|
| CDB A | 2,000.000000 | 2,567.104000 | 99.243200 | 2,467.860800 |
| CDB B | 1,500.000000 | 1,854.270000 | 61.997250 | 1,792.272750 |
| CDB C | 1,000.000000 | 1,108.931000 | 21.786200 | 1,087.144800 |
| CDB D | 1,500.000000 | 1,719.697500 | 38.447062 | 1,681.250438 |
| Tesouro Selic 2029 | 2,995.089700 | 3,792.576700 | 139.560225 | 3,653.016475 |
| Caixinha, seven lots | 3,300.000000 | 3,865.733100 | 101.753245 | 3,763.979855 |

Portfolio gross **14,908.312300**, invested **12,295.089700**, unrealized gain
**2,613.222600**, uninvested brokerage cash **0**. Net worth including Checking:
**149,890.182600**, including the restored household history. Caixinha goal
progress: **3,865.733100 / 5,000** gross. Investment values/returns are unchanged.
All reference-date IOF estimates are zero; short-term IOF is covered by tests.
Period TWR/XIRR use the actual selected boundaries and dated flows; they are not
the ratio of portfolio growth including contributions. Screenshots/results JSON
in the gallery retain the selected UI context.

For the full 2024-10-01–2026-09-30 interval, fixed-income-only TWR is
**28.914752%** and annualized actual/365 XIRR is **14.620171%**. Tests also check
the discounted-cash-flow residual independently from the reported flow list/root
solver, using the dated application plan.

Baseline size without ETFs: 4 BRL accounts, 12 investment activities/contracts,
36 linked transfers (including 24 savings contributions), 659 ledger records,
502 CDI factors, 498 Treasury observations, five goals, 15 categories and 14
monthly category targets. The acquisition assumption belongs only
to its investment activity; it is not stored as a fabricated closing quote.
Investment cash income is correctly empty: accrued CDB/RDB interest is not paid
cash income. Personal salary/side income is separate and appears in Spending.

### Household spending and goals

Dataset revision `real-market-brazil-2` restores 24 months of explicitly fictional
household activity: 32 income entries totaling BRL 225,004 and 554 expenses totaling
BRL 102,727.04. Categories include housing, groceries, restaurants, transport, fuel,
health, subscriptions, shopping, entertainment, utilities, insurance, education and
travel. September 2026 has BRL 9,800 income, 4,129.82 spending and 5,670.18 net flow.
All records use the real ledger/API path; chart points are not presentation fixtures.

Monthly Checking-to-Savings transfers of BRL 750 leave BRL 18,000 in Savings.
Vacation (6,000 saved), Vehicle upgrade (1,000), Design course (3,000, completed)
and Home studio (2,000, paused) reserve 12,000 of that same account, leaving 6,000
unallocated. Emergency reserve remains backed exclusively by the Caixinha's derived
gross investment value. Goal progress never creates assets or financial postings.

The dataset revision is included in the snapshot fingerprint. Restarting opens a
new owned household-plus-investments replay while preserving the former workspace
and edits. No personal database, old generation or observation snapshot is reset.

Household restoration checks: 40 backend demo tests and 204 frontend tests passed,
along with lint, formatting, type/build and real-browser Spending/Goals validation.
The updated baseline is prepared locally; restart the demo to open revision 2.

## Authorized private ETF setup

Obtain authorized **unadjusted** daily closes and issuer/exchange corporate-action
evidence for both ETFs. Verify symbol, BRL, B3, dates and applicable usage rights.
Issuer identity references:
[WRLD11](https://www.investoetf.com/etf/wrld11/) and
[IVVB11](https://www.blackrock.com/br/products/251902/ishares-sp-500-fundo-de-investimento-em-cotas-de-fundo-de-indice).
The importer validates evidence declarations, not provider signatures; preparation
must include an actual corporate-action review, not an unsupported assertion.

Create a **local ignored JSON file** with exactly these top-level keys:
`start`, `end`, `convention: "RAW_CLOSE"`, `authorized_local_use: true`,
`instruments`. `instruments` has exactly `WRLD11` and `IVVB11`. Each requires:

- `currency: "BRL"`, `exchange: "B3"`, `provider`, `license` (authorized local-use
  description), `license_terms_url`, `source_url`, `action_source_url`.
- Credential-free HTTPS evidence URLs (no query strings/userinfo/fragments).
- `retrieved_on` (ISO date), `actions_reviewed_through: "2026-09-30"`,
  `corporate_actions_reviewed: true`, `corporate_actions: []`.
- `prices`: dated objects containing **only** `date` and `close`; close is an exact
  decimal string, not a JSON binary number. Full-window coverage with no unexplained
  gap longer than seven days is required. Do not interpolate missing days.

There is no corporate-action engine: a nonempty/unreviewed action list is rejected
instead of claiming valid split/distribution performance. Adjusted series, wrong
identity/currency, missing coverage and extra credential-bearing fields are rejected.

```sh
uv run python -m app.demo.prepare_real_market --etf-export PATH_TO_AUTHORIZED_LOCAL_JSON
uv run python -m app.demo --scenario real-market-br
```

Setup installs atomically at the fixed ignored location; identical reruns are safe,
different content refuses overwrite. An existing export must be deliberately
archived locally before another is installed. Restart the demo after installation;
the new snapshot hash opens a new isolated replay, preserving previous edits.

| ETF | Target verified trading date (or next observation within seven days) | Shares |
|---|---|---:|
| WRLD11 | 2024-11-05 | 2 |
| WRLD11 | 2025-07-07 | 2 |
| WRLD11 | 2026-04-06 | 3 |
| IVVB11 | 2025-02-05 | 1 |
| IVVB11 | 2025-11-05 | 2 |
| IVVB11 | 2026-08-05 | 1 |

The first eligible **actual exported trading observation** determines date and
execution price. Exact selected dates/prices are visible in investment activities
and `/api/demo-control/market-evidence`. Final quantities are seven WRLD11 and
four IVVB11 only after all observations pass validation. No real ETF financial
results are reported here because no authorized real ETF export was available.
Fictional ETF executions assume zero brokerage/exchange fees; embedded fund costs
already reflected in observed prices are not deducted a second time.

## Validation and screenshots

Backend: `uv run pytest tests/test_real_market_demo.py` plus the existing financial,
fixed-income and demo suites. Tests independently compound official observations,
check lot taxes, funding, missing coverage, position dates, portfolio/net worth,
goal values, determinism, reset, stale generations, private export setup and
populated migrations/immutable triggers. ETF integration tests use **explicitly
synthetic test exports**, never claim those are real ETF history.

From `frontend/`, after building:

```sh
npm run test -- --run
# PowerShell: $env:DEMO_E2E_PORT='5174'
node scripts/demo-e2e.mjs --real-market --real-market-only
```

Omit `--real-market-only` to include the full existing demo workflow regression.
The runner owns a fresh temporary workspace, explicitly disables personal ETF
exports, checks real browser interactions and captures 1440/1920 desktop and mobile
screenshots. [Screenshot gallery](screenshots/real-market-demo/index.html).

Limits intentionally retained: no live refresh, no real ETF prices without local
authorization, no corporate-action engine, no automated issuer/contract verification,
no 24/7 RDB processing, no generalized custody-fee engine, no public writable demo.

Brazil-only follow-up: public startup/CLI now expose only this portfolio. The
legacy household is available solely through an explicit internal regression
factory flag, not public scenario selection. Old saved databases are retained
without being opened by the public demo. Validation: 39 demo/backend regressions,
204 frontend tests, lint/type/build and the Brazil-only browser workflow passed.

Validation on 2026-11-03: 472 backend tests and 203 frontend tests passed;
44 focused historical/fixed-income tests passed after the final Treasury quote
provenance correction. Fresh and populated migrations, immutable triggers,
determinism, restart persistence, reset and scenario isolation passed. Backend and
frontend lint/format, TypeScript and production build passed. The full existing
demo browser workflow and historical scenario checks passed. Final historical
captures use reduced motion to avoid recording partially animated charts. Existing
SQLAlchemy fixture warnings and the frontend large-chunk build warning remain.
