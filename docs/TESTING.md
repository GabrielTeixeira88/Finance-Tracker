# Validation commands

Run from the repository root unless a command changes directory. Tests use fake
fixtures and isolated SQLite databases. Never target personal data or an existing
writable demo. Integration tests mock external services.

## Backend

```powershell
cd backend
.venv\Scripts\python.exe -m pytest -q
.venv\Scripts\python.exe -m ruff check .
.venv\Scripts\python.exe -m ruff format --check .
```

Includes clean/populated Alembic migrations, constraints, financial calculations,
missing coverage, imports/reconciliation, mocked integrations, backup/restore and
demo upgrade/reset/isolation. It does not authorize live OAuth, synchronization or
token-vault access. Use the project interpreter, regardless of another activated venv.

## Frontend

```powershell
cd frontend
npm.cmd ci
npm.cmd test
npm.cmd run lint
npm.cmd run format:check
npm.cmd run build
npm.cmd audit --omit=dev
npm.cmd audit
```

Build runs TypeScript before Vite. Report production and development advisories
separately. Do not force major upgrades, downgrades or peer overrides to get zero.
See the audit for remaining tooling limitations.

## Browser and visual audit

After building, from `frontend/`:

```powershell
$env:DEMO_E2E_PORT='5174'
node scripts/demo-e2e.mjs --holdings-activities
node scripts/demo-e2e.mjs --spending-migration
node scripts/demo-e2e.mjs --goals-migration
node scripts/demo-e2e.mjs --performance-insights
node scripts/demo-e2e.mjs --dashboard-migration
node scripts/demo-e2e.mjs --settings-migration
node scripts/demo-e2e.mjs --unified
node scripts/demo-e2e.mjs --themes --app-audit
node scripts/net-worth-empty-e2e.mjs
node scripts/settings-maintenance-e2e.mjs
```

Run sequentially. Runners reject occupied ports and own temporary databases under
ignored `.tmp/`. Maintenance uses port 5175 with integration workers disabled.
These commands do not restart/reset a saved personal/demo server.

The inventory captures 42 screens in light/dark at 1920x1080, 1440x900, 1280x800,
768x1024 and 390x844, then each screen in pt-BR and es-419. It waits for rendered
content and fails on document overflow, visible error alerts, unnamed enabled
controls or raw localization keys. This heuristic is not full accessibility certification.
Captures disable motion; unit tests cover live preference changes.

`AUDIT_QUICK=1` limits viewports. `AUDIT_SCREENS` accepts comma-separated inventory
IDs and writes a separate follow-up directory. For a full run, clear both:

```powershell
Remove-Item Env:AUDIT_QUICK,Env:AUDIT_SCREENS -ErrorAction SilentlyContinue
```

Evidence stays ignored in `docs/screenshots/` and `.tmp/`. Inspect paired images at
the same native size/theme; screenshots cannot certify financial calculations.
Cached reference images can predate pinned source. Document those differences;
do not claim a reference runtime capture when only official images are available.

Current results and the screen matrix: [v0.14 audit](AUDIT_V014.md).
