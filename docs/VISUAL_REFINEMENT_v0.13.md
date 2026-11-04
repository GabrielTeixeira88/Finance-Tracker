# v0.13 visual refinement — implementation and review

Unreleased. Financial services, historical coverage and exact decimal contracts remain authoritative.

This records the earlier appearance-only pass. The subsequent fixed-income/Life Events
implementation, new migrations, final test totals and updated visual comparison are in
[the current parity audit](WEALTHFOLIO_PARITY_v0.13.md). The original measurements below
remain historical; the current after-gallery uses the expanded synthetic baseline.

## Verified references

Inspected upstream `wealthfolio/wealthfolio` at
`d86c20194b4b61ad8133ce820739d5ac83f9045e` in an ignored, separate checkout.
Read `LICENSE`, `TRADEMARKS.md`, history/performance charts, dashboard-card,
metric-display, font/theme/language selectors, i18n initialization and holdings
`composition-chart.tsx`. Official dashboard and portfolio-insights screenshots
were inspected visually. The YouTube URL could not be fetched; no video observations
or timestamps are claimed.

References: https://wealthfolio.app/docs/guide/dashboards/ and
https://wealthfolio.app/features/. The reference uses a large unboxed history area,
muted surfaces, small section headings, compact range controls and proportional
holdings rectangles with allocation arcs. Its financial Number-based transformations
are not reused: our geometry uses dimensionless coordinates and exact string labels.
No logos, security logos, screenshots or upstream translations are bundled as product assets.

## Page audit and delivered hierarchy

| Page | Existing layout / problem | Delivered hierarchy and reference | Retained / disclosed details | Risks and benefit |
| --- | --- | --- | --- | --- |
| Overview | 280px history, account rows, textual cash flow; chart competes with metadata | Larger history, primary balance/change, compact range controls; reference history-chart | Exact chart table, currency and period context, accounts and recent activity | Never call cash balance net worth or interpolate missing monetary observations |
| Spending | Daily bars, several equal metrics and repetitive category rows | Cash-flow comparison and category composition, then daily activity/budget progress; spending dashboard | Refund signs, category drill-down, target and rollover editing | Negative net categories cannot become positive donut slices |
| Investments | History followed by repeated six-metric blocks and holdings tables | History, allocation arcs and holdings treemap, then operational detail; holdings composition | Quantities, basis, freshness, cash, all activity/editing | Incomplete or negative valuations must not produce misleading weights |
| Allocation | Breakdown table for one dimension | Proportional composition with selectable dimension and exact textual alternative | Unknown classification, cash, coverage, security drill-down | No invented regions/sectors or inflated known-only weights |
| Performance | Four headline metrics, chart, several result tables | Return chart dominates; supporting metrics and explanations follow | TWR/XIRR, benchmark labels, missing coverage, exact data | Value growth is not return; gaps remain gaps |
| Net Worth | History plus five equal metrics and two long tables | History, asset/debt comparison, separate composition charts, expandable records | Native values, coverage, debt signs, observation editors | Do not double-count brokerage cash, property equity or goals |
| Goals | Dense goal rows and small progress bars | Clear progress rings and target/date context, then goal detail/history/scenario | Actual history, hypothetical contribution forecast, allocation warnings | Do not create a history/forecast where the service has none |
| Transactions | Dense ledger with progressive filters | Preserve operational density and existing grouping | Raw descriptions, review, clearing, explicit bulk scope | Localization must not modify source text, selection or posting semantics |
| Imports / Reconciliation | Explicit evidence tables and confirmation | Preserve comparison/evidence, localize controls and warnings | Amount/date/account discrepancies and source records | No automatic matching or localized reinterpretation of uploaded source data |
| Settings | Configuration tabs without appearance controls | Appearance previews, language selector, existing configuration tabs | Five fonts/palettes, dark/light/system, local preferences | No network fonts; isolate demo preferences from normal preferences |

## Baseline

Fresh isolated v0.12 demo browser capture before UI changes:
`docs/screenshots/v013/before/`. Existing runner captures 1440×1000, 1280×900,
1920×1080 and 390×844; use these identical states for before/after comparisons,
and additionally validate 1440×900, 1280×800 and 768px for the new acceptance criteria.
All screenshots contain only synthetic data. Normal local data is untouched.

## Implementation

Shared appearance tokens replace the duplicated page/root theme definitions. Five
fonts (JetBrains Mono, Inter, IBM Plex Sans, Source Sans 3, DM Sans), five palettes
(Olive, Slate, Graphite, Forest, Plum), and dark/light/system mode apply to controls,
charts and tooltips. Fonts are self-hosted with OFL notices. Existing AGPL source
attribution remains; no additional upstream source components were copied.

Overview history now occupies 300–430px depending on viewport. Investment history
and Net Worth history use 340px; performance uses 400px. Shared composition visuals
provide allocation arcs and a holdings treemap, with exact legends and currency-aware
tooltips. Exact amounts use a separate payload key because Recharts overwrites
treemap `value` with its dimensionless geometry weight; browser validation compares
the rendered tooltip with the API amount. Investment composition follows the selected valuation currency. Spending
adds actual monthly cash-flow comparisons and category composition. Goals use progress
rings above expandable detail, retaining history, forecasts and allocation guards.

