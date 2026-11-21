# Finance Tracker roadmap

Versions are the primary milestone identifiers. Historical phases remain traceable
below; they do not imply earlier releases or tags. Current application version is
0.14.0. The frontend migration, integration and stabilization are finalized in
source. Owner-authored code is AGPL-3.0-only, with third-party terms preserved.
See [finalization](FINALIZATION_V014.md) and the retained audit/migration records.
No v0.14 tag, GitHub Release or deployment is implied by this milestone.

The known development-only minimatch advisory is accepted for this merge, not
fixed or hidden. Live bank/OAuth entitlements, public demo hosting and future
artifact-specific source/installation obligations remain separate considerations.
The roadmap's postponed financial engines remain postponed; v1.0 is not claimed.

## Historical mapping

| Version | Previous designation | Scope                                                              |
| ------- | -------------------- | ------------------------------------------------------------------ |
| v0.1.0  | Phase 0, 1, 1.6-1.7  | Foundation, core ledger, SQLite and Wealthfolio-based UI           |
| v0.2.0  | Phase 2A and 2B      | Payees, transaction review, rules and schedules                    |
| v0.3.0  | Phase 3              | CSV/OFX imports and ingestion infrastructure                       |
| v0.4.0  | Phase 4              | Spending & Budgets                                                 |
| v0.5.0  | Phase 5              | Investment Foundation                                              |
| v0.6.0  | Phase 6              | Market Data & Portfolio Valuation                                  |
| v0.7.0  | Phase 7              | Investment Analytics                                               |
| v0.8.0  | Phase 8              | Gmail Ingestion                                                    |
| v0.9.0  | Phase 9              | Multi-Source Reconciliation                                        |
| v0.10.0 | Phase 10             | Net Worth & Goals                                                  |
| v0.11.0 | Phase 11             | Product Consolidation & UX Refinement                              |
| v0.12.0 | Phase 12             | Interactive Demo & Portfolio Showcase                              |
| v0.13.0 | Stability gate       | Final Product Refinement, Stability, Security & Release Validation |
| v1.0.0  | Stable release       | First fully validated stable version                               |

Phase 2A and 2B belong together to v0.2.0; never use separate patch milestones.
v1.0.0 requires validated stability, not a milestone counter reaching a number.

## Implemented milestones

- **v0.1.0 - completed:** local-first single-user SQLite, exact core ledger,
  accounts, categories, transfers/openings, historical Overview and synthetic demo.
  Foundation for later versions; no cloud or database server required.
- **v0.2.0 - completed:** payees, review, search/filter/pagination, bulk metadata,
  rules and approved learning; expected schedules with explicit match/post.
  Depends on the ledger. Review is not bank clearing; no automatic posting.
- **v0.3.0 - completed:** CSV/OFX adapters, candidates, profiles, previews,
  confirmation, duplicates and source links. Depends on ledger/classification.
  No Gmail or automatic reconciliation.
- **v0.4.0 - completed:** monthly category targets, groups, effective defaults,
  overrides, signed rollover, refunds and insights. Depends on exact ledger spending.
  Budgeting is independent of cash, not mandatory envelope or zero-based allocation.
  See [budget contracts](BUDGETS.md).
- **v0.5.0 - completed and validated:** securities, investment cash,
  BUY/SELL/dividends/interest/fees/taxes, weighted-average holdings, realized results,
  manual prices and brokerage CSV. Depends on accounts/transfers and ingestion.
  No live prices, FX, corporate actions or return engine. See [contracts](INVESTMENTS.md).

- **v0.6.0 - completed and validated: Market Data & Portfolio Valuation.** Provider adapters, security
  identities, price provenance/freshness, historical prices, valuation and explicit
  FX policy. Depends on investment activities; preserve offline fallback and missing
  price distinctions. Brapi v2, Alpha Vantage and Frankfurter ECB adapters are implemented.
  Live acceptance is limited by available credentials and raw-history plan access;
  see [implementation and validation](MARKET_DATA.md).

- **v0.7.0 - completed and validated: Investment Analytics.** TWR, IRR/MWR, benchmarks, allocation, portfolio
  insights and income/dividend analytics. Depends on reliable cash flows, historical
  prices, FX and corporate-action policy; illustrative charts are not returns.
  Implemented views include account returns, security P&L, realized/unrealized breakdown,
  sector/geographic/currency exposure, attribution and performance/data-quality indicators.

## Current development and future versions

- **v0.8.0 - Gmail Ingestion (completed with documented limits).** Opt-in mail adapters, local OAuth/token handling,
  bounded parsing, normalized candidates, rules and explicit review. Depends on
  ingestion/provenance; mail and credentials remain private.
  Reuses the v0.3 import pipeline and v0.2 manual-override protections. Implemented:
  label-based discovery, incremental polling, a synthetic parser registry, normalized
  transaction candidates, payee/rule reuse, duplicate prevention and source provenance;
  review queue, parser diagnostics, sync history and offline operation. OAuth credentials
  stay in the OS vault with revocation/disconnection. Automatic posting is not implemented.
  Real-bank templates and live OAuth require separate authorized validation.
