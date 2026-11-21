# v0.14 frontend adaptation workflow

Reference baseline: Wealthfolio commit
[`92b4647f74ec51fbbb1a772db4f42ea91060c518`](https://github.com/wealthfolio/wealthfolio/tree/92b4647f74ec51fbbb1a772db4f42ea91060c518),
inspected 2026-11-04. Pin links to this revision throughout v0.14; an upstream
update requires an explicit recorded decision, not silently following `main`.

For each user-supplied feature page:

1. Inspect its real React components, dependent hooks, shared UI, theme definitions
   and tests at the pinned revision, plus the actual public visual reference.
2. Compare against Finance Tracker's existing screen, APIs, types and tests. Record
   direct adaptations, thin adapters, genuine capability gaps and license terms.
3. Group missing capabilities into one question with benefits and complexity.
   Wait for the user's choices before implementing them. Continue already-supported
   adaptations independently. Record declined/postponed items in the feature backlog.
4. Adapt compatible source structures and interactions directly. Preserve attribution
   and AGPL/OFL notices, without upstream branding or proprietary assets. Keep shared
   components coherent across subsequent migrations; remove old code only after its
   behavior is covered and preserved.
5. Keep FastAPI/SQLite and existing financial services authoritative. Replace Rust,
   desktop and upstream API dependencies with thin typed adapters. Money remains
   exact strings/Decimal; only dimensionless chart geometry may use Number.
   Missing data remains unavailable. Brazilian products remain first-class through
   existing holdings, fixed-income and cash services, without duplicate assets.
6. Validate automated tests, actual browser interactions, populated/empty/unavailable
   states and responsive layouts. Compare matching viewport/theme screenshots against
   the reference; distinguish official images from a running pinned application.
   Keep captures/reference checkouts ignored and document remaining visual differences.
7. Finish and validate the current feature before moving to another. Update the
   feature record and third-party notices. Branch creation does not change the
   released version. Git publishing requires separate authorization.

First feature: [Net Worth implementation record](NET_WORTH_V014.md).

Portfolio Insights: [implementation, approved customization and postponed capabilities](PORTFOLIO_INSIGHTS_V014.md).

Investment Income: [source adaptation, approved FX/accrual projections and demo data](INCOME_V014.md).

Holdings and Activities: [screen checklist, adapters, demo content, validation and
postponed engines](HOLDINGS_ACTIVITIES_V014.md).

Spending, Budgets and Insights: [source inventory, supported screens, exact-money
adapters, approved boundaries and validation](SPENDING_BUDGETS_V014.md).

Goals and Savings Planner: [source/API/demo coverage, approved boundaries and validation](GOALS_V014.md).

Settings: [source inventory, confirmed boundaries, API/backup safety and validation](SETTINGS_V014.md).

Application-wide stabilization: [inventory, checks and release gates](AUDIT_V014.md).
