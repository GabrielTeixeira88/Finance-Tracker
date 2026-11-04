# Continuous integration

`.github/workflows/ci.yml` is named **CI**. It runs on pull requests targeting
`main`, pushes to `main` and `feature/**`, and manual dispatch. Manual dispatch is
available from Actions after the workflow is merged to the default branch.
Concurrency groups share the source repository/branch across push and PR events;
new runs cancel superseded runs. Already completed push/PR runs are not deduplicated.

Ubuntu 24.04 jobs use Python 3.13 (matching `backend/.python-version`), uv 0.12.19,
Node 22 and lockfile installations. Actions are pinned to reviewed official release
commit SHAs. uv/npm dependency caches exclude application data. Token permissions
are `contents: read`; checkout does not retain credentials. No deployment, publishing,
release tagging, banking credentials or paid GitHub features are involved.

## Jobs and local equivalents

| Job | Commands |
| --- | --- |
| Backend tests and migrations | In backend: `uv sync --frozen`; `uv run --frozen --no-sync ruff check . ../scripts`; `uv run --frozen --no-sync ruff format --check . ../scripts`; `uv run --frozen --no-sync pytest` |
| Frontend tests and build | In frontend: `npm ci`; `npm test`; `npm run lint`; `npm run format:check`; `npm run build` |
| Isolated demo browser | Sync backend, install frontend and build; in frontend run `npx --no-install playwright install --with-deps chromium`, then `BROWSER_CHANNEL=chromium npm run test:demo` |
| Production dependency audits | Export locked production Python dependencies, then run `scripts/ci_audit.py` as described below |

The build includes `tsc -b`. Backend fixtures run Alembic upgrade/check on temporary
databases; the full suite includes fresh/populated migrations, foreign keys, WAL,
exact accounting, demo determinism and normal/demo isolation. CI's fallback database
path is `.tmp/ci-normal.db` inside the disposable checkout, never a personal workspace.
All provider credentials are empty and the system token vault is disabled in CI.
Provider/OAuth unit tests use fake transports/vaults; no live financial APIs are needed.

The demo job waits for backend/frontend success, installs the Chromium version
matched to the locked Playwright package and runs one browser against a fresh local
FastAPI process. It uses real services and migrated synthetic SQLite, not mocked
financial HTTP responses. It verifies navigation, history/charts, transaction edits,
transfers, budget/goal/category edits, sample imports, simulated Gmail review/approval,
reconciliation, reset and desktop/mobile layouts. Gmail MIME is synthetic, market/FX
history is seeded, and normal integration workers never start. Port 8001 must be free;
use `DEMO_E2E_PORT=5174` locally if needed. PowerShell uses
`$env:BROWSER_CHANNEL='chromium'` and `$env:DEMO_E2E_PORT='5174'` before the command.

## Dependency audit policy

From the repository root (create `.tmp/ci` first):

```sh
uv export --project backend --frozen --no-dev --no-emit-project --format requirements-txt --output-file .tmp/ci/python-requirements.txt
uv run --no-project --python 3.13 python scripts/ci_audit.py
```

- npm audits the committed lock with `npm audit --omit=dev --audit-level=high --json`.
  High/critical production advisories fail the job. Lower-severity advisories remain
  visible in the report; development-tool advisories are outside this gate.
- Python uses pinned `pip-audit==2.10.1` in an isolated uv tool environment, auditing
  the exact production export with hashes, no dependency resolution or installation
  of project requirements. Any reported production vulnerability fails. The current
  platform's applicable requirements are audited; this is not a Windows dependency scan.
- Neither tool fixes packages automatically. Unknown errors, malformed reports and
  skipped Python packages fail rather than being reported clean.
- Recognized network/service outages retry three times with bounded waits/timeouts.
  Exhaustion emits an Actions warning and **unavailable** in the job summary, without
  failing otherwise valid checks solely because the advisory service is down.
  This is an incomplete audit, never a clean security result. Rerun before release;
  no release acceptance should rely on an unavailable audit.

Package names/versions and hashes are sent to public advisory registries. No financial
data, SQLite files, OAuth tokens or private configuration are sent.

## Diagnosing failures

Open the repository's **Actions > CI**, select the run and failing job/step. Backend
and frontend failures retain JUnit reports. Demo failures retain console/server logs,
available synthetic screenshots and `failure.json`; a failure exits nonzero even if
log output is piped through `tee`. Audit JSON and status summaries are retained on
success or failure. Artifacts expire after seven days. Uploads use explicit file
allowlists: no database/WAL/SHM, `.env`, dependencies, personal imports or broad `.tmp`
directory uploads. All images come from the runner's fictional workspace.

Local test success does not establish hosted CI success: inspect the actual commit's
Actions conclusion. This workflow has no deploy step and adds no branch protection
rules. Changing the GitHub default branch is separate from committing this workflow;
select `main` under repository Settings > Default branch. Preserve the checkpoint
branch. Workflow changes must be reviewed and merged before `main` has these checks.
The README badge currently tracks `feature/v0.13.0-stabilization`, whose first CI run
passed. Point it at `main` after the workflow is merged and that branch passes CI.
