# Phase 1.7 visual review

Scope: application shell and Overview only. No backend, database, migration,
financial API, or future-page layout changes were made in this pass.

## Reference and method

- Inspected the public [Wealthfolio repository](https://github.com/wealthfolio/wealthfolio)
  in the separate ignored `.tmp/wealthfolio-phase17` directory.
- Ran the official Wealthfolio v3.9.1 image locally on loopback port 8089. The
  reference checkout matches image revision `392f272c5b15a4af45dc2ff71dcbec474f47112a`.
  Image digest: `sha256:0ebd0147463f3637afce8cf33e0601a7c5c060e70f15c19d5762435f5819234a`.
- Inspected sidebar/layout, dashboard, account summary, balance, history chart,
  interval selector, font configuration, and Flexoki theme source.
- The supplied [YouTube video](https://www.youtube.com/watch?v=pfkLHAjzhl4) was
  accessible in Edge and visually inspected. The web text reader could not open it;
  this did not prevent browser inspection. The running dark desktop application is
  the primary comparison reference.
- Populated **only the isolated reference database** with equivalent cash movements
  from our 500-entry synthetic ledger. Reference accounts have a Synthetic prefix.
  Both applications show BRL 116,654.96, with matching account balances and history.
  No review-demo records were changed and no real financial data was used.
- Captured both applications in Edge, en-US locale, device scale 1, at 1440×900 and
  1920×1080. Both show 3M through September 30, 2026; the reference browser clock was
  fixed to that demo endpoint. These are actual application screenshots, not mockups.
- Compared captures and iterated on account-value truncation, lower-section spacing,
  sidebar rhythm, account chevrons, typography, and tooltip composition/position.

## Screenshots

Open the [interactive comparison](visual/phase17/index.html) for resolution selection,
tooltip comparison, and an original-pixel mode. Clicking an image opens the raw PNG.

| Resolution        | Reference                                             | Finance Tracker                                              | Side by side                                        |
| ----------------- | ----------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------- |
| 1440×900          | [Wealthfolio](visual/phase17/wealthfolio-1440.png)    | [Implementation](visual/phase17/finance-tracker-1440.png)    | [Comparison](visual/phase17/comparison-1440.png)    |
| 1920×1080         | [Wealthfolio](visual/phase17/wealthfolio-1920.png)    | [Implementation](visual/phase17/finance-tracker-1920.png)    | [Comparison](visual/phase17/comparison-1920.png)    |
| Tooltip, 1440×900 | [Wealthfolio](visual/phase17/wealthfolio-tooltip.png) | [Implementation](visual/phase17/finance-tracker-tooltip.png) | [Comparison](visual/phase17/comparison-tooltip.png) |

Additional captures: [expanded sidebar](visual/phase17/finance-tracker-expanded.png),
[390px Overview](visual/phase17/finance-tracker-mobile.png),
[mobile drawer](visual/phase17/finance-tracker-mobile-drawer.png),
[light theme](visual/phase17/finance-tracker-light.png).

The paired images preserve each screenshot's original pixels and add only a 40px
caption strip. No application screenshot was painted over or retouched.

## Geometry and visual comparison

| Element          | Reference and implementation                                             |
| ---------------- | ------------------------------------------------------------------------ |
| Desktop sidebar  | 70px collapsed, 220px expanded; 48px navigation rows, 4px rhythm         |
| Header tabs      | x=86, y=16 in collapsed mode; 40px group height                          |
| Balance headline | x=102, y=84; JetBrains Mono 30px/36px, weight 700, muted fraction        |
| Hero chart       | x=70, y=146; 280px high; full remaining viewport width                   |
| Chart styling    | Hidden axes, 1px olive monotone line, restrained fill, exact-value hover |
| Period controls  | Below chart, 32px selected pill, compact 12px labels                     |
| Lower content    | 40px side gutters, three-column grid with left spanning two, 80px gap    |
| Account rows     | First row y=526; 82px height; 12px gaps; 16px account/value text         |
| Dark surfaces    | Flexoki background, charcoal rows, muted text, low-contrast borders      |

The synthetic balance curve aligns because both charts derive from equivalent
ledger history. Inactive dates carry forward the last closing amount. Only normalized
dimensionless chart coordinates become JavaScript numbers; tooltip/table amounts
remain exact decimal strings. Monotone interpolation is visual geometry, not new
financial records or intraday valuations.

## Remaining differences

1. **Domain labels and icons:** Finance Tracker retains its own mark and existing
   destinations. It has eight primary destinations plus Settings; the reference has
   six. Preview destinations remain labeled in accessible names, hover titles,
   expanded navigation, and their pages. No Wealthfolio branding was imported.
2. **Overview versus Investments:** the active tab says Overview, so its pill is
   narrower. Net Worth opens our existing labeled preview; Spending displays existing
   category data. No holdings or investment engine was added.
3. **Financial meaning:** our second headline line shows ledger balance change,
   BRL 13,275.91 / 12.84% in this capture. The reference shows zero investment return
   because its corresponding history consists of deposits/withdrawals. Matching those
   figures would misrepresent our financial model.
4. **Secondary column:** Cash flow and Recent activity occupy the reference's
   Holdings/Goals positions. The reference's empty portfolio/goals panels are shorter
   than our populated activity list. These are existing API-backed values.
5. **Available intervals:** only the existing API's 1M, 3M, YTD, 1Y, ALL are shown.
   Wealthfolio additionally offers 1D, 1W, 6M, and 5Y. The resulting range group is narrower.
6. **Account metadata:** our rows include account type and currency, omit the reference
   account-name prefix, and display negative balances in the existing expense color.
7. **Utilities/tooltip:** reference health/privacy/connect/profile controls map to
   synthetic-data information, exact chart data, options, local theme, and a local
   workspace mark. Tooltip dates/balances match; our tooltip omits investment net
   deposits and shows Total balance. No fake cloud/profile behavior was introduced.
8. **Responsive behavior:** the existing 1024px drawer threshold remains. At 390px,
   header utilities wrap; this pass prioritizes matching the desktop reference.

This implementation has been approved as the development checkpoint; the captures
are not a claim of pixel identity. Future-page redesigns remain outside this scope.

## Validation

- Backend: **43 tests passed**, preserving mandatory balances, exact storage,
  foreign keys, opening records, transfer atomicity, and reporting exclusions.
- Frontend: **32 tests passed** (27 existing + 5 added). New coverage checks collapsed
  navigation/page finder, Overview views/exact values, daily carry-forward/leap dates,
  constant/empty history, and large exact decimal headline parts.
- Ruff check and formatting: passed, 24 files already formatted.
- ESLint and Prettier checks: passed.
- TypeScript / Vite production build: passed. Existing Zod pure-annotation warnings
  remain non-fatal; no build errors.
- Real-browser financial regression used a **separate temporary SQLite database**:
  account creation/edit/activation, category CRUD, income/expense CRUD, all filters,
  unified transfer creation, neutral linked records, account detail, month navigation,
  and dashboard totals passed. Checking=5300, Savings=2500, income=1000, expenses=200.
- Visual browser checks passed: 1440×900, 1920×1080, 1280px, 1024px, 768px, 390px;
  populated chart/tooltip, range queries, sidebar expansion, page finder, Settings,
  Spending, mobile navigation/Escape, no horizontal document overflow, and light mode.
- Backend source hashes match the start-of-phase snapshot. The synthetic review
  database remains unchanged. Temporary reference/test databases, browser files,
  and local configuration remain ignored.

The initial backend invocation encountered the sandbox's system-temp permissions;
running with `--basetemp=.tmp/pytest-phase17-final` from the repository root passed.
An initial browser assertion ran before the asynchronous dashboard finished loading;
the completed check waits for the metrics and passed without repeating financial writes.

## Change boundary and licensing

Changes are confined to shell/Overview components and scoped CSS, exact-money display
parts, a daily chart helper, five regression tests, the locally bundled font dependency,
documentation, licenses, and screenshot artifacts. The existing shared account-row
component has an optional chevron used only by Overview. Preview page source/layouts,
FastAPI, SQLite configuration, services, and API contracts were not changed.

The full working-tree Git diff also includes earlier uncommitted Phase 1.6 changes;
those are not new Phase 1.7 backend work. No commit, push, merge, or tag was performed.

Adapted source files are explicitly marked, and full AGPL/OFL notices are preserved
and included in frontend build assets. See [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).
