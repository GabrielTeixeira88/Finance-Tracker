# Third-party attribution

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
