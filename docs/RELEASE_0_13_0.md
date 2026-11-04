# v0.13.0 validation and handoff

Validation date: 2026-11-04. Product Refinements & Brazilian Historical Demo.
Source branch: `feature/v0.13.0-ux-revamp-pluggy-support`, based on `2e053f9`.
The release commit, merge commit and annotated tag identify the published snapshot;
historical branches, commits and release tags are retained.

## Included scope

- Spending-first application hierarchy, financial detail views, dense ledgers,
  image-free goal cards with exact formatting, schedule health and time remaining.
- Shared motion, responsive navigation, reduced-motion support and accessible
  labels; three interface languages and exact localized decimal input.
- Six light/dark themes, ten self-hosted fonts, independent chart palettes and
  financial gain/loss conventions. Classic and existing appearance preferences
  remain available. DM Sans uses Inter for tabular financial digits.
- Native CDB/CDI, fixed-rate CDB, RDB/Caixinha and Tesouro contracts, dated exact
  accrual/valuation, explicit redemption and estimated tax disclosures.
- Life Events as purchase metadata, deterministic spending insights, contribution
  scenarios and portfolio/income composition through existing financial services.
- Opt-in read-only Pluggy/MeuPluggy connections, local evidence, consent management
  and explicit reviewed ingestion. Credentials remain in the OS vault.
- Isolated Brazil demo: fictional household spending and five goals, fictional
  investment contracts and official historical CDI/Treasury observations. Restricted
  ETF exports remain local and optional; missing coverage is explicit.
- Additive Alembic migrations `sqlite_0014` through `sqlite_0017`, regression tests,
  source/font attribution and updated product/run documentation.

## Release checks

Local validation passed: **475 backend tests**, **213 frontend tests**, backend
Ruff lint/format, frontend ESLint/Prettier, TypeScript/production build, standard
isolated demo browser workflows, and the real-market/theme browser regressions.
Production npm audit reports zero vulnerabilities; Python audit reports none.
All database checks
use owned temporary SQLite workspaces; the normal financial database is not reset,
migrated or seeded by this audit. Browser checks use an isolated process on port
5174 and never attach to the user's running server.

- Backend: full Pytest suite, financial invariants, demo isolation, fresh/populated
  migrations, retained triggers and Alembic metadata checks.
- Frontend: Vitest, ESLint, Prettier, TypeScript and Vite production build.
- Browser: real-market portfolio, theme modes/preferences/system changes, token
  completeness, financial color isolation, responsive pages and exact figures.
- Production audits: compatible Zod and `opentelemetry-api` security updates;
  npm and Python pass the existing audit policy. Development-only moderate
  advisories remain disclosed, with no forced or major dependency upgrade.
- Privacy: current candidate paths/text and historical blob patterns checked.
  No matched credentials or historical database paths were found. This is a
  bounded automated audit, not a guarantee that every possible secret is detected.

## Excluded local artifacts

New `docs/screenshots/` captures, generated galleries/reports, `.tmp`, logs,
dependencies/build output, environment secrets, private ETF exports, SQLite files,
WAL/SHM files and backups remain ignored. Existing published historical visual
assets are retained unchanged. Public official-data snapshots and clearly fake
test fixtures/seed source are legitimate project inputs, not personal finances.

## Intentional limitations

- Exact visual parity and the larger frontend migration remain future work.
  The next branch is `feature/v0.14.0-frontend-refinement`; branch creation does
  not implement it or increment the released version.
- Classic retains its approved existing palette, including approximately 4.26:1
  muted text on dark cards. New themes exceed 5:1 in the tested text/surface matrix.
- Existing large frontend chunk warning and three SQLAlchemy synthetic-seed
  warnings are recorded; they do not represent failing assertions.
- Live Pluggy institution/MFA/production entitlements and Gmail OAuth require
  user-owned credentials and have not been exercised by this release audit.
- WRLD11/IVVB11 history requires an authorized raw-close/corporate-action export.
  No ETF quotes, holdings or returns are invented when it is absent.
- Tax/fee estimates and fictional contractual terms remain educational assumptions.
  Public writable demo hosting, broad cross-platform installation certification
  and v1.0 stability are not claimed. No deployment is part of this release.

## Git procedure

Push the validated source branch, verify GitHub CI, merge without rewriting history
into current `main`, push normally, then create/push annotated `v0.13.0`. Only after
those steps succeed, create and push `feature/v0.14.0-frontend-refinement` from the
updated main commit. Stop on divergence, protected-branch rejection or failed
required checks; never force-push or move an existing release tag.
