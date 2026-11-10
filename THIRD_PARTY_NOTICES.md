# Third-party attribution

## Current grant and retained terms - 2026-11-10

Owner-authored Finance Tracker code is AGPL-3.0-only under the complete root
LICENSE and NOTICE.md. Third-party copyrights and licenses remain distinct.
Wealthfolio is a trademark of Teymz Inc.; Finance Tracker is neither an official
product nor endorsed by its authors. Adapted application source remains AGPL,
shared UI source retains its declared MIT terms, and ofxtools retains GPL terms.
The upstream UI package declaration and standard MIT permission/warranty text are
preserved as Wealthfolio-UI-PACKAGE.json and Wealthfolio-UI-MIT.txt. No previously
unverified copyright year or author is invented. Runtime dependency notice files,
including nested vendored licenses, are collected in RUNTIME_DEPENDENCY_NOTICES.txt.
Published packages missing their own copyright notice are identified as such;
metadata evidence is not a certification of every upstream ownership claim.

See docs/FINALIZATION_V014.md for the approved decision and remaining cautions,
and frontend/public/licenses/SOURCE_ACCESS.md for exact-version source access.
Historical pass descriptions below retain their original dates and scope; current
v0.14 licensing and illustration exclusions supersede pre-approval restrictions.

## v0.14 Holdings and Activities source migration

`frontend/src/features/{holdings,activities}/` adapts actual presentation components
from Wealthfolio revision `92b4647f74ec51fbbb1a772db4f42ea91060c518`:
Holdings tables/mobile lists, alternative holdings, liability cards, asset profile
and detail cards, action palette, scope selection, swipeable pages, activity
tables/mobile cards, day groups, column controls and scroll measurement hooks,
Spending rows/cards, native editor/type picker, account-detail composition and
import upload/step components. Quotes retain the source close-price layout while
using the local observation contract rather than fabricated OHLC fields.
`frontend/src/lib/row-click.ts` and its interaction regression tests adapt the
same revision's row-control, portal and text-selection guards.
Copyright remains with the upstream authors and contributors. The source files
retain AGPL-3.0-only identification and the upstream license remains at
`frontend/public/licenses/Wealthfolio-AGPL-3.0.txt`.

Shared UI primitives and source translation resources are under
`frontend/src/vendor/wealthfolio/`; the UI package metadata declares MIT.
The root upstream AGPL license and corresponding-source notices are retained.
`SOURCE.json` records the exact upstream file paths, original SHA-256 hashes and
adaptation boundaries. Local changes replace platform/Rust adapters, binary
floating-point money and financial-filter persistence, preserving the layouts.
They use exact API strings, local hash routes, appearance-only persistence,
history-safe posting/corrections and explicit unavailable states. The postponed
financial engines are not advertised as working controls. No upstream logo,
photographs or security branding assets are bundled.

