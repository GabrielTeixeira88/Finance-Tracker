# Finance Tracker: two-minute walkthrough

The v0.14 demo is **one fictional household and portfolio**, replayed through
September 30, 2026. Spending, investments, budgets, Goals and Net Worth share the
same local API and ledger. There are no nested demos or scenario switches.

[Recorded browser walkthrough](screenshots/v014/walkthrough.webm) ·
[Full screenshot gallery](screenshots/v014/README.md)

The 115-second (3.3 MB) WebM contains actual browser frames, without audio.
Use the narration below when presenting it; no narrated video is claimed. Download
and open in Chrome/Edge/Firefox. The available Playwright encoder supports VP8/WebM,
not MP4; no large conversion dependency was added.

## Launch

From the repository root, with Python 3.12+, uv, Node 22.13+ or 24+, and npm:

```sh
cd frontend
npm ci
npm run build
cd ../backend
uv sync --frozen
uv run python -m app.demo
```

Open **http://127.0.0.1:8001**. Spending is the initial Dashboard tab; choose
**Investments** first. The sidebar contains Dashboard, Accounts, Activities,
Holdings, Insights, Goals and Settings. Expand the sidebar to see labels.
The recording/gallery use existing Classic dark / Inter / English preferences,
1600 × 1000 and 100% zoom. The video is compressed to 1280 × 800 at 12 fps, with
five initial loading seconds trimmed. No screenshot-only styling is injected.

## Recording and narration plan

Times describe the target 120-second sequence. Actual scene entry times are in
[the capture manifest](screenshots/v014/capture-manifest.json). Routes follow the
local demo origin. The clip is read-only; it does not claim to post a transaction,
confirm an import or connect to a real bank.

| Time      | Screen and exact destination                                                | Narration / action                                                                                                                                                                                                                                     |
| --------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0:00–0:13 | Dashboard → Investments, `/#/dashboard?view=investments&range=ALL`          | “Finance Tracker connects personal finance and investment history in a local-first application. This portfolio contains fictional holdings, with explicitly sourced or simulated valuations.” Show history and accounts.                               |
| 0:13–0:27 | Spending, `/#/dashboard?view=spending&start=2026-09-01&end=2026-09-30`      | “Household spending flows from the ledger into category breakdowns and monthly budgets.” The fresh September fixture has R$ 9.800,00 income and R$ 4.184,82 spending.                                                                                  |
| 0:27–0:39 | Activities → Transactions, `/#/activities?view=transactions`                | “Transactions preserve payees, raw descriptions, categories and review state. Transfers move owned money without becoming income or spending.” Show ledger and filters.                                                                                |
| 0:39–0:49 | Spending → Budget, `/#/dashboard?view=spending&detail=budget&month=2026-09` | “Monthly targets, overrides and signed rollover are reconstructed against spending. Targets never create financial postings.”                                                                                                                          |
| 0:49–1:00 | Holdings, `/#/holdings`                                                     | “Investment activities reconstruct quantities and weighted-average cost. Brokerage cash is counted once.” Show SIM securities and Brazilian fixed income.                                                                                              |
| 1:00–1:12 | Insights → Performance, `/#/insights?view=performance&range=1Y`             | “Cash-flow-adjusted returns distinguish contributions from growth. TWR, XIRR and dated valuations share accounting services.” The recording also selects SIM-GLOBAL-ETF: an explicitly fictional price-only comparison, not a real total-return index. |
| 1:12–1:24 | Insights → Overview, `/#/insights?view=overview`                            | “Portfolio Insights explains cash-inclusive allocation and concentration. Targets are planning metadata, not automatic trades.”                                                                                                                        |
| 1:24–1:38 | Net Worth, `/#/dashboard?view=net-worth&range=ALL`                          | “Net Worth combines account cash, investments and dated manual assets/debts without counting holdings twice. Missing coverage stays visible.”                                                                                                          |
| 1:38–1:50 | Goals, `/#/goals`                                                           | “Goals reserve existing savings or track manual progress. They never create extra wealth.” Show differing progress and lifecycle states.                                                                                                               |
| 1:50–2:00 | Return to Dashboard → Investments                                           | “React and TypeScript sit over FastAPI, SQLAlchemy and local SQLite. Exact money, reviewed imports, auditable history and isolated tests support the workflows. Finance Tracker: github.com/GabrielTeixeira88/Finance-Tracker.”                        |

## Optional hands-on financial exercise

Use an **isolated demo**, never personal data. In Activities → Transactions choose
**Add Activities → Add Transaction**, Expense, Checking, R$ 25,00, September 30, 2026, description
“Walkthrough coffee” and an appropriate category. Submit through the UI. September
Spending should become **R$ 4.209,82**, and Checking should decrease by R$ 25,00.
Inspect the selected category and budget. This optional exercise changes your saved
demo; it is not part of the clip or a claim that capture posted financial data.

Open fixed-income holdings to inspect dated principal, gross accrual, maturity,
liquidity and estimated IR/IOF/net redemption. Caixinha has distinct RDB lots;
accrual is not paid cash income. Net Worth counts that asset once even when a
Goal reserves it. Income separates actual payments from unpaid earnings.

## Fictional versus official data

Owners, cashflows, contracts and SIM securities are fictional. SIM prices and
comparison proxies are simulations, not WRLD11/IVVB11 quotes or actual index
returns. CDI/Treasury observations retain official source/date conventions; taxes
and contractual assumptions are separately disclosed. No restricted ETF history
is bundled. Gmail/Pluggy workers and vault access are disabled in demo mode.

See [demo lifecycle](DEMO.md), [historical provenance](REAL_MARKET_DEMO.md),
[SIM generation](ETF_SHOWCASE.md) and [analytics](INVESTMENT_ANALYTICS.md).

## Reset and safe capture

**Demo → Reset demo** requires confirmation and restores only that owned demo's
baseline. Saved demo financial edits are discarded; appearance/language remain.
Personal databases and archived scenarios are untouched. Stop with Ctrl+C before
normal personal mode. Do not reset an existing saved demo for screenshots.

The [capture script](../frontend/scripts/portfolio-capture.mjs) starts a new owned
root under ignored `.tmp/`, refuses occupied ports, disables vault access and
checks unchanged accounts. It never attaches saved/personal databases or resets
them. Raw logs/recordings/validation remain ignored; only reviewed final media and
a small manifest are allowlisted. v0.12 media remain historical records.
