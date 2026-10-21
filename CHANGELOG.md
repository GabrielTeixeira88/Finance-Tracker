# Changelog

Notable Finance Tracker changes. Versions follow Semantic Versioning; Git tags use
`vMAJOR.MINOR.PATCH`. Historical milestones are documentation groupings, not claims
of independently published releases or tags. See [the roadmap](docs/ROADMAP.md).

## [Unreleased]

## [0.12.0] - 2026-10-21

### Added
- Separately owned, loopback-only interactive demo with a deterministic 24-month
  fictional profile, migrated SQLite baseline, atomic generation reset and stale-write guards.
- Real ledger, budget, schedule, import/reconciliation, investment, price/FX, net-worth
  and goals examples; safe Gmail Notification Simulation without OAuth or network calls.
- Persistent demo controls, skippable guided tour, downloadable synthetic samples,
  isolated browser runner, showcase screenshots and deployment/walkthrough documentation.
- Tests for complete seed determinism, normal/demo isolation, restart persistence,
  reset failure/concurrency, external-service denial and real financial projections.

### Changed
- README now leads with the local demo, current features and engineering safeguards.
- Vite updated within major version 7 to address reported development-server advisories;
  Playwright added for repeatable browser validation.
- Demo-aware goal/reference dates and reconciliation cutoff defaults.
- Local demo only; no public deployment or hosted session service.

## [0.11.0] - 2026-10-20

### Changed
- Bookmarkable application/section routes, browser history, retained ledger filters,
  searchable workflow destinations and remembered sidebar appearance.
- Compact transaction filters/rows, contextual rule drafts, simple/advanced rule
  editing, rule search/status filtering and disabled duplication.
- Settings payee management, linked Gmail setup/review, explicit disconnect
  confirmation and import progress context.
- Shared section navigation, destructive-action treatment, visible keyboard focus,
  reduced motion, query retries and cancellation of new-entry forms.
- Bookmarkable investment/spending/net-worth views, holding currency filtering,
  clearer performance explanations, goal remaining values and advanced target disclosure.
- Lazy-loaded financial pages, UX audit and demo-readiness documentation.

### Fixed
- Goal milestone captions no longer masquerade as actual funding progress;
  exact progress and unavailable coverage have distinct labels.

## [0.10.0] - 2026-10-19

### Added
- Exact current/historical net worth using existing ledger, investment valuation and FX.
- Dated manual assets/debts, property links, auditable value corrections and disposal/payoff.
- Savings goals, shared account allocations, manual progress, milestones and transparent scenarios.
- Functional Net Worth and Goals navigation, synthetic wealth demo and additive `sqlite_0012` / `sqlite_0013`.
- Regression coverage for accounting, historical coverage, goals and populated migrations.

### Fixed
- Goal creation waits for initial list loading, preventing a stale-list race after saving.

## [0.9.0] - 2026-10-18

### Added
- Shared cross-date, explainable CSV/OFX/Gmail matching with explicit conflict review.
- Audited source detachment/reassignment, rejected proposals and controlled duplicate merges.
- Independent clearing states, exact cutoff statement comparison, locking and cascading reopen.
- Transactions reconciliation workspace, source evidence and bank-state filters.
- Additive `sqlite_0011` migration and isolated migration/accounting/correction tests.

### Fixed
- Date corrections through transaction PATCH now invalidate prior clearing verification,
  consistently with the ordinary financial-edit workflow.

## [0.8.0] - 2026-10-14

### Added
- Gmail Desktop OAuth with state/PKCE, loopback callback and OS credential storage.
- Read-only label retrieval, bounded backfill, incremental history, resumable source
  identities, opt-in polling and safe disconnect/revocation.
- Synthetic bank parser and Gmail candidates using existing rules, duplicate review,
  schedule suggestions and atomic ledger confirmation.
- Settings/Gmail and Transactions/Gmail review, proposed-detail editing and explicit
  page-scoped bulk approval; additive `sqlite_0010` operational migration.
