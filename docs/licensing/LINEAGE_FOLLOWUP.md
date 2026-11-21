# Source lineage follow-up

> **Historical pre-approval evidence.** The investigation and results below are
> retained as recorded, including old grants, hashes and pending decisions.
> On 2026-11-10 the owner approved AGPL-3.0-only for original work and accepted the
> documented development-only minimatch risk for this merge. The current decision,
> asset exclusions and source-access implementation are in
> [v0.14 finalization](../FINALIZATION_V014.md). No local tests or audits were rerun.

Review date: 2026-11-10. Every upstream fingerprint in the manifest matched the pinned checkout. That does not prove a complete file-to-file adaptation map.

## Headers without exact manifest mapping

These 30 files declare AGPL adaptation but do not have an exact local-to-upstream mapping in the fingerprint manifest. Their current headers/notices remain evidence; this is not a finding that they have no attribution. Verify the precise source paths, adaptation scope and relevant modification notices before release.

| Local file | Existing source header |
|---|---|
| `frontend/src/application.css` |  |
| `frontend/src/components/app-shell.tsx` |  |
| `frontend/src/components/budget-pace-chart.tsx` |  |
| `frontend/src/components/income-chart.tsx` | // Adapted from Wealthfolio 92b4647 pages/income/income-history-chart.tsx. |
| `frontend/src/components/income-currency-mix.tsx` | // Adapted from Wealthfolio 92b4647 income-page.tsx currency breakdown. |
| `frontend/src/components/income-dashboard.css` | * Source-adapted Wealthfolio 92b4647 Income card/chart geometry. */ |
| `frontend/src/components/income-dashboard.tsx` | // Adapted from Wealthfolio 92b4647 pages/income/income-page.tsx. |
| `frontend/src/components/insights-dashboard.tsx` | // Adapted from Wealthfolio 92b4647 insights-dashboard.tsx, with workspace appearance |
| `frontend/src/components/overview-chart.tsx` |  |
| `frontend/src/components/portfolio-insights-overview.tsx` | // Adapted from Wealthfolio 92b4647 overview-page, value-strip, portfolio-explorer, |
| `frontend/src/components/portfolio-insights.css` | * Source-adapted Wealthfolio 92b4647 Insights widget geometry; local semantic tokens. */ |
| `frontend/src/components/selection-indicator.tsx` | // Adapted from pinned Wealthfolio tabs.tsx / animated-toggle-group.tsx. |
| `frontend/src/features/activities/investment-activities.tsx` |  |
| `frontend/src/features/activities/spending/spending-table.tsx` | // Source row/card/header composition from Wealthfolio 92b4647 spending-transactions-tab.tsx. |
| `frontend/src/features/holdings/holdings-page.tsx` | // HoldingsPage composition adapted from Wealthfolio 92b4647 holdings-page.tsx. |
| `frontend/src/features/holdings/manual-asset-profile.tsx` | // Adapted layout: Wealthfolio 92b4647 asset-profile-page.tsx and alternative-asset-content.tsx. |
| `frontend/src/features/settings/exports.tsx` | // Adapted from Wealthfolio 92b4647 settings/exports/{exports-page,exports-form,backup-restore-form}.tsx. |
| `frontend/src/features/settings/general.tsx` | // Adapted from Wealthfolio 92b4647 settings/general/{general-page,currency-settings,language-region-settings}.tsx. |
| `frontend/src/features/settings/groups.tsx` | // Adapted from Wealthfolio 92b4647 settings/portfolios/portfolios-page.tsx. |
| `frontend/src/features/settings/securities.tsx` | // Adapted from Wealthfolio 92b4647 settings/asset/assets-page.tsx; existing local security editors are reused. |
| `frontend/src/features/settings/settings-layout.tsx` | // Adapted from Wealthfolio 92b4647 settings-layout.tsx, sidebar-nav.tsx and settings-header.tsx. |
| `frontend/src/features/settings/settings-page.tsx` | // Source hierarchy adapted from Wealthfolio 92b4647 pages/settings; local APIs remain authoritative. |
| `frontend/src/lib/income-dashboard.ts` | // Adapted from Wealthfolio 92b4647 income-page / income-history-chart. |
| `frontend/src/lib/insights-layout.ts` | // Adapted from Wealthfolio 92b4647 insights-layout.ts: responsive plain-data layout. |
| `frontend/src/lib/motion.ts` | // Visual spring adapted from the pinned licensed reference tab/toggle patterns. |
| `frontend/src/lib/net-worth-view.ts` | // Category organization adapted from Wealthfolio 92b4647 Net Worth components. |
| `frontend/src/lib/portfolio-insights.ts` | // Source: Wealthfolio 92b4647 allocation-derivations / portfolio-explorer. |
| `frontend/src/pages/dashboard.tsx` |  |
| `frontend/src/pages/net-worth-v014.css` | Adapted from Wealthfolio 92b4647 Net Worth component utility classes. |
| `frontend/src/pages/wealth.tsx` | // Net Worth composition adapted from Wealthfolio 92b4647; local posting/detail workflows retained. |