New shared-control dependencies use their published licenses: Base UI, TanStack
Table/Virtual, Phosphor React, cmdk, Sonner and Embla Carousel (MIT), date-fns (MIT),
Lucide React (ISC, with the additional notices included by that package), and
tw-animate-css (MIT; Copyright 2025 Wombosvideo).
Copies of package notices are preserved in `frontend/public/licenses/`.
Embla's notice was verified against its official
[v8.6.0 license](https://github.com/davidjerleke/embla-carousel/blob/v8.6.0/LICENSE).
See `docs/HOLDINGS_ACTIVITIES_V014.md` for completed and outstanding migration work.

## v0.14 chart presentation adaptation (unreleased)

`frontend/src/lib/chart-presentation.ts` and
`frontend/src/components/portfolio-value-chart.tsx` adapt curve, area-gradient,
stroke and hover conventions from Wealthfolio pinned commit
`92b4647f74ec51fbbb1a772db4f42ea91060c518`,
`apps/frontend/src/components/history-chart.tsx` (AGPL-3.0-only).
Copyright remains with its authors/contributors; the preserved license is
`frontend/public/licenses/Wealthfolio-AGPL-3.0.txt`. Local data adapters, exact
coordinates and null gaps replace upstream money conversion/null bridging.
The optional ETF showcase generator is original fictional data; it contains no
third-party ETF observations, marks or graphics.

## v0.14 Net Worth source adaptation (unreleased)

Upstream: https://github.com/wealthfolio/wealthfolio, pinned commit
`92b4647f74ec51fbbb1a772db4f42ea91060c518` (inspected November 4, 2026).
Copyright belongs to the Wealthfolio authors and contributors. Adapted files retain
AGPL-3.0-only identification; the license remains in
`frontend/public/licenses/Wealthfolio-AGPL-3.0.txt`.

| Finance Tracker | Upstream under `apps/frontend/src/` |
| --- | --- |
| `frontend/src/components/dashboard-card.tsx` | `components/dashboard-card.tsx` |
| `frontend/src/components/net-worth-overview.tsx`, `frontend/src/pages/wealth.tsx`, `frontend/src/pages/net-worth-v014.css` | `pages/net-worth/net-worth-content.tsx`, `components/{breakdown-table,composition-bar,category-detail-sheet,velocity-card,net-worth-attention}.tsx`, `pages/dashboard/balance.tsx` |
| `frontend/src/components/net-worth-chart.tsx` | `pages/net-worth/net-worth-chart.tsx`, `components/category-trend-chart.tsx` |
| `frontend/src/components/net-worth-investments.tsx` | `pages/holdings/components/allocation-detail-sheet.tsx` |
| `frontend/src/lib/net-worth-view.ts`, `backend/app/net_worth_view.py` | Presentation concepts from `pages/net-worth/components/utils.ts`; financial projections independently implemented with exact arithmetic |
| `frontend/src/lib/net-worth-period.ts` | Interval semantics from `pages/dashboard/use-dashboard-period.ts` and `packages/ui/src/components/financial/interval-selector.tsx` |

Adaptations replace upstream package hooks, Rust commands, floating-point money,
native haptics and persistent financial filters with local API adapters, Decimal/
BigInt projections, explicit unavailable states and URL-based selection. The
application's existing themes, financial methods, navigation and manual-position
workflows remain authoritative. No upstream branding or proprietary graphics are
shipped. Official screenshots are local ignored comparison evidence only. See
`docs/NET_WORTH_V014.md` for scope, deviations and verification. Existing AGPL
corresponding-source obligations continue to apply to the adapted frontend.

## Source Serif 4 appearance option

Source Serif 4 is bundled locally through `@fontsource/source-serif-4` 5.3.1 under
SIL Open Font License 1.1. The unmodified notice is preserved in
`frontend/public/licenses/source-serif-4-OFL.txt`. The app uses Latin normal
400/500/600/700 faces, with no external font requests. Current optional font families and their licenses
are listed below; Public Sans is not bundled.

## Official historical Brazil demo observations

Banco Central do Brasil: SGS 12 daily CDI and SGS 4389 annualized CDI observations,
retrieved November 3, 2026 via the official BCData API. Attribution and public-data
reuse basis: https://www.bcb.gov.br/acessoinformacao/dadosabertos.

Tesouro Nacional / CODIP: _Taxas dos Títulos Ofertados pelo Tesouro Direto_,
retrieved November 3, 2026. Source and filtered Treasury database licensed under
Open Data Commons Open Database License 1.0 (ODbL):
https://opendatacommons.org/licenses/odbl/1-0/.
Source: https://www.tesourotransparente.gov.br/ckan/dataset/taxas-dos-titulos-ofertados-pelo-tesouro-direto.
Preserve attribution and database share-alike obligations. These data are separate
from application code licensing. Source URLs, conventions and raw-response hashes
are retained in `backend/app/demo/observations/brazil-2024-2026.json`.

No B3/Brapi ETF history is bundled or relicensed. Optional authorized private
snapshots remain local and subject to the source provider's terms. Nubank is named
only to identify the modeled hypothetical RDB product; no logos/assets, account
connection or endorsement is claimed.

## Wealthfolio visual adaptation (Phase 1.7)

Upstream: https://github.com/wealthfolio/wealthfolio

Reference version: v3.9.1, commit
`392f272c5b15a4af45dc2ff71dcbec474f47112a`.
Copyright belongs to the Wealthfolio authors and contributors. The upstream
GNU Affero General Public License v3 is preserved verbatim in
[`frontend/public/licenses/Wealthfolio-AGPL-3.0.txt`](frontend/public/licenses/Wealthfolio-AGPL-3.0.txt).

The following files adapt upstream layout, styling, and chart composition and
are identified with `SPDX-License-Identifier: AGPL-3.0-only`:

| Finance Tracker file                         | Upstream reference                                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `frontend/src/components/app-shell.tsx`      | `apps/frontend/src/pages/layouts/navigation/app-sidebar.tsx`, `app-layout.tsx`                          |
| `frontend/src/pages/dashboard.tsx`           | `apps/frontend/src/pages/dashboard/portfolio-page.tsx`, `dashboard-content.tsx`, `accounts-summary.tsx` |
| `frontend/src/components/overview-chart.tsx` | `apps/frontend/src/components/history-chart.tsx`                                                        |
| `frontend/src/application.css`               | `apps/frontend/src/globals.css` and the layout components above                                         |

Changes: Finance Tracker's existing navigation, local API hooks, exact decimal
formatting, normalized chart coordinates, cash-flow reporting, and account-detail
actions replace upstream investment-specific integrations. The frontend adaptations
retain AGPL licensing; the root placeholder copyright notice does not override
these terms. This is not a relicensing of Wealthfolio under Finance Tracker's name.
Any redistribution or network deployment of the combined adapted frontend must
retain the applicable AGPL notices and corresponding-source obligations.

The Phase 1.7 scope above is historical. It must not be read as a statement that
the current application contains no copied components or illustrations: v0.14
copies/adapts frontend components and translation catalogs and retains five goal
cover illustrations, as recorded below. No upstream branding or Rust financial
engine is intentionally shipped. Copyright remains with the respective authors;
adaptation and exact local financial services do not erase upstream obligations.

## JetBrains Mono

Locally bundled through `@fontsource/jetbrains-mono` 5.2.8; no font CDN requests.
Copyright 2020 The JetBrains Mono Project Authors.
Licensed under the SIL Open Font License 1.1; full notice and license:
[`frontend/public/licenses/JetBrains-Mono-OFL.txt`](frontend/public/licenses/JetBrains-Mono-OFL.txt).

## v0.13 reference inspection and additional fonts

Visual/source reference inspected at upstream commit
`d86c20194b4b61ad8133ce820739d5ac83f9045e`: history/performance charts, dashboard-card,
metric-display, font/theme/language selectors, i18n setup and holdings composition.
This pass adds independently implemented exact-string/BigInt chart geometry,
preference controls and authored translations. It does not copy upstream source
components or translation catalogs. Existing adapted files retain the notices above.
This description applies to that historical v0.13 pass; the later v0.14 source
migrations and copied catalogs are documented separately below.
Official screenshots were inspected as references; no upstream branded assets are
bundled in the application. No new project-wide relicensing is asserted.

Additional self-hosted Fontsource packages, all under SIL OFL 1.1 (unmodified full
copyright and license notices are bundled alongside the font assets):

| Family        | Package version | Full notice                                                             |
| ------------- | --------------- | ----------------------------------------------------------------------- |
| Inter         | 5.3.0           | [inter-OFL.txt](frontend/public/licenses/inter-OFL.txt)                 |
| IBM Plex Sans | 5.3.0           | [ibm-plex-sans-OFL.txt](frontend/public/licenses/ibm-plex-sans-OFL.txt) |
| Source Sans 3 | 5.3.1           | [source-sans-3-OFL.txt](frontend/public/licenses/source-sans-3-OFL.txt) |
| DM Sans       | 5.3.0           | [dm-sans-OFL.txt](frontend/public/licenses/dm-sans-OFL.txt)             |

Font licenses do not confer rights to the respective project trademarks. No
external font requests are required. Dependency versions are locked in package-lock.

The expanded v0.13 inspection covers the dashboard/account/holding, net-worth,
spending/events, portfolio-insights, income and save-up source paths mapped in
`docs/WEALTHFOLIO_PARITY_v0.13.md`, at the same revision above. New Life Event,
fixed-income, spending-fact and trajectory services are native implementations;
no upstream Rust/Tauri business engine is bundled. Securo revision
`43d48ffb49cecd538cf6ec67a7d059ac180e567e` was inspected under AGPL-3.0 for its
Treasury adapter/tests; none of its source is copied. Official reference images
are linked for comparison, not redistributed as application graphics. Existing
source notices, AGPL texts and font OFL notices remain intact.

The approved UX redesign also inspects `features/spending/components/spending-tab-content.tsx`
and `budget-line-chart-card.tsx` at that pinned revision. The authored
`frontend/src/components/budget-pace-chart.tsx` adapts the compact 320x110 SVG
geometry and actual/forecast visual separation; `frontend/src/lib/budget-curve.ts`
uses local exact BigInt values and the existing API pace projection. It does not
copy upstream floating-point financial calculations or its historical forecast
model. These adapted visual files retain AGPL-3.0-only attribution.

The Spending Insights stage navigation and Life Events timeline/inline-detail
organization are adapted from the pinned `spending-insights-page.tsx`,
`events-timeline-card.tsx` and `event-detail-panel.tsx` visual structure. Local
`event-timeline.ts` and `event-daily-chart.tsx` are authored for exact local ledger
contracts; no upstream financial calculations or graphics are copied. Applicable
AGPL notices remain in force.

The approved redesign continuation also inspects the pinned Income, Performance,
Portfolio Insights, Net Worth/manual-position and save-up detail layouts. Local
`income-chart.tsx`, `performance-chart.tsx`, `composition-chart.tsx`, `goals.tsx`,
`wealth.tsx` and `ux-redesign.css` adapt their visual organization to Finance
Tracker's APIs and exact display adapters. No reference graphics, branding,
financial records or Rust financial algorithms are bundled. Existing AGPL-3.0-only
and font OFL notices remain applicable; the cached comparison images remain local
reference material rather than application assets.

The Spending Insights continuation also inspects the pinned
`features/spending/components/reports/insights/where-i-am-stage.tsx` and its tests.
Local `spending-position.tsx` and its styles adapt the three-area summary,
cash-flow strip and spending-plan hierarchy to the existing exact budget service.
Source-specific taxonomy, savings destinations and upstream financial algorithms
are not copied. Existing AGPL-3.0-only attribution remains applicable.

The motion layer adapts the shared-selection organization and spring parameters
from `packages/ui/src/components/ui/tabs.tsx` and `animated-toggle-group.tsx`,
at pinned revision `d86c20194b4b61ad8133ce820739d5ac83f9045e`, under AGPL-3.0-only.
Local adapted files are `selection-indicator.tsx` and `lib/motion.ts`; existing
adapted navigation retains its notices. Recharts update timing follows the
reference history/performance chart patterns; local exact financial adapters are
unchanged. No branded graphics or financial algorithms are copied.

Motion for React and its Motion runtime dependencies use the MIT license.
The copyright/license notice is preserved in
[motion-MIT.txt](frontend/public/licenses/motion-MIT.txt) and the Framer runtime's
[framer-motion-MIT.txt](frontend/public/licenses/framer-motion-MIT.txt). Dependency versions
are recorded in the frontend lockfile.

Pluggy connection UI uses the official `react-pluggy-connect` (2.12.0) and
`pluggy-connect-sdk` (2.14.2) packages, declared MIT in their published package
metadata. Authors: Tomas Milar / Pluggy Engineering. Package source/types and
official API documentation were inspected; no provider backend source or graphics
were copied into Finance Tracker. The hosted bank-authentication UI is opened only
by explicit user action. Published package references:
https://www.npmjs.com/package/react-pluggy-connect and
https://www.npmjs.com/package/pluggy-connect-sdk.

The image-free Goals refinement adapts the title/percentage, saved/remaining rows
and segmented progress organization of `features/goals/components/goal-card.tsx`
and the three-column grid of `goals-dashboard-page.tsx`, at pinned revision
`d86c20194b4b61ad8133ce820739d5ac83f9045e`, under AGPL-3.0-only. Adapted local files
are `goal-progress.tsx` and `pages/goals.css`. No cover images, quote copy, branding,
upstream monetary Number arithmetic or financial forecasting is copied.

Additional self-hosted Fontsource font families are Manrope, Public Sans, Outfit
and Merriweather. Their published SIL Open Font License notices are preserved
unchanged in `frontend/public/licenses/manrope-OFL.txt`, `public-sans-OFL.txt`,
`outfit-OFL.txt` and `merriweather-OFL.txt`. Existing family notices remain intact.
The application bundles Latin 400/500/600/700 faces; no external font CDN is used.

### Additional locally bundled appearance fonts (unreleased)

Geist (`@fontsource/geist`) is bundled under SIL Open Font License 1.1;
see `frontend/public/licenses/geist-OFL.txt`. Manrope, IBM Plex Sans and DM Sans
are restored as user-selectable families under their preserved OFL notices.
All fonts are served locally. Existing adapted-source attribution is unchanged.

### v0.14 Portfolio Insights (unreleased)

The AGPL-3.0-only adaptations in `portfolio-insights-overview.tsx`,
`insights-dashboard.tsx`, `portfolio-insights.css`, `lib/portfolio-insights.ts` and
`lib/insights-layout.ts` reference Wealthfolio revision
`92b4647f74ec51fbbb1a772db4f42ea91060c518`: Insights `overview-page`, `value-strip`,
`insights-dashboard`, `insights-layout`, `portfolio-explorer`,
`holdings-highlight-cards`, and Holdings `drillable-donut-chart`,
`composition-chart` plus the shared `donut-chart`. Exact local API adapters replace
upstream monetary Number calculations and platform/settings dependencies. No Rust
financial engine, branding, proprietary graphics or reference screenshots are bundled.

`react-grid-layout` 2.2.4 and its `react-resizable` and `react-draggable` runtime
dependencies use MIT licenses. Preserved notices are in
`frontend/public/licenses/react-grid-layout-MIT.txt`, `react-resizable-MIT.txt` and
`react-draggable-MIT.txt`. Versions are locked in `frontend/package-lock.json`.

### v0.14 Investment Income (unreleased)

`components/income-dashboard.tsx`, `income-currency-mix.tsx`, `income-chart.tsx`, `income-dashboard.css` and
`lib/income-dashboard.ts` adapt the AGPL-3.0-only Income page/history-chart structures
and interactions from Wealthfolio `92b4647f74ec51fbbb1a772db4f42ea91060c518`.
The local adapters retain exact decimal-string values, original currencies and
existing investment activities. Brazilian accrual presentation reuses Finance
Tracker's own contract services and does not port an upstream financial engine.
No reference screenshots, branding or proprietary assets are shipped in the app.

### v0.14 Spending, Budgets and Life Events (unreleased)

`frontend/src/features/spending/` adapts the Spending dashboard, full supported
Budget editor, category list/treemap/table, period/date selectors, three Insights
stages, money-flow Sankey, event timeline/calendar and event detail components
from Wealthfolio commit `92b4647f74ec51fbbb1a772db4f42ea91060c518` (AGPL-3.0-only).
The original source files and SHA-256 hashes are recorded in
`frontend/src/vendor/wealthfolio/SOURCE.json`, under `spending_files`.

Finance Tracker adapters replace provider hooks, platform navigation and monetary
Number calculations with its existing FastAPI APIs, local hash routes and exact
decimal strings/BigInt arithmetic. Source chart coordinates are dimensionless;
labels retain exact original amounts. Category hierarchy, group buffers/rollover,
planned income targets and manually entered starting balances are intentionally
excluded according to the approved scope. Financial posting remains local.
No Rust services, AI features, proprietary assets, branding or reference screenshots
are shipped with the application.

The source Calendar, MonthYearPicker and Item shared UI components retain their
upstream package's MIT notices. The added `react-day-picker` dependency and
`@date-fns/tz` transitive dependency are MIT licensed; copies are preserved in
`frontend/public/licenses/react-day-picker-LICENSE.txt` and
`frontend/public/licenses/date-fns-tz-LICENSE.txt`. Exact versions are locked.

### v0.14 Goals and Savings Planner (unreleased)

`frontend/src/features/goals/` adapts the Goals dashboard/cards, template creation,
detail/edit/funding workspace, Save Up detail/projection/milestones and lever inputs
from Wealthfolio `92b4647f74ec51fbbb1a772db4f42ea91060c518` (AGPL-3.0-only).
The `wfGoals` locale resources retain upstream text, with supported local aliases.
The source inventory and SHA-256 hashes are under `goals_files` in
`frontend/src/vendor/wealthfolio/SOURCE.json`. Local API/exact-money adapters and
zero-return planning replace upstream financial and platform dependencies.

Five upstream illustrations (car, home, education, wedding, custom_save_up) were
previously evaluated for goal covers. They are now EXCLUDED from the distribution
pending independent rights clearance. Goal cards use neutral surfaces. Their
original paths/hashes remain in SOURCE.json and the historical inventory as
provenance evidence, not as a claim that the images are bundled or cleared.
No retirement/Risk Lab or return-forecasting engine is copied.

Shared DatePickerInput, Calendar RAC, DateField RAC and Textarea source retains
the UI package's MIT license. `react-aria-components`, `@internationalized/date`
and their Adobe React Aria/Stately/Internationalized runtime packages are
Apache-2.0 licensed. Preserved license copies are in
`frontend/public/licenses/react-aria-components-LICENSE.txt` and
`internationalized-date-LICENSE.txt`; exact versions are locked. Existing locally
served Merriweather font files retain their OFL notice. No font CDN is used.


### v0.14 Performance, Portfolio Insights and allocation targets (unreleased)

The source chart leaves, comparison/chart-card and metric-strip structures,
Top Movers card/rows, treemap palette, target rails and default grid proportions
adapt Wealthfolio commit `92b4647f74ec51fbbb1a772db4f42ea91060c518`
(AGPL-3.0-only). Original paths, SHA-256 fingerprints, adaptation notes and inspected
backend conventions are recorded in
`frontend/src/vendor/wealthfolio/SOURCE.json` (`performance_insights_files`).
The unchanged, uncompiled allocation worksheet UI is retained under
`frontend/src/vendor/wealthfolio/reference/` for the explicitly postponed Stage B;
it is not routed or represented as functioning software.

The shared `packages/ui/src/components/ui/chart.tsx` source declares MIT, with the
existing package license retained in `frontend/public/licenses`. Its context,
tooltip and legend are adapted to local exact-string formatting. Source application
translations retain attribution in the same inventory. No branding, market data or
new proprietary graphics are copied. Local adapters preserve Decimal/string money,
null gaps, reduced motion, date coverage and existing FastAPI/SQLite authority.

### v0.14 Investments and Net Worth dashboard completion

Source remains pinned to `92b4647f74ec51fbbb1a772db4f42ea91060c518`.
`frontend/src/features/dashboard/` adapts dashboard content, balance, account rows,
Top Holdings, savings goals, history chart, Momentum and category sheet/trend.
`history-chart-scale.ts` retains the source algorithm unchanged, applied only to
dimensionless coordinates. The Net Worth breakdown uses the source responsive
subgrid tracks and keyboard/hover behavior. The existing AGPL application and MIT
shared-UI licenses apply. The period selector uses the licensed shared animated
toggle/calendar. Original paths and SHA256 fingerprints are recorded under
`dashboard_files` in `frontend/src/vendor/wealthfolio/SOURCE.json`.

Exact local strings, read-only FastAPI projections, unavailable values and URL
filters replace floating-point money and platform hooks. Monetary NumberFlow
interpolation is deliberately replaced by exact formatted labels. Native haptics,
device sync and broker synchronization are not copied. No branding, proprietary
assets or restricted price data are included.

### v0.14 Settings and configuration

Settings layout/sidebar/header, control grouping, account/portfolio/security list
composition, Spending overview and Export/Backup/About structure are adapted from
the pinned `92b4647f74ec51fbbb1a772db4f42ea91060c518` application source under
AGPL-3.0-only. Original files and fingerprints appear under `settings_files` in
`frontend/src/vendor/wealthfolio/SOURCE.json`; adapted files identify their sources.
Existing bundled MIT UI and OFL font notices remain unchanged. The official Settings
screenshot is ignored local comparison evidence, never a shipped product asset.
Local exact-money adapters, metadata groups, export whitelist and maintenance-only
backup service are Finance Tracker implementations, not copied Rust services. No
branding, cloud services, AI modules or proprietary assets are included.

### Historical pre-approval distribution review

The application audit verified all 233 original-source fingerprints against pinned
revision `92b4647f74ec51fbbb1a772db4f42ea91060c518`. This is a provenance check,
not a legal compliance certification. The root all-rights-reserved notice does not
settle redistribution of the adapted AGPL frontend. The user requested a separate
licensing review before publication; no license grant or notice is changed here.
See [the release gate](docs/AUDIT_V014.md#licensing-release-gate).

### Licensing investigation, 2026-11-10

The [compatibility review](docs/LICENSING_COMPATIBILITY_V014.md) and
[file-level inventory](docs/licensing/SOURCE_FILE_INVENTORY.md) distinguish
copied/adapted application source, UI-package metadata, original-code candidates,
retained references, fonts and illustrations. The source manifest is an evidence
record, not a blanket license grant or proof of independent authorship.
At the investigation snapshot, the UI-specific complete notice, illustration
rights and combined-work grant/source access were open questions. The current
grant above, preserved UI metadata/standard MIT text and image exclusion address
the approved source-only distribution. The earlier investigation is retained;
it does not override the current owner-approved grant or certify unknown rights.

The backend directly imports `ofxtools` 1.1.1, copyright Christopher Singley.
Its installed metadata declares GPL-3.0-only; its actual release license text
permits GPL version 3 or later. Both pieces of evidence are preserved without
rewriting upstream terms. The unchanged release notice is at
`frontend/public/licenses/ofxtools-COPYRIGHT.txt`; the standard GPLv3 text is at
`frontend/public/licenses/GPL-3.0.txt`. The latter was obtained from the official
SPDX license-text mirror after the GNU direct download timed out.
The [release-source license](https://github.com/csingley/ofxtools/blob/894cfe94fa5d0820c24c9435687b296895a36f81/LICENSE)
and the installed notice match. This dependency requires a combined-backend
licensing review independently of the frontend/backend HTTP boundary. Its source
and license must remain available as required by the applicable GPL terms.