Transactions, rules, schedules, imports and reconciliation retain their operational
controls. Changes there localize application copy and decimal inputs; they do not
change posting, matching, selection scope or advanced financial settings. SQLite
schemas and financial services are unchanged. The only backend addition is stable
transport/validation error-code headers with unchanged response bodies.

Bundled English, Brazilian Portuguese and Latin American Spanish catalogs cover
application labels, forms, navigation, alerts and chart controls. Source/user text
stays original. Money inputs validate localized strings and pass canonical exact
decimal strings to existing APIs. See [appearance/localization contracts](APPEARANCE_AND_LOCALIZATION.md)
for preference isolation, fallback behavior and the remaining diagnostic boundaries.

## Validation (2026-10-22)

| Check | Result |
| --- | --- |
| Backend `python -m pytest` | 379 passed; two existing SQLAlchemy connection-option warnings in synthetic seed tests |
| Backend Ruff lint / format check | Passed; 106 files formatted |
| Frontend `npm test` | 139 passed across 21 files (baseline: 112) |
| Frontend ESLint / Prettier | Passed |
| TypeScript + Vite production build | Passed; bundle-size warning remains |
| Isolated Edge `npm run test:demo -- --appearance` | Passed, including real API/SQLite writes and reset |
| Fresh/populated migrations and financial regressions | Included in passing backend suite; no new migration |
| Diff whitespace | `git diff --check` passed |

New tests cover translation-key parity and literal usage, interpolation, three-locale
formatting, exact localized inputs (including large values, negatives, grouping and
six decimals), form reset, preference isolation, composition completeness/negative
values, validation messages and stable API error headers. Existing financial suites
continue to cover openings, balances, atomic transfers, ingestion, reconciliation,
investment analytics and goals.

Browser validation exercised all five fonts and palettes, light/dark/system changes,
preference reload, Portuguese and Spanish navigation, and Portuguese `1,50` expense
entry verified as exact `1.500000` through the API. Demo reset removed the expense,
preserved demo appearance/language, and left a separate normal-preference sentinel
unchanged. USD composition and tooltip labels were verified. Tests create their own
`.tmp/demo-e2e-*` database; no normal database is reset or used for financial tests.

Text tokens (foreground, muted, positive and negative) meet 4.5:1 against the page
background in every palette/mode combination. Rendered ghost controls also follow the
foreground token. This is a targeted contrast check, not a full WCAG certification.
Keyboard controls, labeled forms, exact chart alternatives and reduced-motion styling
remain. Browser checks cover mobile navigation and absence of outer-page horizontal
overflow; dense tables retain intentional internal scrolling.

## Visual comparison

Open the local [before/after viewer](screenshots/v013/index.html) for identical
1440×1000 captures of Overview, Spending, Investments, Allocation, Performance,
Net Worth, Goals, Transactions and Reconciliation. The before/after financial state
is the same fixed fictional September 2026 workspace. Larger history areas and
composition visuals intentionally move secondary controls below the first viewport.

Additional captures in `screenshots/v013/after/` cover 1920×1080, 1440×900,
1280×800, 768×1024 and 390×844, plus Portuguese, Spanish, light-mode appearance,
USD holdings composition and its exact tooltip. Captures wait for data/fonts and
settle theme transitions. Representative desktop, tablet, phone, translated and
light-theme captures were visually inspected; no claim is made that every possible
font/palette/language/viewport combination was manually reviewed.

Compared with the official visual reference, this application retains its own
220px navigation, demo banner, currency/coverage disclosures and operational controls.
The chart-first hierarchy, subdued surfaces, allocation arcs and proportional holdings
rectangles follow the inspected reference. Reference logos/security artwork are absent.
Existing mixed-currency and incomplete-data states remain visible rather than being
filled with decorative or invented values.

## Known limitations and remaining stabilization

- Some server-produced methodology/evidence text remains English. Legacy domain
  exceptions use localized safe status messages outside English; detailed domain-code
  localization is still needed. Native date/dialog chrome follows browser/OS settings.
- The main bundle is approximately 1.28 MB minified / 399 kB gzip. Locale loading and
  further code splitting need performance work; the build warning is not suppressed.
- `npm audit` reports two moderate dev-tool findings (`vitest` / `@vitest/mocker`,
  installed 4.1.11). They require a separately validated tooling patch; no production
  dependency finding was reported by this audit. No broad dependency upgrade was made.
- Chart tooltips remain pointer-oriented; exact textual/table alternatives are retained.
  Long translated control labels and dense mobile evidence tables merit further review.
- Security, SQLite backup/recovery, performance, cross-platform installation, financial
  integrity, demo isolation and release-readiness validation remain v0.13 work. Reports
  remains a preview. This change does not assert v1.0 readiness.

All changes are uncommitted on the existing development branch. Version stays 0.12.0;
the changelog remains Unreleased. No branch, release, tag or Git publishing was created.