- Mocked Google/security/regression tests. No real bank templates or live OAuth
  validation; automatic posting remains disabled.

## [0.7.0] - 2026-10-13

### Added
- Scope-aware external flows, exact daily TWR and bounded annualized XIRR.
- Performance history, cached price-return benchmark overlays and explicit coverage reasons.
- Actual dividend/interest reporting, cash-inclusive allocation and declared asset metadata.
- Position P&L components, closed positions, concentration and limited exact FX decomposition.
- Performance/Allocation/Income subviews, deterministic analytics demo and regression tests.
- Additive `sqlite_0009` metadata migration; financial records are unchanged.

### Changed
- Investments now includes functional Performance, Allocation and Income views.
- Performance navigation opens analytics instead of a preview.

### Limits
- Date-only end-of-day TWR; conservative XIRR ambiguity handling.
- Benchmarks are labeled price-return proxies; FX attribution requires unchanged positions.

## [0.6.0] - 2026-10-12

### Added
- Documented Brapi v2 and Alpha Vantage adapters, validated symbol mappings and bounded refresh.
- Exact local quote/FX cache, source conventions, manual mode and provider status.
- Dated ECB FX conversion, current reporting values and chronological portfolio history.
- Market Data settings, security history, portfolio chart and explicit coverage gaps.
- Deterministic multicurrency market demo, migration and offline regression coverage.

### Changed
- Investment views use eligible cached market prices and dated FX; manual mode is preserved.

### Fixed
- Raw-history backfill no longer treats latest/adjusted quotes as historical coverage.
- FX backfill covers newly added older investment cash instead of only recent rates.
- Cancellation is checked between quote batches and FX history chunks.

### Limits
- Brapi raw historical prices require Pro entitlement; adjusted history is never valued.
- Alpha Vantage requires a key; free daily history is limited to 100 observations.
- Corporate actions and investment-performance metrics remain outside this milestone.

## [0.5.0] - 2026-10-11

### Added
- Securities identified by symbol, exchange and currency, with optional ISIN.
- BUY/SELL, dividends, interest, fees and taxes with exact investment cash integration.
- Activity-derived holdings, weighted-average cost and realized results across accounts.
- Dated manual prices and unrealized results; explicit missing/stale-price states.
- Brokerage CSV profiles, preview, atomic confirmation, provenance and repeat safety.
- Investment overview, holdings, account/security details, confirmation and safe voiding.
- Deterministic synthetic portfolio, additive migration and financial regression tests.
- Canonical version metadata, release conventions and full SemVer roadmap.

### Changed
- Investments is functional; Performance, Net Worth and Reports retain preview boundaries.
- Account cash includes investment movements once; consumption excludes investments.

### Fixed
- Corrected the Overview cash-only explanatory separator.

### Limitations
- Manual valuation only; no live prices, FX, corporate actions, return or tax engine.
- Overview/Net Worth remain cash histories, not historical market-valued portfolios.

## [0.4.0] - Historical milestone

### Added
- Monthly category targets, groups, effective defaults, overrides and signed rollover.
- Spending insights, explicit purchase refunds and ledger drill-downs.

## [0.3.0] - Historical milestone

### Added
- Local CSV/OFX imports, saved mappings, previews and explicit confirmation.
- Exact duplicates, possible-match decisions and many-source provenance.

## [0.2.0] - Historical milestone

### Added
- Normalized payees, review, combined filters and atomic bulk metadata updates.
- Rules, manual protections, correction-based suggestions and schedules.
- Phase 2A and Phase 2B belong to this one milestone, not separate patch releases.

## [0.1.0] - Historical milestone

### Added
- React/FastAPI, exact ledger, accounts, categories, openings and linked transfers.
- SQLite, SQLAlchemy/Alembic, historical dashboard and approved UI foundation.
- Deterministic synthetic demo and financial integrity tests.
