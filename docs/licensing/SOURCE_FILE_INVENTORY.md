# Source-file licensing inventory

> **Historical pre-approval evidence.** The investigation and results below are
> retained as recorded, including old grants, hashes and pending decisions.
> On 2026-11-10 the owner approved AGPL-3.0-only for original work and accepted the
> documented development-only minimatch risk for this merge. The current decision,
> asset exclusions and source-access implementation are in
> [v0.14 finalization](../FINALIZATION_V014.md). No local tests or audits were rerun.

Review: 2026-11-10. No license grants are made by this inventory.

See [compatibility review](../LICENSING_COMPATIBILITY_V014.md). JSON contains file hashes, every AGPL/SPDX match with line numbers, source paths and unresolved mapping evidence.

**Original-candidate means no copy evidence was found, not proven independent authorship.** Root original work remains All Rights Reserved. Original frontend code integrated with AGPL-derived components is not thereby exempt from whole-work requirements.

| Classification | Files |
|---|---|
| AGPL_declared_adaptation | 144 |
| AGPL_manifest_derived | 38 |
| documentation_or_license_record | 82 |
| historical_synthetic_screenshot | 22 |
| market_data_separate_terms | 2 |
| original_candidate_no_upstream_copy_evidence | 523 |
| third_party_notice_or_license_text | 35 |
| upstream_UI_MIT_metadata_notice_gap | 40 |
| upstream_asset_rights_clearance | 5 |
| upstream_reference_or_mixed_origin_review | 8 |

## File-by-file inventory

