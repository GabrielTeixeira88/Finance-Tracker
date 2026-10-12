# Finance Tracker roadmap

Versions are the primary milestone identifiers. Historical phases remain traceable
below; they do not imply earlier releases or tags. Current application version is
0.6.0. v0.7.0 Investment Analytics is next; no analytics implementation is included.

## Historical mapping

| Version | Previous designation | Scope |
|---|---|---|
| v0.1.0 | Phase 0, 1, 1.6–1.7 | Foundation, core ledger, SQLite and Wealthfolio-based UI |
| v0.2.0 | Phase 2A and 2B | Payees, transaction review, rules and schedules |
| v0.3.0 | Phase 3 | CSV/OFX imports and ingestion infrastructure |
| v0.4.0 | Phase 4 | Spending & Budgets |
| v0.5.0 | Phase 5 | Investment Foundation |
| v0.6.0 | Phase 6 | Market Data & Portfolio Valuation |
| v0.7.0 | Phase 7 | Investment Analytics |
| v0.8.0 | Phase 8 | Gmail Ingestion |
| v0.9.0 | Phase 9 | Multi-Source Reconciliation |
| v0.10.0 | Phase 10 | Net Worth & Goals |
| v0.11.0 | Phase 11 | Product Consolidation & UX Refinement |
| v0.12.0 | Phase 12 | MVP Polish & Release Preparation |
| v1.0.0 | Stable release | First fully validated stable version |

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

## Future versions - planned, not implemented

- **v0.7.0 - next: Investment Analytics.** TWR, IRR/MWR, benchmarks, allocation, portfolio
  insights and income/dividend analytics. Depends on reliable cash flows, historical
  prices, FX and corporate-action policy; illustrative charts are not returns.
  Planned views include account/security returns, realized/unrealized breakdown,
  sector/geographic/currency exposure, attribution and performance/data-quality indicators.
- **v0.8.0 - Gmail Ingestion.** Opt-in mail adapters, local OAuth/token handling,
  bounded parsing, normalized candidates, rules and explicit review. Depends on
  ingestion/provenance; mail and credentials remain private.
- **v0.9.0 - Multi-Source Reconciliation.** CSV/OFX/Gmail matching, provenance,
  deduplication, cleared/reconciled states and bank-statement reconciliation.
  Depends on adapters and reliable identities. Review remains separate; weak
  matches require decisions rather than destructive automatic merging.
- **v0.10.0 - Net Worth & Goals.** Valued history, manual assets/liabilities and
  savings goals. Depends on valuation/liability semantics; cash history is not
  automatically complete net worth.
- **v0.11.0 - Product Consolidation & UX Refinement.** Coherent spending/investment
  workflows, reliable history/editing, imports, reporting and automation controls.
  Depends on prior domains; preserve explicit posting safeguards.
- **v0.12.0 - MVP Polish & Release Preparation.** Accessibility, responsive layouts,
  performance, backup/recovery, migration/privacy audits, docs and end-to-end checks.
  Depends on integration of the agreed MVP scope.
- **v1.0.0 - stable gate.** Financial correctness, migrations, recovery, privacy and
  usability must pass acceptance. No automatic promotion by schedule.

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