## Source fingerprints without a resolved local counterpart

The following 29 records include consolidated Settings references and intentionally inspected-only algorithms. They must not all be described as copied files. In particular, inspected Rust contracts/calculations are not evidence that Rust source was copied into the Python backend.

| Group / key | Original path | Stated use |
|---|---|---|
| `application_files/related_sources` | `apps/frontend/src/pages/account/account-metrics.tsx` |  |
| `application_files/related_sources` | `apps/frontend/src/pages/asset/quote-history-toolbar.tsx` |  |
| `performance_insights_files/reference/composition-chart` | `apps/frontend/src/pages/holdings/components/composition-chart.tsx` | source geometry and return-color conventions adapted in existing overview |
| `performance_insights_files/reference/insights-layout` | `apps/frontend/src/pages/insights/overview/insights-layout.ts` | 9/3 composition/targets and 6/6 highlights for new/default layouts; saved geometry retained |
| `performance_insights_files/reference/allocation-overview` | `apps/frontend/src/pages/allocation-targets/components/overview-tab.tsx` | inspected; exact local drift service and read-only detail table |
| `performance_insights_files/reference/allocation-targets-tab` | `apps/frontend/src/pages/allocation-targets/components/targets-tab.tsx` | inspected; local flat classification input adaptation |
| `performance_insights_files/reference/allocation-worksheet` | `apps/frontend/src/pages/allocation-targets/components/allocation-worksheet-tab.tsx` | inspected and retained uncompiled; Stage B postponed |
| `performance_insights_files/reference/measure` | `crates/portfolio-engine/src/measure.rs` | conventions inspected only; Python Decimal implementation, not Rust copying |
| `performance_insights_files/reference/allocation-model` | `crates/core/src/portfolio/allocation_targets/model.rs` | inspected band conventions only |
| `performance_insights_files/reference/allocation-drift` | `crates/core/src/portfolio/allocation_targets/drift_service.rs` | inspected exact band conventions only |
| `settings_files/settings-layout.tsx` | `apps/frontend/src/pages/settings/settings-layout.tsx` | Settings layout/control composition adapted; local APIs, exact financial data, supported capabilities and web lifecycle replace upstream dependencies |
| `settings_files/sidebar-nav.tsx` | `apps/frontend/src/pages/settings/sidebar-nav.tsx` | Settings layout/control composition adapted; local APIs, exact financial data, supported capabilities and web lifecycle replace upstream dependencies |
| `settings_files/settings-header.tsx` | `apps/frontend/src/pages/settings/settings-header.tsx` | Settings layout/control composition adapted; local APIs, exact financial data, supported capabilities and web lifecycle replace upstream dependencies |
| `settings_files/general/general-page.tsx` | `apps/frontend/src/pages/settings/general/general-page.tsx` | Settings layout/control composition adapted; local APIs, exact financial data, supported capabilities and web lifecycle replace upstream dependencies |
| `settings_files/general/currency-settings.tsx` | `apps/frontend/src/pages/settings/general/currency-settings.tsx` | Settings layout/control composition adapted; local APIs, exact financial data, supported capabilities and web lifecycle replace upstream dependencies |
| `settings_files/general/language-region-settings.tsx` | `apps/frontend/src/pages/settings/general/language-region-settings.tsx` | Settings layout/control composition adapted; local APIs, exact financial data, supported capabilities and web lifecycle replace upstream dependencies |
| `settings_files/appearance/appearance-page.tsx` | `apps/frontend/src/pages/settings/appearance/appearance-page.tsx` | Settings layout/control composition adapted; local APIs, exact financial data, supported capabilities and web lifecycle replace upstream dependencies |
| `settings_files/appearance/appearance-form.tsx` | `apps/frontend/src/pages/settings/appearance/appearance-form.tsx` | Settings layout/control composition adapted; local APIs, exact financial data, supported capabilities and web lifecycle replace upstream dependencies |
| `settings_files/accounts/accounts-page.tsx` | `apps/frontend/src/pages/settings/accounts/accounts-page.tsx` | Settings layout/control composition adapted; local APIs, exact financial data, supported capabilities and web lifecycle replace upstream dependencies |
| `settings_files/accounts/components/account-item.tsx` | `apps/frontend/src/pages/settings/accounts/components/account-item.tsx` | Settings layout/control composition adapted; local APIs, exact financial data, supported capabilities and web lifecycle replace upstream dependencies |
| `settings_files/portfolios/portfolios-page.tsx` | `apps/frontend/src/pages/settings/portfolios/portfolios-page.tsx` | Settings layout/control composition adapted; local APIs, exact financial data, supported capabilities and web lifecycle replace upstream dependencies |
| `settings_files/taxonomies/taxonomies-page.tsx` | `apps/frontend/src/pages/settings/taxonomies/taxonomies-page.tsx` | Settings layout/control composition adapted; local APIs, exact financial data, supported capabilities and web lifecycle replace upstream dependencies |
| `settings_files/spending/spending-settings-page.tsx` | `apps/frontend/src/pages/settings/spending/spending-settings-page.tsx` | Settings layout/control composition adapted; local APIs, exact financial data, supported capabilities and web lifecycle replace upstream dependencies |
| `settings_files/spending/components/overview-card.tsx` | `apps/frontend/src/pages/settings/spending/components/overview-card.tsx` | Settings layout/control composition adapted; local APIs, exact financial data, supported capabilities and web lifecycle replace upstream dependencies |
| `settings_files/spending/rules/spending-rules-page.tsx` | `apps/frontend/src/pages/settings/spending/rules/spending-rules-page.tsx` | Settings layout/control composition adapted; local APIs, exact financial data, supported capabilities and web lifecycle replace upstream dependencies |
| `settings_files/exports/exports-page.tsx` | `apps/frontend/src/pages/settings/exports/exports-page.tsx` | Settings layout/control composition adapted; local APIs, exact financial data, supported capabilities and web lifecycle replace upstream dependencies |
| `settings_files/exports/exports-form.tsx` | `apps/frontend/src/pages/settings/exports/exports-form.tsx` | Settings layout/control composition adapted; local APIs, exact financial data, supported capabilities and web lifecycle replace upstream dependencies |
| `settings_files/exports/backup-restore-form.tsx` | `apps/frontend/src/pages/settings/exports/backup-restore-form.tsx` | Settings layout/control composition adapted; local APIs, exact financial data, supported capabilities and web lifecycle replace upstream dependencies |
| `settings_files/about/about-page.tsx` | `apps/frontend/src/pages/settings/about/about-page.tsx` | Settings layout/control composition adapted; local APIs, exact financial data, supported capabilities and web lifecycle replace upstream dependencies |

## Finalization scope

The 30 mapping gaps above retain source-header/revision evidence; they are not
30 findings of prohibited or unlicensed source. The broader manifest contains
consolidated Settings mappings and inspected-only backend references, not a
claim that Rust code was copied. Preserve precise mappings as maintenance work.
The current owner grant, upstream notices and retained evidence apply; no missing
author or license permission is invented. See ../FINALIZATION_V014.md.
