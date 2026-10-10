# Phase 1.7 UI validation

The approved development checkpoint covers the application shell and Overview.
It preserves the existing FastAPI backend, local SQLite database, financial
semantics, and API contracts. No future financial engines were added.

## Screenshots

All screenshots show the deterministic synthetic demo through September 30, 2026.
They contain fictional records only. Open the [screenshot gallery](visual/phase17/index.html).

- [Overview, 1440 x 900](visual/phase17/finance-tracker-1440.png)
- [Overview, 1920 x 1080](visual/phase17/finance-tracker-1920.png)
- [Exact-value tooltip](visual/phase17/finance-tracker-tooltip.png)
- [Expanded sidebar](visual/phase17/finance-tracker-expanded.png)
- [Mobile Overview](visual/phase17/finance-tracker-mobile.png)
- [Mobile navigation](visual/phase17/finance-tracker-mobile-drawer.png)
- [Light theme](visual/phase17/finance-tracker-light.png)

## Application conventions

- Desktop sidebar: 70px collapsed, 220px expanded, with accessible navigation names.
- Overview: compact section tabs, 30px primary balance, 280px ledger-history chart,
  centered period selector, and compact account rows.
- Cash flow and recent activity use the local API. Transfers and opening balances
  are excluded from income/expense reporting.
- Monetary values remain exact decimal strings. Only dimensionless chart coordinates
  and timestamps become JavaScript numbers. Visual curve interpolation is not
  additional financial data.
- Available ranges: 1M, 3M, YTD, 1Y, ALL. Overview options contains month/currency controls.
- The headline represents ledger balance and balance change, not investment returns.
- Mobile navigation uses a drawer below 1024px. Dark and light themes are supported.

## Validation at the approved checkpoint

- Backend: 43 tests passed, including exact storage, opening balances, linked-transfer
  atomicity, balance reconstruction, foreign keys, and reporting exclusions.
- Frontend: 32 tests passed, including navigation, exact chart values, daily closing
  history, transaction forms, and neutral transfer presentation.
- Ruff, ESLint, formatting, TypeScript, and the production build passed. Existing
  non-fatal dependency annotation warnings remain.
- Clean SQLite migrations reached sqlite_0002 with no drift. Repeated demo seeding
  preserved existing data. Generated databases remained local and ignored.
- Isolated browser workflow checks covered accounts, categories, income/expenses,
  transfer creation, filters, account detail, and month navigation. The mandatory
  scenario produced Checking=5300, Savings=2500, income=1000, expenses=200.
- Browser layout checks covered 1440x900, 1920x1080, 1280px, 1024px, 768px, and 390px,
  including chart interactions, sidebar expansion, settings, previews, and themes.

## Scope and attribution

Budget, Investments, Performance, Net Worth, and Reports remain explicitly labeled
read-only previews. Deep links, investment valuation, and future financial engines
are deferred. Phase 2A implementation requires its own approved specification.

Adapted-source provenance and AGPL/OFL license notices remain in
[THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md) and frontend build assets.