- **v0.9.0 - Multi-Source Reconciliation (completed and validated).** CSV/OFX/Gmail matching, provenance,
  deduplication, cleared/reconciled states and bank-statement reconciliation.
  Depends on adapters and reliable identities. Review remains separate; weak
  matches require decisions rather than destructive automatic merging.
  Includes source conflict review, historical match corrections and an immutable
  audit trail, preserving manual categorization and existing ingestion services.
- **v0.10.0 - Net Worth, Assets, Liabilities & Financial Goals (completed and validated).** Consolidate
  bank/investment valuation, dated multi-currency totals and asset/account breakdowns.
  Add separately modeled property, vehicles and other manual assets with valuation
  history; loans/mortgages/other debts must avoid double-counting card liabilities.
  Goals cover amounts/dates, linked accounts, progress/milestones, required monthly
  contributions and basic projections. Depends on valuation/liability semantics;
  cash history is not automatically complete net worth. Inspect the approved
  net-worth/save-up references. See [implementation contracts](NET_WORTH_GOALS.md).
- **v0.11.0 - Product Consolidation & UI/UX Refinement (completed and validated).** Audit every page and
  important user journey; improve reference fidelity, navigation, confusing forms,
  redundant screens, table density, empty/loading/error states and responsiveness.
  Preserve all existing functionality and explicit posting safeguards.
- **v0.12.0 - Interactive Demo & Portfolio Showcase (completed locally).** A populated fictional profile,
  18-24 months of coherent fictional history, one-click isolated/resettable demo mode, interactive transactions,
  budgets, investments and goals; guided onboarding, README screenshots and demo links.
  An optional hosted demo requires separately reviewed isolation/security and never
  changes the local-only persistence of personal workspaces. Use real backend APIs
  and financial services, with no external credentials required. Include investment
  prices/benchmarks, simulated Gmail/import/reconciliation evidence, assets/debts
  and goals; guided interviewer tours, architecture overview and disposable session
  isolation for any separately approved public demo.
- **v0.13.0 - Product Refinements & Brazilian Historical Demo (completed).**
  Appearance/localization, shared motion and financial UI improvements; native
  Brazilian fixed income, Life Events, read-only Pluggy and the official-observation
  Brazil scenario. Regression, migrations, privacy and production audits are recorded
  in RELEASE_0_13_0.md. Broader installation/recovery certification remains future work.
- **v0.14.0 - Frontend Refinement (next, not implemented).** Prepare the larger
  frontend migration from the validated v0.13 baseline; preserve financial/API
  behavior. Its branch alone does not approve or implement design changes.
- **v1.0.0 - Stable Release.** Final acceptance, no unresolved critical defects,
  verified installation/demo experience and documented limitations. Readiness must
  be demonstrated; a version counter alone never triggers stable promotion.

## Post-v1.0 / separately scoped advanced backlog

Allocation targets and rebalancing; retirement/FIRE planning; Monte Carlo analysis;
advanced portfolio insights/reporting; expanded adapters and user-controlled financial
automation. These remain product goals, not discarded requirements. Corporate actions
and tax-lot policies require separate specifications before calculations depend on them.

## Product and workflow references

- **Wealthfolio:** activities/holdings, valuation, TWR/IRR, benchmarks, allocation,
  targets/rebalancing, insights, dividends, net worth, manual assets/liabilities,
  spending, savings goals, retirement/FIRE and Monte Carlo planning.
- **Actual Budget:** payees, rules/suggestions, schedules, review, clearing,
  bank reconciliation, reliable history/editing and useful import workflows.
- **Securo:** adapters, source records, normalization, deduplication, rules,
  profiles, reconciliation and financial automation.

Inspect proven behavior and tests; preserve licenses and attribution. References do
not change category-target budgeting. Finance Tracker joins spending and investments
in private local SQLite, including planned Gmail and multi-source matching. Cloud
sync/authentication, Redis, Celery and AI are not implicit dependencies. PostgreSQL
remains a possible reviewed deployment migration, not a runtime requirement.

## v0.9 implementation reference review