| File | Evidence classification | Declared SPDX / upstream evidence | Review |
|---|---|---|---|
| `.editorconfig` | original_candidate_no_upstream_copy_evidence |  |  |
| `.env.example` | original_candidate_no_upstream_copy_evidence |  |  |
| `.gitattributes` | original_candidate_no_upstream_copy_evidence |  |  |
| `.github/workflows/ci.yml` | original_candidate_no_upstream_copy_evidence |  |  |
| `.gitignore` | original_candidate_no_upstream_copy_evidence |  |  |
| `AGENTS.md` | documentation_or_license_record |  |  |
| `CHANGELOG.md` | documentation_or_license_record |  |  |
| `GLOSSARY.md` | documentation_or_license_record |  |  |
| `LICENSE` | documentation_or_license_record |  |  |
| `README.md` | documentation_or_license_record |  |  |
| `THIRD_PARTY_NOTICES.md` | documentation_or_license_record | AGPL-3.0-only; from Wealthfolio revision `92b4647f74ec51fbbb1a772db4f42ea91060c518`: |  |
| `backend/.dockerignore` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/.python-version` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/Dockerfile` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/alembic.ini` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/__init__.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/_version.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/account_workspace.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/activity_workspace.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/allocation_models.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/allocation_routes.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/allocation_targets.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/analytics_models.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/analytics_routes.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/automation_routes.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/automation_schemas.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/backup_routes.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/budget_routes.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/budget_schemas.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/budgets.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/config.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/dashboard_view.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/database.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/demo/__init__.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/demo/__main__.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/demo/app.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/demo/audit_content.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/demo/brazil_household.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/demo/dashboard_content.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/demo/etf_showcase.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/demo/fixed_income.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/demo/goal_content.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/demo/holdings_activities.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/demo/income_portfolio.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/demo/income_showcase.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/demo/life_events.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/demo/observations/README.md` | market_data_separate_terms |  |  |
| `backend/app/demo/observations/brazil-2024-2026.json` | market_data_separate_terms |  |  |
| `backend/app/demo/performance_content.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/demo/prepare_real_market.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/demo/real_market.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/demo/real_market_report.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/demo/real_market_snapshot.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/demo/runtime.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/demo/scenarios.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/demo/seed.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/demo/settings_content.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/demo/spending_content.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/demo/unified.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/demo/verify_real_market.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/error_codes.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/fixed_income.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/fixed_income_calendar.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/fixed_income_models.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/fixed_income_reporting.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/fixed_income_routes.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/fixed_income_schemas.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/gmail_credentials.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/gmail_models.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/gmail_parsers.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/gmail_provider.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/gmail_routes.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/gmail_scheduler.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/gmail_service.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/goal_models.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/goal_trajectory.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/goal_workspace.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/historical_cdi.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/history.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/holdings_workspace.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/income_accrual.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/income_reporting.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/ingestion.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/ingestion_matching.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/ingestion_parsers.py` | original_candidate_no_upstream_copy_evidence |  | Original parser imports GPL-covered ofxtools in process; combined-backend distribution review |
| `backend/app/ingestion_routes.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/ingestion_schemas.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/investment_analytics.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/investment_import_routes.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/investment_imports.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/investment_routes.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/investment_schemas.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/investments.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/ledger.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/life_event_models.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/life_event_routes.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/life_events.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/local_backups.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/main.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/market_models.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/market_providers.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/market_routes.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/market_scheduler.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/market_sync.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/market_valuation.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/models.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/net_worth_view.py` | upstream_reference_or_mixed_origin_review | AGPL-3.0-only; Presentation concepts adapted from Wealthfolio 92b4647, Net Worth components/utils.ts. | Absent header/manifest is not proof of original authorship; inspect cited expression |
| `backend/app/payee_learning.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/performance_math.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/performance_risk.py` | upstream_reference_or_mixed_origin_review | ; Reference conventions: pinned Wealthfolio portfolio-engine/measure.rs volatility | Absent header/manifest is not proof of original authorship; inspect cited expression |
| `backend/app/pluggy_models.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/pluggy_provider.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/pluggy_routes.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/pluggy_service.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/reconciliation.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/reconciliation_models.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/reconciliation_routes.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/routes.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/rules.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/schedules.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/schemas.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/seed.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/seed_analytics_demo.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/seed_automation.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/seed_demo.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/seed_investment_demo.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/seed_market_demo.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/seed_spending_demo.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/seed_wealth_demo.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/settings_models.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/settings_routes.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/spending.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/spending_appearance.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/spending_insights.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/spending_workspace.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/storage_types.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/transaction_metadata.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/wealth.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/wealth_models.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/app/wealth_routes.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/migrations/env.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/migrations/script.py.mako` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/migrations/versions/sqlite_0001.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/migrations/versions/sqlite_0002.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/migrations/versions/sqlite_0003.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/migrations/versions/sqlite_0004_transaction_automation.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/migrations/versions/sqlite_0005_local_ingestion_provenance.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/migrations/versions/sqlite_0006_monthly_budgets_and_explicit_refunds.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/migrations/versions/sqlite_0007_investment_activities_assets_and_manual_.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/migrations/versions/sqlite_0008_market_data.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/migrations/versions/sqlite_0009_analytics_classification.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/migrations/versions/sqlite_0010_gmail_ingestion_operational_state_and_.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/migrations/versions/sqlite_0011_auditable_source_matching_and_statement_.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/migrations/versions/sqlite_0012_manual_wealth_observations_and_goals.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/migrations/versions/sqlite_0013_optional_debt_terms.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/migrations/versions/sqlite_0014_fixed_income_contracts_and_dated_.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/migrations/versions/sqlite_0015_life_events.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/migrations/versions/sqlite_0016_pluggy_local_read_only_evidence_and_.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/migrations/versions/sqlite_0017_historical_demo.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/migrations/versions/sqlite_0018_classification_appearance.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/migrations/versions/sqlite_0019_goal_plans.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/migrations/versions/sqlite_0020_allocation_targets.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/migrations/versions/sqlite_0021_settings_groups.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/migrations_legacy/README.md` | documentation_or_license_record |  |  |
| `backend/migrations_legacy/postgresql/0001_foundation.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/migrations_legacy/postgresql/ee7da7580aa0_phase1_ledger.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/pyproject.toml` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/conftest.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/fixtures/synthetic/README.md` | documentation_or_license_record |  |  |
| `backend/tests/fixtures/synthetic/bank-sgml.ofx` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/fixtures/synthetic/bank-xml.ofx` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/fixtures/synthetic/br-bom.csv` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/fixtures/synthetic/brokerage.csv` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/fixtures/synthetic/card.ofx` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/fixtures/synthetic/debit-credit.csv` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/fixtures/synthetic/legacy.csv` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/fixtures/synthetic/repeated-fitid.ofx` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/fixtures/synthetic/review-workflow.csv` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/fixtures/synthetic/us.csv` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_account_workspace.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_activity_workspace.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_allocation_targets.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_analytics_migration_demo.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_analytics_scale.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_audit_demo.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_automation.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_automation_migration.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_budget_migration_demo.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_budgets.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_ci_audit.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_config.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_dashboard_view.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_demo_workspace.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_error_codes.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_etf_showcase.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_fixed_income.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_gmail.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_gmail_transport.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_goal_demo_v014.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_goal_migration.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_goal_trajectory.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_goal_workspace.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_health.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_history_demo.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_holdings_workspace.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_income_portfolio.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_income_showcase.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_ingestion.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_ingestion_audit.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_ingestion_migration.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_ingestion_safety.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_investment_analytics.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_investment_income_v014.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_investment_migration_demo.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_investments.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_ledger.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_life_events.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_local_backups.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_market_data.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_market_migration_demo.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_market_release.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_market_transport.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_net_worth_view.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_performance_demo_v014.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_performance_math.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_performance_risk.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_pluggy.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_portfolio_insights.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_real_market_demo.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_reconciliation.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_release_version.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_settings_workspace.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_spending_demo_v014.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_spending_insights.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_spending_series.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_spending_workspace.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_sqlite.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_transaction_intelligence.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_unified_demo.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_wealth.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_wealth_integrity.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_wealth_migration.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/tests/test_wealth_release.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `backend/uv.lock` | original_candidate_no_upstream_copy_evidence |  |  |
| `data/.gitkeep` | original_candidate_no_upstream_copy_evidence |  |  |
| `docker-compose.yml` | original_candidate_no_upstream_copy_evidence |  |  |
| `docs/APPEARANCE_AND_LOCALIZATION.md` | documentation_or_license_record |  |  |
| `docs/AUDIT_V014.md` | documentation_or_license_record |  |  |
| `docs/BUDGETS.md` | documentation_or_license_record |  |  |
| `docs/CHART_PRESENTATION.md` | documentation_or_license_record |  |  |
| `docs/CI.md` | documentation_or_license_record |  |  |
| `docs/COMPLIANCE_SECURITY_V014.md` | documentation_or_license_record |  |  |
| `docs/DASHBOARD_MIGRATION_V014.md` | documentation_or_license_record |  |  |
| `docs/DATA_MODEL.md` | documentation_or_license_record |  |  |
| `docs/DEMO.md` | documentation_or_license_record |  |  |
| `docs/DEMO_DEPLOYMENT.md` | documentation_or_license_record |  |  |
| `docs/DEMO_READINESS.md` | documentation_or_license_record |  |  |
| `docs/DEPENDENCY_SECURITY_V014.md` | documentation_or_license_record |  |  |
| `docs/ETF_SHOWCASE.md` | documentation_or_license_record |  |  |
| `docs/FIXED_INCOME.md` | documentation_or_license_record |  |  |
| `docs/FRONTEND_V014_WORKFLOW.md` | documentation_or_license_record | ; Reference baseline: Wealthfolio commit |  |
| `docs/GMAIL.md` | documentation_or_license_record |  |  |
| `docs/GOALS_V014.md` | documentation_or_license_record |  |  |
| `docs/HOLDINGS_ACTIVITIES_V014.md` | documentation_or_license_record |  |  |
| `docs/IMPORTS.md` | documentation_or_license_record |  |  |
| `docs/INCOME_V014.md` | documentation_or_license_record | ; Pinned source: Wealthfolio [`92b4647f74ec51fbbb1a772db4f42ea91060c518`](https://github.com/wealthfolio/wealthfolio/tree/92b4647f74ec51fbbb1a772db4f42ea91060c518), |  |
| `docs/INVESTMENTS.md` | documentation_or_license_record |  |  |
| `docs/INVESTMENT_ANALYTICS.md` | documentation_or_license_record |  |  |
| `docs/LICENSING_COMPATIBILITY_V014.md` | documentation_or_license_record |  |  |
| `docs/LIFE_EVENTS.md` | documentation_or_license_record |  |  |
| `docs/MARKET_DATA.md` | documentation_or_license_record |  |  |
| `docs/MOTION.md` | documentation_or_license_record |  |  |
| `docs/NET_WORTH_GOALS.md` | documentation_or_license_record |  |  |
| `docs/NET_WORTH_V014.md` | documentation_or_license_record |  |  |
| `docs/PERFORMANCE_INSIGHTS_V014.md` | documentation_or_license_record |  |  |
| `docs/PHASE_1_7_VISUAL_REVIEW.md` | documentation_or_license_record |  |  |
| `docs/PLUGGY.md` | documentation_or_license_record |  |  |
| `docs/PORTFOLIO_INSIGHTS_V014.md` | documentation_or_license_record | ; Pinned Wealthfolio revision: `92b4647f74ec51fbbb1a772db4f42ea91060c518`. |  |
| `docs/PORTFOLIO_WALKTHROUGH.md` | documentation_or_license_record |  |  |
| `docs/PRODUCT_SPEC.md` | documentation_or_license_record |  |  |
| `docs/REAL_MARKET_DEMO.md` | documentation_or_license_record |  |  |
| `docs/RECONCILIATION.md` | documentation_or_license_record |  |  |
| `docs/RELEASE_0_10_0.md` | documentation_or_license_record |  |  |
| `docs/RELEASE_0_11_0.md` | documentation_or_license_record |  |  |
| `docs/RELEASE_0_12_0.md` | documentation_or_license_record |  |  |
| `docs/RELEASE_0_13_0.md` | documentation_or_license_record |  |  |
| `docs/RELEASE_0_5_0.md` | documentation_or_license_record |  |  |
| `docs/RELEASE_0_6_0.md` | documentation_or_license_record |  |  |
| `docs/RELEASE_0_8_0.md` | documentation_or_license_record |  |  |
| `docs/RELEASE_0_9_0.md` | documentation_or_license_record |  |  |
| `docs/ROADMAP.md` | documentation_or_license_record |  |  |
| `docs/SETTINGS_V014.md` | documentation_or_license_record |  |  |
| `docs/SPENDING_BUDGETS_V014.md` | documentation_or_license_record |  |  |
| `docs/TESTING.md` | documentation_or_license_record |  |  |
| `docs/TRANSACTION_AUTOMATION.md` | documentation_or_license_record |  |  |
| `docs/TYPOGRAPHY_AUDIT.md` | documentation_or_license_record |  |  |
| `docs/UI_FOUNDATION.md` | documentation_or_license_record |  |  |
| `docs/UX_AUDIT_v0.11.md` | documentation_or_license_record | ; \| Wealthfolio \| Separate local reference checkout `392f272c5b15a4af45dc2ff71dcbec474f47112a`: `apps/frontend/src/pages/layouts/navigation/app-sidebar.tsx`, `pages/settings/sidebar-nav.tsx`, `pages/settings/spending/rules/spending-rules-page |  |
| `docs/UX_REDESIGN_AUDIT.md` | documentation_or_license_record |  |  |
| `docs/UX_REDESIGN_DECISIONS.md` | documentation_or_license_record |  |  |
| `docs/UX_REDESIGN_IMPLEMENTATION.md` | documentation_or_license_record |  |  |
| `docs/UX_REDESIGN_SPEC.md` | documentation_or_license_record |  |  |
| `docs/VISUAL_REFINEMENT_v0.13.md` | documentation_or_license_record |  |  |
| `docs/WEALTHFOLIO_PARITY_v0.13.md` | documentation_or_license_record |  |  |
| `docs/adr/0001-unified-spending-first-dashboard.md` | documentation_or_license_record |  |  |
| `docs/adr/0002-unified-investment-insights.md` | documentation_or_license_record |  |  |
| `docs/adr/0003-shared-activities-distinct-financial-records.md` | documentation_or_license_record |  |  |
| `docs/adr/0004-pinned-visual-reference.md` | documentation_or_license_record | ; Public Wealthfolio screenshots and its current source represent different layout |  |
| `docs/adr/0005-bookmarkable-financial-details.md` | documentation_or_license_record |  |  |
| `docs/adr/0006-preserve-ingestion-review-boundaries.md` | documentation_or_license_record |  |  |
| `docs/architecture.md` | documentation_or_license_record |  |  |
| `docs/screenshots/v012/accounts-1280.jpg` | historical_synthetic_screenshot |  |  |
| `docs/screenshots/v012/accounts.jpg` | historical_synthetic_screenshot |  |  |
| `docs/screenshots/v012/allocation-1280.jpg` | historical_synthetic_screenshot |  |  |
| `docs/screenshots/v012/allocation.jpg` | historical_synthetic_screenshot |  |  |
| `docs/screenshots/v012/goals-1280.jpg` | historical_synthetic_screenshot |  |  |
| `docs/screenshots/v012/goals.jpg` | historical_synthetic_screenshot |  |  |
| `docs/screenshots/v012/investments-1280.jpg` | historical_synthetic_screenshot |  |  |
| `docs/screenshots/v012/investments.jpg` | historical_synthetic_screenshot |  |  |
| `docs/screenshots/v012/mobile.jpg` | historical_synthetic_screenshot |  |  |
| `docs/screenshots/v012/net-worth-1280.jpg` | historical_synthetic_screenshot |  |  |
| `docs/screenshots/v012/net-worth.jpg` | historical_synthetic_screenshot |  |  |
| `docs/screenshots/v012/overview-1280.jpg` | historical_synthetic_screenshot |  |  |
| `docs/screenshots/v012/overview-wide.jpg` | historical_synthetic_screenshot |  |  |
| `docs/screenshots/v012/overview.jpg` | historical_synthetic_screenshot |  |  |
| `docs/screenshots/v012/performance-1280.jpg` | historical_synthetic_screenshot |  |  |
| `docs/screenshots/v012/performance.jpg` | historical_synthetic_screenshot |  |  |
| `docs/screenshots/v012/reconciliation-1280.jpg` | historical_synthetic_screenshot |  |  |
| `docs/screenshots/v012/reconciliation.jpg` | historical_synthetic_screenshot |  |  |
| `docs/screenshots/v012/spending-1280.jpg` | historical_synthetic_screenshot |  |  |
| `docs/screenshots/v012/spending.jpg` | historical_synthetic_screenshot |  |  |
| `docs/screenshots/v012/transactions-1280.jpg` | historical_synthetic_screenshot |  |  |
| `docs/screenshots/v012/transactions.jpg` | historical_synthetic_screenshot |  |  |
| `docs/visual/phase17/finance-tracker-1440.png` | documentation_or_license_record |  |  |
| `docs/visual/phase17/finance-tracker-1920.png` | documentation_or_license_record |  |  |
| `docs/visual/phase17/finance-tracker-expanded.png` | documentation_or_license_record |  |  |
| `docs/visual/phase17/finance-tracker-light.png` | documentation_or_license_record |  |  |
| `docs/visual/phase17/finance-tracker-mobile-drawer.png` | documentation_or_license_record |  |  |
| `docs/visual/phase17/finance-tracker-mobile.png` | documentation_or_license_record |  |  |
| `docs/visual/phase17/finance-tracker-tooltip.png` | documentation_or_license_record |  |  |
| `docs/visual/phase17/index.html` | documentation_or_license_record |  |  |
| `frontend/.dockerignore` | original_candidate_no_upstream_copy_evidence |  |  |
| `frontend/.prettierignore` | original_candidate_no_upstream_copy_evidence |  |  |
| `frontend/.prettierrc.json` | original_candidate_no_upstream_copy_evidence |  |  |
| `frontend/Dockerfile` | original_candidate_no_upstream_copy_evidence |  |  |
| `frontend/components.json` | original_candidate_no_upstream_copy_evidence |  |  |
| `frontend/eslint.config.js` | original_candidate_no_upstream_copy_evidence |  |  |
| `frontend/index.html` | original_candidate_no_upstream_copy_evidence |  |  |
| `frontend/nginx.conf` | original_candidate_no_upstream_copy_evidence |  |  |
| `frontend/package-lock.json` | original_candidate_no_upstream_copy_evidence |  |  |
| `frontend/package.json` | original_candidate_no_upstream_copy_evidence |  |  |
| `frontend/public/appearance-init.js` | original_candidate_no_upstream_copy_evidence |  |  |
| `frontend/public/goal-covers/car.png` | upstream_asset_rights_clearance | ; apps/frontend/public/goals/car.png | Repository umbrella AGPL evidence; no independent image-ownership proof |
| `frontend/public/goal-covers/custom_save_up.png` | upstream_asset_rights_clearance | ; apps/frontend/public/goals/custom_save_up.png | Repository umbrella AGPL evidence; no independent image-ownership proof |
| `frontend/public/goal-covers/education.png` | upstream_asset_rights_clearance | ; apps/frontend/public/goals/education.png | Repository umbrella AGPL evidence; no independent image-ownership proof |
| `frontend/public/goal-covers/home.png` | upstream_asset_rights_clearance | ; apps/frontend/public/goals/home.png | Repository umbrella AGPL evidence; no independent image-ownership proof |
| `frontend/public/goal-covers/wedding.png` | upstream_asset_rights_clearance | ; apps/frontend/public/goals/wedding.png | Repository umbrella AGPL evidence; no independent image-ownership proof |
| `frontend/public/health.json` | original_candidate_no_upstream_copy_evidence |  |  |
| `frontend/public/licenses/GPL-3.0.txt` | third_party_notice_or_license_text |  |  |
| `frontend/public/licenses/JetBrains-Mono-OFL.txt` | third_party_notice_or_license_text |  |  |
| `frontend/public/licenses/THIRD_PARTY_NOTICES.md` | third_party_notice_or_license_text | AGPL-3.0-only; from Wealthfolio revision `92b4647f74ec51fbbb1a772db4f42ea91060c518`: |  |
| `frontend/public/licenses/Wealthfolio-AGPL-3.0.txt` | third_party_notice_or_license_text |  |  |
| `frontend/public/licenses/base-ui-react-LICENSE.txt` | third_party_notice_or_license_text |  |  |
| `frontend/public/licenses/cmdk-LICENSE.md.txt` | third_party_notice_or_license_text |  |  |
| `frontend/public/licenses/date-fns-LICENSE.md.txt` | third_party_notice_or_license_text |  |  |
| `frontend/public/licenses/date-fns-tz-LICENSE.txt` | third_party_notice_or_license_text |  |  |
| `frontend/public/licenses/dm-sans-OFL.txt` | third_party_notice_or_license_text |  |  |
| `frontend/public/licenses/embla-carousel-MIT.txt` | third_party_notice_or_license_text |  |  |
| `frontend/public/licenses/framer-motion-MIT.txt` | third_party_notice_or_license_text |  |  |
| `frontend/public/licenses/geist-OFL.txt` | third_party_notice_or_license_text |  |  |
| `frontend/public/licenses/ibm-plex-sans-OFL.txt` | third_party_notice_or_license_text |  |  |
| `frontend/public/licenses/index.html` | third_party_notice_or_license_text |  |  |
| `frontend/public/licenses/inter-OFL.txt` | third_party_notice_or_license_text |  |  |
| `frontend/public/licenses/internationalized-date-LICENSE.txt` | third_party_notice_or_license_text |  |  |
| `frontend/public/licenses/lucide-react-LICENSE.txt` | third_party_notice_or_license_text |  |  |
| `frontend/public/licenses/manrope-OFL.txt` | third_party_notice_or_license_text |  |  |
| `frontend/public/licenses/merriweather-OFL.txt` | third_party_notice_or_license_text |  |  |
| `frontend/public/licenses/motion-MIT.txt` | third_party_notice_or_license_text |  |  |
| `frontend/public/licenses/ofxtools-COPYRIGHT.txt` | third_party_notice_or_license_text |  |  |
| `frontend/public/licenses/outfit-OFL.txt` | third_party_notice_or_license_text |  |  |
| `frontend/public/licenses/phosphor-icons-react-LICENSE.txt` | third_party_notice_or_license_text |  |  |
| `frontend/public/licenses/public-sans-OFL.txt` | third_party_notice_or_license_text |  |  |
| `frontend/public/licenses/react-aria-components-LICENSE.txt` | third_party_notice_or_license_text |  |  |
| `frontend/public/licenses/react-day-picker-LICENSE.txt` | third_party_notice_or_license_text |  |  |
| `frontend/public/licenses/react-draggable-MIT.txt` | third_party_notice_or_license_text |  |  |
| `frontend/public/licenses/react-grid-layout-MIT.txt` | third_party_notice_or_license_text |  |  |
| `frontend/public/licenses/react-resizable-MIT.txt` | third_party_notice_or_license_text |  |  |
| `frontend/public/licenses/sonner-LICENSE.md.txt` | third_party_notice_or_license_text |  |  |
| `frontend/public/licenses/source-sans-3-OFL.txt` | third_party_notice_or_license_text |  |  |
| `frontend/public/licenses/source-serif-4-OFL.txt` | third_party_notice_or_license_text |  |  |
| `frontend/public/licenses/tanstack-react-table-LICENSE.txt` | third_party_notice_or_license_text |  |  |
| `frontend/public/licenses/tanstack-react-virtual-LICENSE.txt` | third_party_notice_or_license_text |  |  |
| `frontend/public/licenses/tw-animate-css-MIT.txt` | third_party_notice_or_license_text |  |  |
| `frontend/scripts/appearance-e2e.mjs` | original_candidate_no_upstream_copy_evidence |  |  |
| `frontend/scripts/application-audit-e2e.mjs` | original_candidate_no_upstream_copy_evidence |  |  |
| `frontend/scripts/chart-demo-e2e.mjs` | original_candidate_no_upstream_copy_evidence |  |  |
| `frontend/scripts/dashboard-migration-e2e.mjs` | original_candidate_no_upstream_copy_evidence |  |  |
| `frontend/scripts/demo-e2e.mjs` | original_candidate_no_upstream_copy_evidence |  |  |
| `frontend/scripts/demo-fixture-selection.mjs` | original_candidate_no_upstream_copy_evidence |  |  |
| `frontend/scripts/fixed-income-e2e.mjs` | original_candidate_no_upstream_copy_evidence |  |  |
| `frontend/scripts/goals-e2e.mjs` | original_candidate_no_upstream_copy_evidence |  |  |
| `frontend/scripts/goals-migration-e2e.mjs` | original_candidate_no_upstream_copy_evidence |  |  |
| `frontend/scripts/holdings-activities-e2e.mjs` | original_candidate_no_upstream_copy_evidence |  |  |
| `frontend/scripts/income-e2e.mjs` | original_candidate_no_upstream_copy_evidence |  |  |
| `frontend/scripts/income-portfolio-e2e.mjs` | original_candidate_no_upstream_copy_evidence |  |  |
| `frontend/scripts/net-worth-e2e.mjs` | original_candidate_no_upstream_copy_evidence |  |  |
| `frontend/scripts/net-worth-empty-e2e.mjs` | original_candidate_no_upstream_copy_evidence |  |  |
| `frontend/scripts/numbers-e2e.mjs` | original_candidate_no_upstream_copy_evidence |  |  |
| `frontend/scripts/parity-e2e.mjs` | original_candidate_no_upstream_copy_evidence |  |  |
| `frontend/scripts/performance-insights-e2e.mjs` | original_candidate_no_upstream_copy_evidence |  |  |
| `frontend/scripts/pluggy-e2e.mjs` | original_candidate_no_upstream_copy_evidence |  |  |
| `frontend/scripts/portfolio-insights-e2e.mjs` | original_candidate_no_upstream_copy_evidence |  |  |
| `frontend/scripts/real-market-e2e.mjs` | original_candidate_no_upstream_copy_evidence |  |  |
| `frontend/scripts/settings-maintenance-e2e.mjs` | original_candidate_no_upstream_copy_evidence |  |  |
| `frontend/scripts/settings-migration-e2e.mjs` | original_candidate_no_upstream_copy_evidence |  |  |
| `frontend/scripts/sidebar-order-e2e.mjs` | original_candidate_no_upstream_copy_evidence |  |  |
| `frontend/scripts/spending-migration-e2e.mjs` | original_candidate_no_upstream_copy_evidence |  |  |
| `frontend/scripts/themes-e2e.mjs` | original_candidate_no_upstream_copy_evidence |  |  |
| `frontend/scripts/typography-e2e.mjs` | original_candidate_no_upstream_copy_evidence |  |  |
| `frontend/scripts/unified-demo-e2e.mjs` | original_candidate_no_upstream_copy_evidence |  |  |
| `frontend/scripts/ux-shell-e2e.mjs` | original_candidate_no_upstream_copy_evidence |  |  |
| `frontend/src/App.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/App.tsx` | AGPL_manifest_derived | ; apps/frontend/src/pages/dashboard/portfolio-page.tsx |  |
| `frontend/src/appearance.css` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/application.css` | AGPL_declared_adaptation | AGPL-3.0-only | Header/notice provenance exists; exact local-to-upstream file mapping not in fingerprint manifest |
| `frontend/src/components/accrued-income-dashboard.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/components/accrued-income-dashboard.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/components/activity-comparison.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/components/activity-navigation.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/components/app-shell.tsx` | AGPL_declared_adaptation | AGPL-3.0-only | Header/notice provenance exists; exact local-to-upstream file mapping not in fingerprint manifest |
| `frontend/src/components/balance-chart.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/components/budget-pace-chart.tsx` | AGPL_declared_adaptation | AGPL-3.0-only | Header/notice provenance exists; exact local-to-upstream file mapping not in fingerprint manifest |
| `frontend/src/components/budget-progress.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/components/candidate-inspector.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/components/candidate-inspector.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/components/cash-flow-chart.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/components/composition-chart.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/components/dashboard-card.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/components/dashboard-card.tsx; apps/frontend/src/components/dashboard-card.tsx |  |
| `frontend/src/components/decimal-input.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/components/demo-experience.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/components/demo-experience.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/components/demo-provider.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/components/detail-drawer.css` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/components/detail-drawer.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/components/event-daily-chart.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/components/financial-privacy.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/components/financial.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/components/financial.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/components/fixed-income-chart.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/components/fixed-subscription.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/components/forms.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/components/forms.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/components/goal-progress.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/components/goal-progress.tsx` | upstream_reference_or_mixed_origin_review | ; // Card hierarchy and segmented progress adapted from Wealthfolio goal-card.tsx, | Absent header/manifest is not proof of original authorship; inspect cited expression |
| `frontend/src/components/income-chart.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; // Adapted from Wealthfolio 92b4647 pages/income/income-history-chart.tsx. | Header/notice provenance exists; exact local-to-upstream file mapping not in fingerprint manifest |
| `frontend/src/components/income-currency-mix.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; // Adapted from Wealthfolio 92b4647 income-page.tsx currency breakdown. | Header/notice provenance exists; exact local-to-upstream file mapping not in fingerprint manifest |
| `frontend/src/components/income-dashboard.css` | AGPL_declared_adaptation | AGPL-3.0-only; * Source-adapted Wealthfolio 92b4647 Income card/chart geometry. */ | Header/notice provenance exists; exact local-to-upstream file mapping not in fingerprint manifest |
| `frontend/src/components/income-dashboard.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/components/income-dashboard.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; // Adapted from Wealthfolio 92b4647 pages/income/income-page.tsx. | Header/notice provenance exists; exact local-to-upstream file mapping not in fingerprint manifest |
| `frontend/src/components/insights-dashboard.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/components/insights-dashboard.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; // Adapted from Wealthfolio 92b4647 insights-dashboard.tsx, with workspace appearance | Header/notice provenance exists; exact local-to-upstream file mapping not in fingerprint manifest |
| `frontend/src/components/investment-hero.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/components/investment-hero.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/components/investment-overview-rows.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/components/motion-provider.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/components/net-worth-chart.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/pages/net-worth/net-worth-chart.tsx; apps/frontend/src/pages/net-worth/net-worth-chart.tsx; apps/frontend/src/pages/net-worth/components/category-trend-chart.tsx |  |
| `frontend/src/components/net-worth-investments.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/pages/holdings/components/allocation-detail-sheet.tsx |  |
| `frontend/src/components/net-worth-overview.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/components/net-worth-overview.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/pages/net-worth/net-worth-content.tsx; apps/frontend/src/pages/net-worth/components/breakdown-table.tsx; apps/frontend/src/pages/net-worth/components/velocity-card.tsx; apps/frontend/src/pages/net-worth/components/net-worth-attention.tsx; apps/frontend/src/pages/net-worth/components/composition-bar.tsx; apps/frontend/src/pages/net-worth/components/breakdown-table.tsx; apps/frontend/src/pages/net-worth/components/composition-bar.tsx |  |
| `frontend/src/components/overview-chart.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/components/overview-chart.tsx` | AGPL_declared_adaptation | AGPL-3.0-only | Header/notice provenance exists; exact local-to-upstream file mapping not in fingerprint manifest |
| `frontend/src/components/payee-picker.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/components/portfolio-composition.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/components/portfolio-insights-overview.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/components/portfolio-insights-overview.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; // Adapted from Wealthfolio 92b4647 overview-page, value-strip, portfolio-explorer, | Header/notice provenance exists; exact local-to-upstream file mapping not in fingerprint manifest |
| `frontend/src/components/portfolio-insights.css` | AGPL_declared_adaptation | AGPL-3.0-only; * Source-adapted Wealthfolio 92b4647 Insights widget geometry; local semantic tokens. */ | Header/notice provenance exists; exact local-to-upstream file mapping not in fingerprint manifest |
| `frontend/src/components/portfolio-value-chart.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/components/portfolio-value-chart.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/components/history-chart.tsx |  |
| `frontend/src/components/primitives.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/components/real-market-demo.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/components/real-market-demo.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/components/section-navigation.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/components/selection-indicator.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; // Adapted from pinned Wealthfolio tabs.tsx / animated-toggle-group.tsx. | Header/notice provenance exists; exact local-to-upstream file mapping not in fingerprint manifest |
| `frontend/src/components/spending-story.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/components/trajectory-chart.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/components/transaction-review.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/components/transaction-sources.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/components/transaction-table.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/components/transaction-table.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/components/ui/button.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/activities/activities-page.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/pages/activity/activity-page.tsx |  |
| `frontend/src/features/activities/activity-compat.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/activities/activity-compat.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/activities/activity-day-groups.ts` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/pages/activity/components/activity-table/activity-day-groups.ts |  |
| `frontend/src/features/activities/activity-day-header.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/pages/activity/components/activity-table/activity-day-header.tsx |  |
| `frontend/src/features/activities/activity-editor.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/spending/components/cash-activity-form.tsx |  |
| `frontend/src/features/activities/activity-operations.tsx` | upstream_reference_or_mixed_origin_review | ; // Source action-menu presentation adapted from Wealthfolio 92b4647 activity-operations.tsx. | Absent header/manifest is not proof of original authorship; inspect cited expression |
| `frontend/src/features/activities/activity-pagination.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/pages/activity/components/activity-pagination.tsx |  |
| `frontend/src/features/activities/activity-table-mobile.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/pages/activity/components/activity-table/activity-table-mobile.tsx |  |
| `frontend/src/features/activities/activity-table.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/pages/activity/components/activity-table/activity-table.tsx |  |
| `frontend/src/features/activities/activity-type-badge.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/pages/activity/components/activity-type-badge.tsx |  |
| `frontend/src/features/activities/activity-type-picker.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/pages/activity/components/activity-type-picker.tsx |  |
| `frontend/src/features/activities/day-groups.ts` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/lib/day-groups.ts |  |
| `frontend/src/features/activities/day-header.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/components/day-header.tsx |  |
| `frontend/src/features/activities/import/file-dropzone.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/pages/activity/import/components/file-dropzone.tsx |  |
| `frontend/src/features/activities/import/import-page.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/pages/activity/import/activity-import-page.tsx |  |
| `frontend/src/features/activities/import/wizard-step-indicator.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/pages/activity/import/components/wizard-step-indicator.tsx |  |
| `frontend/src/features/activities/investment-activities.tsx` | AGPL_declared_adaptation | AGPL-3.0-only | Header/notice provenance exists; exact local-to-upstream file mapping not in fingerprint manifest |
| `frontend/src/features/activities/investment-form-draft.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/activities/row-click.test.tsx` | AGPL_manifest_derived | ; apps/frontend/src/lib/row-click.test.tsx |  |
| `frontend/src/features/activities/spending/bulk.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/activities/spending/compat.test.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/activities/spending/compat.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/activities/spending/delete-transactions-dialog.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/spending/components/delete-transactions-dialog.tsx |  |
| `frontend/src/features/activities/spending/filters.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/activities/spending/hover-slot.ts` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/lib/hover-slot.ts |  |
| `frontend/src/features/activities/spending/quick-edit.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/activities/spending/selection-checkbox.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/spending/components/selection-checkbox.tsx |  |
| `frontend/src/features/activities/spending/selection-toolbar.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/spending/components/selection-toolbar.tsx |  |
| `frontend/src/features/activities/spending/spending-table.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; // Source row/card/header composition from Wealthfolio 92b4647 spending-transactions-tab.tsx. | Header/notice provenance exists; exact local-to-upstream file mapping not in fingerprint manifest |
| `frontend/src/features/activities/spending/transaction-card.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/spending/components/transaction-card.tsx |  |
| `frontend/src/features/activities/spending/transaction-row-actions.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/spending/components/transaction-row-actions.tsx |  |
| `frontend/src/features/activities/spending/transaction-row.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/spending/components/transaction-row.tsx |  |
| `frontend/src/features/activities/spending/transactions-bulk-bar.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/spending/components/transactions-bulk-bar.tsx |  |
| `frontend/src/features/activities/spending/transactions-filter-bar.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/spending/components/transactions-filter-bar.tsx |  |
| `frontend/src/features/activities/spending/truncated-text.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/components/truncated-text.tsx |  |
| `frontend/src/features/activities/spending/ui.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/activities/transaction-draft.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/activities/use-horizontal-overflow.ts` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/hooks/use-horizontal-overflow.ts |  |
| `frontend/src/features/activities/use-virtual-scroll-container.ts` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/hooks/use-virtual-scroll-container.ts |  |
| `frontend/src/features/dashboard/api.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/dashboard/balance.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/pages/dashboard/balance.tsx |  |
| `frontend/src/features/dashboard/category-detail-sheet.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/pages/net-worth/components/category-detail-sheet.tsx; apps/frontend/src/pages/net-worth/components/category-trend-chart.tsx |  |
| `frontend/src/features/dashboard/dashboard.css` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/dashboard/dashboard.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/dashboard/history-chart-scale.ts` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/components/history-chart-scale.ts |  |
| `frontend/src/features/dashboard/history-chart.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/components/history-chart.tsx |  |
| `frontend/src/features/dashboard/history-geometry.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/dashboard/investments-dashboard.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/pages/dashboard/dashboard-content.tsx; apps/frontend/src/pages/dashboard/dashboard-actions.tsx; apps/frontend/src/pages/dashboard/dashboard-portfolio-selector.tsx; apps/frontend/src/pages/dashboard/use-dashboard-period.ts; apps/frontend/src/pages/dashboard/use-dashboard-portfolio.ts |  |
| `frontend/src/features/dashboard/momentum-card.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/pages/net-worth/components/momentum-card.tsx |  |
| `frontend/src/features/dashboard/period-controls.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; packages/ui/src/components/financial/interval-selector.tsx |  |
| `frontend/src/features/dashboard/period.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/dashboard/summary-sections.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/pages/dashboard/accounts-summary.tsx; apps/frontend/src/pages/dashboard/top-holdings.tsx; apps/frontend/src/pages/dashboard/goals.tsx |  |
| `frontend/src/features/goals/api.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/goals/compat.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/goals/components/goal-card.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/goals/components/goal-card.tsx |  |
| `frontend/src/features/goals/components/goal-edit-dialog.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/goals/components/goal-edit-dialog.tsx |  |
| `frontend/src/features/goals/components/goal-funding-editor.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/goals/components/goal-funding-editor.tsx |  |
| `frontend/src/features/goals/components/goal-lever-row.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/goals/components/goal-lever-row.tsx |  |
| `frontend/src/features/goals/draft-guard.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/goals/exact-controls.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/goals/goals.css` | upstream_reference_or_mixed_origin_review | ; /* Source goal slider tokens from Wealthfolio 92b4647 globals.css. */ | Absent header/manifest is not proof of original authorship; inspect cited expression |
| `frontend/src/features/goals/hooks/use-draft-guard.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/goals/hooks/use-goals.ts` | AGPL_manifest_derived | ; apps/frontend/src/features/goals/hooks/use-goals.ts |  |
| `frontend/src/features/goals/i18n.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/goals/lib/exact-slider.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/goals/lib/save-up-adapter.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/goals/lib/templates.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/goals/lifecycle-dialogs.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/goals/pages/goal-detail-page.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/goals/pages/goal-detail-page.tsx |  |
| `frontend/src/features/goals/pages/goal-new-page.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/goals/pages/goal-new-page.tsx |  |
| `frontend/src/features/goals/pages/goals-dashboard-page.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/goals/pages/goals-dashboard-page.tsx |  |
| `frontend/src/features/goals/save-up/components/save-up-detail.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/goals/save-up/components/save-up-detail.tsx |  |
| `frontend/src/features/goals/save-up/components/save-up-projection-card.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/goals/save-up/components/save-up-projection-card.tsx |  |
| `frontend/src/features/goals/save-up/components/savings-milestones-card.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/goals/save-up/components/savings-milestones-card.tsx |  |
| `frontend/src/features/goals/workspace-states.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/holdings/account-filter-selector.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/components/account-filter-selector.tsx |  |
| `frontend/src/features/holdings/account-profile-page.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/pages/account/account-page.tsx |  |
| `frontend/src/features/holdings/action-palette.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/components/action-palette.tsx |  |
| `frontend/src/features/holdings/alternative-asset-detail-card.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/pages/asset/alternative-asset-content.tsx |  |
| `frontend/src/features/holdings/alternative-holdings-list-mobile.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/pages/holdings/components/alternative-holdings-list-mobile.tsx |  |
| `frontend/src/features/holdings/alternative-holdings-table.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/pages/holdings/components/alternative-holdings-table.tsx |  |
| `frontend/src/features/holdings/api.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/holdings/asset-detail-card.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/pages/asset/asset-detail-card.tsx |  |
| `frontend/src/features/holdings/asset-profile-page.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/pages/asset/asset-profile-page.tsx |  |
| `frontend/src/features/holdings/compat.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/holdings/formatting.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/holdings/formatting.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/holdings/holdings-mobile-filter-sheet.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/pages/holdings/components/holdings-mobile-filter-sheet.tsx |  |
| `frontend/src/features/holdings/holdings-page.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; // HoldingsPage composition adapted from Wealthfolio 92b4647 holdings-page.tsx. | Header/notice provenance exists; exact local-to-upstream file mapping not in fingerprint manifest |
| `frontend/src/features/holdings/holdings-status-control.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/pages/holdings/components/holdings-status-control.tsx |  |
| `frontend/src/features/holdings/holdings-table-mobile.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/pages/holdings/components/holdings-table-mobile.tsx |  |
| `frontend/src/features/holdings/holdings-table-styles.ts` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/pages/holdings/components/holdings-table-styles.ts |  |
| `frontend/src/features/holdings/holdings-table.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/pages/holdings/components/holdings-table.tsx |  |
| `frontend/src/features/holdings/holdings-type-filter.ts` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/pages/holdings/components/holdings-type-filter.ts |  |
| `frontend/src/features/holdings/holdings-visibility.ts` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/pages/holdings/components/holdings-visibility.ts |  |
| `frontend/src/features/holdings/i18n.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/holdings/liability-overview.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/pages/holdings/components/liability-overview.tsx |  |
| `frontend/src/features/holdings/local-link.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/holdings/manual-asset-profile.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; // Adapted layout: Wealthfolio 92b4647 asset-profile-page.tsx and alternative-asset-content.tsx. | Header/notice provenance exists; exact local-to-upstream file mapping not in fingerprint manifest |
| `frontend/src/features/holdings/migration.css` | upstream_reference_or_mixed_origin_review | ; /* UI control tokens adapted from the pinned upstream classic theme. Product palette stays authoritative. */ | Absent header/manifest is not proof of original authorship; inspect cited expression |
| `frontend/src/features/holdings/number-formatters.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/holdings/progress-bar.tsx` | upstream_reference_or_mixed_origin_review | ; // Adapted from Wealthfolio 92b4647 goal-card.tsx ProgressBar (AGPL-3.0-only). | Absent header/manifest is not proof of original authorship; inspect cited expression |
| `frontend/src/features/holdings/quote-history.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/holdings/quote-history.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/pages/asset/quote-history-data-grid.tsx |  |
| `frontend/src/features/holdings/recorded-liabilities.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/holdings/responsive-dialog.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/holdings/swipable-page.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/components/page/swipable-page.tsx |  |
| `frontend/src/features/holdings/types.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/holdings/ui.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/performance/allocation-api.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/performance/allocation-targets.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/performance/allocation-targets.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/pages/insights/overview/target-rails-card.tsx |  |
| `frontend/src/features/performance/holdings-highlights.ts` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/pages/insights/overview/holdings-highlights.ts |  |
| `frontend/src/features/performance/performance-chart-colors.ts` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/components/performance-chart-colors.ts |  |
| `frontend/src/features/performance/performance-chart-mobile.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/components/performance-chart-mobile.tsx |  |
| `frontend/src/features/performance/performance-chart.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/components/performance-chart.tsx |  |
| `frontend/src/features/performance/performance-workspace.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/pages/performance/performance-page.tsx |  |
| `frontend/src/features/performance/performance.css` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/performance/series.test.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/performance/series.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/performance/target-math.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/performance/top-movers.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/pages/insights/overview/holdings-highlight-cards.tsx |  |
| `frontend/src/features/performance/treemap-palette.ts` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/pages/holdings/components/treemap-palette.ts |  |
| `frontend/src/features/settings/api.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/settings/exports.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; // Adapted from Wealthfolio 92b4647 settings/exports/{exports-page,exports-form,backup-restore-form}.tsx. | Header/notice provenance exists; exact local-to-upstream file mapping not in fingerprint manifest |
| `frontend/src/features/settings/general.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; // Adapted from Wealthfolio 92b4647 settings/general/{general-page,currency-settings,language-region-settings}.tsx. | Header/notice provenance exists; exact local-to-upstream file mapping not in fingerprint manifest |
| `frontend/src/features/settings/groups.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; // Adapted from Wealthfolio 92b4647 settings/portfolios/portfolios-page.tsx. | Header/notice provenance exists; exact local-to-upstream file mapping not in fingerprint manifest |
| `frontend/src/features/settings/i18n.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/settings/management-components.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/settings/reporting-currency.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/settings/securities.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; // Adapted from Wealthfolio 92b4647 settings/asset/assets-page.tsx; existing local security editors are reused. | Header/notice provenance exists; exact local-to-upstream file mapping not in fingerprint manifest |
| `frontend/src/features/settings/settings-layout.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; // Adapted from Wealthfolio 92b4647 settings-layout.tsx, sidebar-nav.tsx and settings-header.tsx. | Header/notice provenance exists; exact local-to-upstream file mapping not in fingerprint manifest |
| `frontend/src/features/settings/settings-navigation.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/settings/settings-page.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; // Source hierarchy adapted from Wealthfolio 92b4647 pages/settings; local APIs remain authoritative. | Header/notice provenance exists; exact local-to-upstream file mapping not in fingerprint manifest |
| `frontend/src/features/settings/settings.css` | upstream_reference_or_mixed_origin_review | ; /* AGPL-3.0-only. Geometry adapted from pinned SettingsLayout/SidebarNav/SettingsHeader. */ | Absent header/manifest is not proof of original authorship; inspect cited expression |
| `frontend/src/features/settings/settings.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/spending/api.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/spending/budget-adapter.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/spending/budget-adapter.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/spending/compat.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/spending/components/amount-input.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/spending/components/amount-input.tsx |  |
| `frontend/src/features/spending/components/budget-editor.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/spending/components/budget-editor.tsx |  |
| `frontend/src/features/spending/components/budget-line-chart-card.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/spending/components/budget-line-chart-card.tsx |  |
| `frontend/src/features/spending/components/cash-flow-strip.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/spending/components/cash-flow-strip.tsx |  |
| `frontend/src/features/spending/components/category-appearance.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/spending/components/category-breakdown.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/spending/components/spending-tab-content.tsx |  |
| `frontend/src/features/spending/components/category-chips.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/spending/components/category-chips.tsx |  |
| `frontend/src/features/spending/components/color-picker.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/spending/components/color-picker.tsx |  |
| `frontend/src/features/spending/components/dashboard-card.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/components/dashboard-card.tsx |  |
| `frontend/src/features/spending/components/event-visuals.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/spending/components/events-card.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/spending/components/events-card.tsx |  |
| `frontend/src/features/spending/components/icon-picker.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/spending/components/icon-picker.tsx |  |
| `frontend/src/features/spending/components/privacy-toggle.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/spending/components/recent-activity-card.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/spending/components/recent-activity-card.tsx |  |
| `frontend/src/features/spending/components/reports/category-hierarchy-table.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/spending/components/reports/category-hierarchy-table.tsx |  |
| `frontend/src/features/spending/components/reports/category-hierarchy/builders.ts` | AGPL_manifest_derived | AGPL-3.0-only; apps/frontend/src/features/spending/components/reports/category-hierarchy/builders.ts |  |
| `frontend/src/features/spending/components/reports/insights/change-cards.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/spending/components/reports/insights/what-changed-stage.tsx |  |
| `frontend/src/features/spending/components/reports/insights/event-colors.ts` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/spending/components/reports/insights/event-colors.ts |  |
| `frontend/src/features/spending/components/reports/insights/event-detail-panel.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/spending/components/reports/insights/event-detail-panel.tsx |  |
| `frontend/src/features/spending/components/reports/insights/events-calendar-card.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/spending/components/reports/insights/events-calendar-card.tsx |  |
| `frontend/src/features/spending/components/reports/insights/events-timeline-card.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/spending/components/reports/insights/events-timeline-card.tsx |  |
| `frontend/src/features/spending/components/reports/insights/headline-card.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/spending/components/reports/insights/what-changed-stage.tsx |  |
| `frontend/src/features/spending/components/reports/insights/money-flow-chart.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/spending/components/reports/insights/money-flow-chart.tsx |  |
| `frontend/src/features/spending/components/reports/insights/money-flow-section.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/spending/components/reports/insights/money-flow-section.tsx |  |
| `frontend/src/features/spending/components/reports/insights/position-cards.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/spending/components/reports/insights/where-i-am-stage.tsx |  |
| `frontend/src/features/spending/components/reports/insights/stage-nav.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/spending/components/reports/insights/stage-nav.tsx |  |
| `frontend/src/features/spending/components/reports/insights/when-you-spend-card.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/spending/components/reports/insights/when-you-spend-card.tsx |  |
| `frontend/src/features/spending/components/spending-date-picker.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/spending/components/spending-date-picker.tsx |  |
| `frontend/src/features/spending/components/spending-delta-line.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/spending/components/spending-delta-line.tsx |  |
| `frontend/src/features/spending/components/spending-period-toggle.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/spending/components/spending-period-toggle.tsx |  |
| `frontend/src/features/spending/components/target-details.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/spending/exact-controls.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/spending/hooks/use-month-calendar.ts` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/spending/hooks/use-month-calendar.ts |  |
| `frontend/src/features/spending/i18n.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/spending/labels.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/spending/lib/calendar-adapter.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/spending/lib/category-icons.ts` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/spending/lib/category-icons.ts |  |
| `frontend/src/features/spending/lib/color-palette.ts` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/spending/components/color-picker.tsx |  |
| `frontend/src/features/spending/lib/event-adapter.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/spending/lib/event-detail.test.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/spending/lib/event-detail.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/spending/lib/headline-descriptors.ts` | AGPL_manifest_derived | ; apps/frontend/src/features/spending/lib/change-descriptor.ts |  |
| `frontend/src/features/spending/lib/headline.test.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/spending/lib/headline.ts` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/spending/lib/headline.ts |  |
| `frontend/src/features/spending/lib/money-flow.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/spending/lib/table-compat.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/spending/lib/theme.ts` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/spending/lib/theme.ts |  |
| `frontend/src/features/spending/pages/spending-budget-page.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/spending/pages/spending-budget-page.tsx |  |
| `frontend/src/features/spending/pages/spending-dashboard.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/spending/components/spending-tab-content.tsx |  |
| `frontend/src/features/spending/pages/spending-insights-page.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/spending/pages/spending-insights-page.tsx |  |
| `frontend/src/features/spending/period-adapter.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/spending/projections.test.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/spending/spending.css` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/spending/types/budget.ts` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/features/spending/types/budget.ts |  |
| `frontend/src/features/spending/ui.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/features/spending/use-effect-on-change.ts` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/hooks/use-effect-on-change.ts |  |
| `frontend/src/index.css` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/api.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/automation-api.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/budget-api.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/budget-curve.test.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/budget-curve.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/chart-presentation.test.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/chart-presentation.ts` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/components/history-chart.tsx |  |
| `frontend/src/lib/closing-history.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/composition.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/demo-runtime.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/event-timeline.test.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/event-timeline.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/financial-privacy.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/fixed-income.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/gmail.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/goal-display.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/history-money.test.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/i18n.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/income-dashboard.test.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/income-dashboard.ts` | AGPL_declared_adaptation | AGPL-3.0-only; // Adapted from Wealthfolio 92b4647 income-page / income-history-chart. | Header/notice provenance exists; exact local-to-upstream file mapping not in fingerprint manifest |
| `frontend/src/lib/income-reporting.test.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/income-summary.test.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/income-summary.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/ingestion-api.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/insights-layout.test.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/insights-layout.ts` | AGPL_declared_adaptation | AGPL-3.0-only; // Adapted from Wealthfolio 92b4647 insights-layout.ts: responsive plain-data layout. | Header/notice provenance exists; exact local-to-upstream file mapping not in fingerprint manifest |
| `frontend/src/lib/investment-analytics.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/investments.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/life-events.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/localization.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/localized-number.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/market-data.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/money.test.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/money.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/motion.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/motion.ts` | AGPL_declared_adaptation | AGPL-3.0-only; // Visual spring adapted from the pinned licensed reference tab/toggle patterns. | Header/notice provenance exists; exact local-to-upstream file mapping not in fingerprint manifest |
| `frontend/src/lib/navigation.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/navigation.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/net-worth-period.test.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/net-worth-period.ts` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/pages/dashboard/use-dashboard-period.ts |  |
| `frontend/src/lib/net-worth-view.test.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/net-worth-view.ts` | AGPL_declared_adaptation | AGPL-3.0-only; // Category organization adapted from Wealthfolio 92b4647 Net Worth components. | Header/notice provenance exists; exact local-to-upstream file mapping not in fingerprint manifest |
| `frontend/src/lib/pluggy.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/portfolio-insights.test.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/portfolio-insights.ts` | AGPL_declared_adaptation | AGPL-3.0-only; // Source: Wealthfolio 92b4647 allocation-derivations / portfolio-explorer. | Header/notice provenance exists; exact local-to-upstream file mapping not in fingerprint manifest |
| `frontend/src/lib/portfolio-overview.test.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/portfolio-overview.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/preferences.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/reconciliation-api.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/route-aliases.test.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/route-aliases.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/row-click.ts` | AGPL_declared_adaptation | AGPL-3.0-only; apps/frontend/src/lib/row-click.ts |  |
| `frontend/src/lib/sidebar-order.test.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/sidebar-order.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/spending-period.test.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/spending-period.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/themes.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/use-history.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/use-write.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/utils.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/wealth-api.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/wealth-labels.test.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/lib/wealth-labels.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/locales/en.json` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/locales/es-419.json` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/locales/pt-BR.json` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/main.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/motion.css` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/pages/appearance.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/pages/automation.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/pages/dashboard.tsx` | AGPL_declared_adaptation | AGPL-3.0-only | Header/notice provenance exists; exact local-to-upstream file mapping not in fingerprint manifest |
| `frontend/src/pages/duplicate-review.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/pages/fixed-income.css` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/pages/fixed-income.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/pages/fixed-income.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/pages/gmail.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/pages/gmail.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/pages/goals.css` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/pages/goals.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/pages/import-workspace.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/pages/import-workspace.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/pages/investment-analytics.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/pages/investment-analytics.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/pages/investment-forms.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/pages/investment-imports.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/pages/investments.css` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/pages/investments.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/pages/investments.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/pages/life-events.css` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/pages/life-events.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/pages/life-events.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/pages/management.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/pages/market-data.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/pages/market-data.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/pages/net-worth-v014.css` | AGPL_declared_adaptation | AGPL-3.0-only; Adapted from Wealthfolio 92b4647 Net Worth component utility classes. | Header/notice provenance exists; exact local-to-upstream file mapping not in fingerprint manifest |
| `frontend/src/pages/payees.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/pages/payees.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/pages/period-spending-insights.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/pages/period-spending-insights.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/pages/pluggy.css` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/pages/pluggy.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/pages/pluggy.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/pages/previews.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/pages/reconciliation.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/pages/reconciliation.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/pages/rules.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/pages/schedules.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/pages/sidebar-order.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/pages/spending-overview.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/pages/spending-position.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/pages/spending-refunds.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/pages/spending.css` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/pages/spending.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/pages/spending.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/pages/transaction-workspace.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/pages/transactions.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/pages/transactions.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/pages/wealth.css` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/pages/wealth.test.tsx` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/pages/wealth.tsx` | AGPL_declared_adaptation | AGPL-3.0-only; // Net Worth composition adapted from Wealthfolio 92b4647; local posting/detail workflows retained. | Header/notice provenance exists; exact local-to-upstream file mapping not in fingerprint manifest |
| `frontend/src/test/fixtures/synthetic/budget.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/test/fixtures/synthetic/net-worth.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/test/fixtures/synthetic/spending-workspace.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/test/setup.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/themes/charts.css` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/themes/tokens.css` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/ux-redesign.css` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/vendor/wealthfolio/SOURCE.json` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/vendor/wealthfolio/locales/en/account.json` | AGPL_manifest_derived | ; apps/frontend/src/i18n/locales/en/account.json |  |
| `frontend/src/vendor/wealthfolio/locales/en/activity.json` | AGPL_manifest_derived | ; apps/frontend/src/i18n/locales/en/activity.json |  |
| `frontend/src/vendor/wealthfolio/locales/en/allocation.json` | AGPL_manifest_derived | ; apps/frontend/src/i18n/locales/en/allocation.json |  |
| `frontend/src/vendor/wealthfolio/locales/en/asset.json` | AGPL_manifest_derived | ; apps/frontend/src/i18n/locales/en/asset.json |  |
| `frontend/src/vendor/wealthfolio/locales/en/common.json` | AGPL_manifest_derived | ; apps/frontend/src/i18n/locales/en/common.json |  |
| `frontend/src/vendor/wealthfolio/locales/en/goals.json` | AGPL_manifest_derived | ; apps/frontend/src/i18n/locales/en/goals.json |  |
| `frontend/src/vendor/wealthfolio/locales/en/holdings.json` | AGPL_manifest_derived | ; apps/frontend/src/i18n/locales/en/holdings.json |  |
| `frontend/src/vendor/wealthfolio/locales/en/insights.json` | AGPL_manifest_derived | ; apps/frontend/src/i18n/locales/en/insights.json |  |
| `frontend/src/vendor/wealthfolio/locales/en/performance.json` | AGPL_manifest_derived | ; apps/frontend/src/i18n/locales/en/performance.json |  |
| `frontend/src/vendor/wealthfolio/locales/en/spending.json` | AGPL_manifest_derived | ; apps/frontend/src/i18n/locales/en/spending.json |  |
| `frontend/src/vendor/wealthfolio/locales/en/ui.json` | AGPL_manifest_derived | ; apps/frontend/src/i18n/locales/en/ui.json |  |
| `frontend/src/vendor/wealthfolio/locales/es-419/account.json` | AGPL_manifest_derived | ; apps/frontend/src/i18n/locales/es/account.json |  |
| `frontend/src/vendor/wealthfolio/locales/es-419/activity.json` | AGPL_manifest_derived | ; apps/frontend/src/i18n/locales/es/activity.json |  |
| `frontend/src/vendor/wealthfolio/locales/es-419/allocation.json` | AGPL_manifest_derived | ; apps/frontend/src/i18n/locales/es/allocation.json |  |
| `frontend/src/vendor/wealthfolio/locales/es-419/asset.json` | AGPL_manifest_derived | ; apps/frontend/src/i18n/locales/es/asset.json |  |
| `frontend/src/vendor/wealthfolio/locales/es-419/common.json` | AGPL_manifest_derived | ; apps/frontend/src/i18n/locales/es/common.json |  |
| `frontend/src/vendor/wealthfolio/locales/es-419/goals.json` | AGPL_manifest_derived | ; apps/frontend/src/i18n/locales/es/goals.json |  |
| `frontend/src/vendor/wealthfolio/locales/es-419/holdings.json` | AGPL_manifest_derived | ; apps/frontend/src/i18n/locales/es/holdings.json |  |
| `frontend/src/vendor/wealthfolio/locales/es-419/insights.json` | AGPL_manifest_derived | ; apps/frontend/src/i18n/locales/es/insights.json |  |
| `frontend/src/vendor/wealthfolio/locales/es-419/performance.json` | AGPL_manifest_derived | ; apps/frontend/src/i18n/locales/es/performance.json |  |
| `frontend/src/vendor/wealthfolio/locales/es-419/spending.json` | AGPL_manifest_derived | ; apps/frontend/src/i18n/locales/es/spending.json |  |
| `frontend/src/vendor/wealthfolio/locales/es-419/ui.json` | AGPL_manifest_derived | ; apps/frontend/src/i18n/locales/es/ui.json |  |
| `frontend/src/vendor/wealthfolio/locales/pt-BR/account.json` | AGPL_manifest_derived | ; apps/frontend/src/i18n/locales/pt/account.json |  |
| `frontend/src/vendor/wealthfolio/locales/pt-BR/activity.json` | AGPL_manifest_derived | ; apps/frontend/src/i18n/locales/pt/activity.json |  |
| `frontend/src/vendor/wealthfolio/locales/pt-BR/allocation.json` | AGPL_manifest_derived | ; apps/frontend/src/i18n/locales/pt/allocation.json |  |
| `frontend/src/vendor/wealthfolio/locales/pt-BR/asset.json` | AGPL_manifest_derived | ; apps/frontend/src/i18n/locales/pt/asset.json |  |
| `frontend/src/vendor/wealthfolio/locales/pt-BR/common.json` | AGPL_manifest_derived | ; apps/frontend/src/i18n/locales/pt/common.json |  |
| `frontend/src/vendor/wealthfolio/locales/pt-BR/goals.json` | AGPL_manifest_derived | ; apps/frontend/src/i18n/locales/pt/goals.json |  |
| `frontend/src/vendor/wealthfolio/locales/pt-BR/holdings.json` | AGPL_manifest_derived | ; apps/frontend/src/i18n/locales/pt/holdings.json |  |
| `frontend/src/vendor/wealthfolio/locales/pt-BR/insights.json` | AGPL_manifest_derived | ; apps/frontend/src/i18n/locales/pt/insights.json |  |
| `frontend/src/vendor/wealthfolio/locales/pt-BR/performance.json` | AGPL_manifest_derived | ; apps/frontend/src/i18n/locales/pt/performance.json |  |
| `frontend/src/vendor/wealthfolio/locales/pt-BR/spending.json` | AGPL_manifest_derived | ; apps/frontend/src/i18n/locales/pt/spending.json |  |
| `frontend/src/vendor/wealthfolio/locales/pt-BR/ui.json` | AGPL_manifest_derived | ; apps/frontend/src/i18n/locales/pt/ui.json |  |
| `frontend/src/vendor/wealthfolio/reference/README.md` | documentation_or_license_record | ; Wealthfolio 92b4647. Its SHA-256 and original path are in `../SOURCE.json`. |  |
| `frontend/src/vendor/wealthfolio/reference/allocation-worksheet-tab.tsx.txt` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/vendor/wealthfolio/ui/components/ui/alert-dialog.tsx` | upstream_UI_MIT_metadata_notice_gap | ; packages/ui/src/components/ui/alert-dialog.tsx | MIT package declaration; full upstream UI copyright/permission notice not verified |
| `frontend/src/vendor/wealthfolio/ui/components/ui/animated-toggle-group.tsx` | upstream_UI_MIT_metadata_notice_gap | ; packages/ui/src/components/ui/animated-toggle-group.tsx | MIT package declaration; full upstream UI copyright/permission notice not verified |
| `frontend/src/vendor/wealthfolio/ui/components/ui/badge.tsx` | upstream_UI_MIT_metadata_notice_gap | ; packages/ui/src/components/ui/badge.tsx | MIT package declaration; full upstream UI copyright/permission notice not verified |
| `frontend/src/vendor/wealthfolio/ui/components/ui/button-variants.ts` | upstream_UI_MIT_metadata_notice_gap | ; packages/ui/src/components/ui/button-variants.ts | MIT package declaration; full upstream UI copyright/permission notice not verified |
| `frontend/src/vendor/wealthfolio/ui/components/ui/button.tsx` | upstream_UI_MIT_metadata_notice_gap | ; packages/ui/src/components/ui/button.tsx | MIT package declaration; full upstream UI copyright/permission notice not verified |
| `frontend/src/vendor/wealthfolio/ui/components/ui/calendar-rac.tsx` | upstream_UI_MIT_metadata_notice_gap | ; packages/ui/src/components/ui/calendar-rac.tsx | MIT package declaration; full upstream UI copyright/permission notice not verified |
| `frontend/src/vendor/wealthfolio/ui/components/ui/calendar.tsx` | upstream_UI_MIT_metadata_notice_gap | MIT; packages/ui/src/components/ui/calendar.tsx | MIT package declaration; full upstream UI copyright/permission notice not verified |
| `frontend/src/vendor/wealthfolio/ui/components/ui/card.tsx` | upstream_UI_MIT_metadata_notice_gap | ; packages/ui/src/components/ui/card.tsx | MIT package declaration; full upstream UI copyright/permission notice not verified |
| `frontend/src/vendor/wealthfolio/ui/components/ui/carousel.tsx` | upstream_UI_MIT_metadata_notice_gap | ; packages/ui/src/components/ui/carousel.tsx | MIT package declaration; full upstream UI copyright/permission notice not verified |
| `frontend/src/vendor/wealthfolio/ui/components/ui/chart.tsx` | upstream_UI_MIT_metadata_notice_gap | ; packages/ui/src/components/ui/chart.tsx | MIT package declaration; full upstream UI copyright/permission notice not verified |
| `frontend/src/vendor/wealthfolio/ui/components/ui/checkbox.tsx` | upstream_UI_MIT_metadata_notice_gap | ; packages/ui/src/components/ui/checkbox.tsx | MIT package declaration; full upstream UI copyright/permission notice not verified |
| `frontend/src/vendor/wealthfolio/ui/components/ui/command.tsx` | upstream_UI_MIT_metadata_notice_gap | ; packages/ui/src/components/ui/command.tsx | MIT package declaration; full upstream UI copyright/permission notice not verified |
| `frontend/src/vendor/wealthfolio/ui/components/ui/data-table/data-table-column-header.tsx` | upstream_UI_MIT_metadata_notice_gap | ; packages/ui/src/components/ui/data-table/data-table-column-header.tsx | MIT package declaration; full upstream UI copyright/permission notice not verified |
| `frontend/src/vendor/wealthfolio/ui/components/ui/data-table/data-table-faceted-filter.tsx` | upstream_UI_MIT_metadata_notice_gap | ; packages/ui/src/components/ui/data-table/data-table-faceted-filter.tsx | MIT package declaration; full upstream UI copyright/permission notice not verified |
| `frontend/src/vendor/wealthfolio/ui/components/ui/data-table/data-table-toolbar.tsx` | upstream_UI_MIT_metadata_notice_gap | ; packages/ui/src/components/ui/data-table/data-table-toolbar.tsx | MIT package declaration; full upstream UI copyright/permission notice not verified |
| `frontend/src/vendor/wealthfolio/ui/components/ui/data-table/index.tsx` | upstream_UI_MIT_metadata_notice_gap | ; packages/ui/src/components/ui/data-table/index.tsx | MIT package declaration; full upstream UI copyright/permission notice not verified |
| `frontend/src/vendor/wealthfolio/ui/components/ui/date-picker-input.tsx` | upstream_UI_MIT_metadata_notice_gap | ; packages/ui/src/components/ui/date-picker-input.tsx | MIT package declaration; full upstream UI copyright/permission notice not verified |
| `frontend/src/vendor/wealthfolio/ui/components/ui/datefield-rac.tsx` | upstream_UI_MIT_metadata_notice_gap | ; packages/ui/src/components/ui/datefield-rac.tsx | MIT package declaration; full upstream UI copyright/permission notice not verified |
| `frontend/src/vendor/wealthfolio/ui/components/ui/dialog.tsx` | upstream_UI_MIT_metadata_notice_gap | ; packages/ui/src/components/ui/dialog.tsx | MIT package declaration; full upstream UI copyright/permission notice not verified |
| `frontend/src/vendor/wealthfolio/ui/components/ui/direction.tsx` | upstream_UI_MIT_metadata_notice_gap | ; packages/ui/src/components/ui/direction.tsx | MIT package declaration; full upstream UI copyright/permission notice not verified |
| `frontend/src/vendor/wealthfolio/ui/components/ui/dropdown-menu.tsx` | upstream_UI_MIT_metadata_notice_gap | ; packages/ui/src/components/ui/dropdown-menu.tsx | MIT package declaration; full upstream UI copyright/permission notice not verified |
| `frontend/src/vendor/wealthfolio/ui/components/ui/empty.tsx` | upstream_UI_MIT_metadata_notice_gap | ; packages/ui/src/components/ui/empty.tsx | MIT package declaration; full upstream UI copyright/permission notice not verified |
| `frontend/src/vendor/wealthfolio/ui/components/ui/faceted-filter.tsx` | upstream_UI_MIT_metadata_notice_gap | ; packages/ui/src/components/ui/faceted-filter.tsx | MIT package declaration; full upstream UI copyright/permission notice not verified |
| `frontend/src/vendor/wealthfolio/ui/components/ui/icons.tsx` | upstream_UI_MIT_metadata_notice_gap | ; packages/ui/src/components/ui/icons.tsx | MIT package declaration; full upstream UI copyright/permission notice not verified |
| `frontend/src/vendor/wealthfolio/ui/components/ui/input.tsx` | upstream_UI_MIT_metadata_notice_gap | ; packages/ui/src/components/ui/input.tsx | MIT package declaration; full upstream UI copyright/permission notice not verified |
| `frontend/src/vendor/wealthfolio/ui/components/ui/item.tsx` | upstream_UI_MIT_metadata_notice_gap | MIT; packages/ui/src/components/ui/item.tsx | MIT package declaration; full upstream UI copyright/permission notice not verified |
| `frontend/src/vendor/wealthfolio/ui/components/ui/label.tsx` | upstream_UI_MIT_metadata_notice_gap | ; packages/ui/src/components/ui/label.tsx | MIT package declaration; full upstream UI copyright/permission notice not verified |
| `frontend/src/vendor/wealthfolio/ui/components/ui/month-year-picker.tsx` | upstream_UI_MIT_metadata_notice_gap | MIT; packages/ui/src/components/ui/month-year-picker.tsx | MIT package declaration; full upstream UI copyright/permission notice not verified |
| `frontend/src/vendor/wealthfolio/ui/components/ui/page.tsx` | upstream_UI_MIT_metadata_notice_gap | ; packages/ui/src/components/ui/page.tsx | MIT package declaration; full upstream UI copyright/permission notice not verified |
| `frontend/src/vendor/wealthfolio/ui/components/ui/popover.tsx` | upstream_UI_MIT_metadata_notice_gap | ; packages/ui/src/components/ui/popover.tsx | MIT package declaration; full upstream UI copyright/permission notice not verified |
| `frontend/src/vendor/wealthfolio/ui/components/ui/portal-scope.tsx` | upstream_UI_MIT_metadata_notice_gap | ; packages/ui/src/components/ui/portal-scope.tsx | MIT package declaration; full upstream UI copyright/permission notice not verified |
| `frontend/src/vendor/wealthfolio/ui/components/ui/scroll-area.tsx` | upstream_UI_MIT_metadata_notice_gap | ; packages/ui/src/components/ui/scroll-area.tsx | MIT package declaration; full upstream UI copyright/permission notice not verified |
| `frontend/src/vendor/wealthfolio/ui/components/ui/separator.tsx` | upstream_UI_MIT_metadata_notice_gap | ; packages/ui/src/components/ui/separator.tsx | MIT package declaration; full upstream UI copyright/permission notice not verified |
| `frontend/src/vendor/wealthfolio/ui/components/ui/sheet.tsx` | upstream_UI_MIT_metadata_notice_gap | ; packages/ui/src/components/ui/sheet.tsx | MIT package declaration; full upstream UI copyright/permission notice not verified |
| `frontend/src/vendor/wealthfolio/ui/components/ui/skeleton.tsx` | upstream_UI_MIT_metadata_notice_gap | ; packages/ui/src/components/ui/skeleton.tsx | MIT package declaration; full upstream UI copyright/permission notice not verified |
| `frontend/src/vendor/wealthfolio/ui/components/ui/spinner.tsx` | upstream_UI_MIT_metadata_notice_gap | ; packages/ui/src/components/ui/spinner.tsx | MIT package declaration; full upstream UI copyright/permission notice not verified |
| `frontend/src/vendor/wealthfolio/ui/components/ui/swipable-view.tsx` | upstream_UI_MIT_metadata_notice_gap | ; packages/ui/src/components/ui/swipable-view.tsx | MIT package declaration; full upstream UI copyright/permission notice not verified |
| `frontend/src/vendor/wealthfolio/ui/components/ui/table.tsx` | upstream_UI_MIT_metadata_notice_gap | ; packages/ui/src/components/ui/table.tsx | MIT package declaration; full upstream UI copyright/permission notice not verified |
| `frontend/src/vendor/wealthfolio/ui/components/ui/textarea.tsx` | upstream_UI_MIT_metadata_notice_gap | ; packages/ui/src/components/ui/textarea.tsx | MIT package declaration; full upstream UI copyright/permission notice not verified |
| `frontend/src/vendor/wealthfolio/ui/components/ui/tooltip.tsx` | upstream_UI_MIT_metadata_notice_gap | ; packages/ui/src/components/ui/tooltip.tsx | MIT package declaration; full upstream UI copyright/permission notice not verified |
| `frontend/src/vendor/wealthfolio/ui/hooks/use-persistent-state.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/src/vendor/wealthfolio/ui/lib/utils.ts` | original_candidate_no_upstream_copy_evidence |  | Original-candidate file remains part of combined adapted frontend; not exempted by API authorship |
| `frontend/tsconfig.app.json` | original_candidate_no_upstream_copy_evidence |  |  |
| `frontend/tsconfig.json` | original_candidate_no_upstream_copy_evidence |  |  |
| `frontend/tsconfig.node.json` | original_candidate_no_upstream_copy_evidence |  |  |
| `frontend/vite.config.ts` | original_candidate_no_upstream_copy_evidence |  |  |
| `scripts/ci_audit.py` | original_candidate_no_upstream_copy_evidence |  |  |
| `scripts/ruff.toml` | original_candidate_no_upstream_copy_evidence |  |  |
