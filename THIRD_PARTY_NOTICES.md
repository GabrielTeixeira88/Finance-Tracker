# Third-party attribution

## Source Serif 4 appearance option

Source Serif 4 is bundled locally through `@fontsource/source-serif-4` 5.3.1 under
SIL Open Font License 1.1. The unmodified notice is preserved in
`frontend/public/licenses/source-serif-4-OFL.txt`. The app uses Latin normal
400/500/600/700 faces, with no external font requests. Manrope, IBM Plex Sans,
Public Sans and DM Sans are no longer bundled; their earlier attribution/license
notices remain below for the historical adaptations and captures.

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

No upstream logos, product marks, illustrations, investment engines, or complete
source components were copied into the application. Product documentation and
screenshots now show Finance Tracker only; source attribution is retained here.

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