Actual Budget's public `accounts/reconciliation.ts`, `Reconcile.tsx` and
`Reconcile.test.tsx`, plus its [reconciliation guide](https://actualbudget.org/docs/accounts/reconciliation/),
were inspected for cleared-balance comparison and locking. Finance Tracker adds
historical cutoffs, explicit statement revisions and cascading reopen; it deliberately
omits automatic adjustment entries and does not keep edited entries reconciled.
Securo's public [matching](https://docs.usesecuro.com/docs/features/reconciliation),
[import](https://docs.usesecuro.com/docs/features/import) and
[bank-sync](https://docs.usesecuro.com/docs/features/bank-sync) documentation informed
explainable alternatives, identity-first matching and local decision history.
Its automatic fuzzy matching/provider infrastructure is not adopted. The existing
Wealthfolio reference import-table source and approved Finance Tracker shell were
reviewed; the global visual hierarchy is preserved. No third-party source was copied
for this phase. Existing attribution/licenses remain intact.

The current release is v0.13.0; see [release validation](RELEASE_0_13_0.md).
Public deployment is not implemented.

### Unreleased v0.14 Spending decisions

The source Spending/Budgets/Insights migration includes persisted category/group
appearance and existing deterministic rules, refunds, target versions and Life
Events. See [the implementation record](SPENDING_BUDGETS_V014.md).

The following require a separately approved scope: category hierarchies and their
rollups; group buffers/rollover; a configurable event-type catalog; saved/multiple
spending-account scopes; planned income; manually entered starting rollover; and
prorated targets for arbitrary report periods. Insights deliberately compares whole
calendar-month targets with the same month's spending, labeled separately from
selected-period cash flow. No transaction timestamps are invented for heatmaps.

### v0.10 reference investigation

Inspected the public Wealthfolio `net_worth_service.rs`, `net_worth_model.rs`,
`save_up.rs`, goal storage models, `net-worth-content.tsx` and public
[Net Worth / Goals screenshots](https://wealthfolio.app/features/). Reused concepts
of an as-of breakdown, linked funding and calendar contributions, not source code.
Finance Tracker deliberately uses exact Decimal/string money instead of the
reference save-up engine's f64; fixed currency-safe allocations instead of account
percentages; no authoritative goal-summary cache or assumed investment returns.

[Actual reporting](https://actualbudget.org/docs/reports/) informed the all-account
assets-minus-debts view without adopting envelope budgeting.
[ProjectionLab](https://projectionlab.com/) informed separating actual historical
progress from hypothetical scenarios; its simulation engine was not adopted.
[YNAB targets](https://support.ynab.com/how-to-use-targets-rk5kkI9ks) was requested
but its support-page body was inaccessible to the browser tool; no implementation
claims or copied algorithms are based on it. Existing license notices are unchanged.

### Expanded v0.13 scope

The requested refinement now includes native Brazilian fixed income, persisted
Life Events, deterministic spending narratives, portfolio/income composition and
goal glide paths. It does not add AI, allocation targets/rebalancing, retirement/FIRE
or tax-aware funding. Release validation is recorded in RELEASE_0_13_0.md. See the source/visual parity
audit for remaining geometry differences; exact reference parity is not claimed.

The 2026-10-30 authorization additionally enables Pluggy/MeuPluggy read-only API
support: secure credentials, hosted connection/renewal, local resource observations,
account/asset mapping and explicit existing ingestion confirmation. This replaces
the earlier Pluggy exclusion, without adding payment initiation or automatic ledger
posting. Live institution/entitlement validation remains user-dependent; see PLUGGY.md.

### v0.14 Goals decisions (approved)

Add source templates and saved monthly contribution assumptions, archive restoration
and retained soft deletion. Preserve zero-return previews, exact fixed allocations
and Caixinha account reservation. Postpone expected-return/uncertainty forecasting,
percentage-of-account funding and Retirement/FIRE. No AI, tax-aware funding or
rebalancing is included. Implementation/validation: [Goals migration](GOALS_V014.md).

### v0.14 Performance and Insights decisions (approved)

Add read-only annualized TWR, log-return volatility and flow-adjusted maximum
drawdown, plus Stage A local allocation targets/tolerances/drift. Reuse existing
daily holdings projections for Top Movers and composition coloring. Preserve the
source-adapted widget customization and existing Income paid/accrued distinction.

Postpone full trading/cash/FX attribution; Stage B hypothetical rebalancing worksheet
and trade planning/export; weighted ETF look-through; classification hierarchies;
named portfolios/account groups. No automatic trades, liquidity recommendations,
tax/fee optimization or Retirement/FIRE scope. Source worksheet UI is retained as
an uncompiled licensed reference. See [Performance/Insights](PERFORMANCE_INSIGHTS_V014.md).

## Settings migration status (unreleased v0.14)

Source-style Settings, shared account administration, organizational account groups,
securities/classification access, exact whitelisted exports and maintenance-only
personal backup/restore are implemented. Broader restore/encryption/platform readiness
is not implied. Category hierarchies, configurable event types, audited FX/quote
changes, provider fallback engines, contribution limits, planned income and manual
starting rollover remain postponed by user choice. See [Settings coverage](SETTINGS_V014.md).
