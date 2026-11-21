# Settings and configuration — unreleased v0.14

## Reference and design

Source remains pinned to `92b4647f74ec51fbbb1a772db4f42ea91060c518`.
Inspected SettingsLayout, SidebarNav, SettingsHeader, General, Appearance, Accounts,
Portfolios, Securities, Taxonomies, Spending overview/rules, Export/Backup and About.
Original paths and SHA256 fingerprints are recorded under `settings_files` in
`frontend/src/vendor/wealthfolio/SOURCE.json`. AGPL application and MIT shared-UI
attribution remain intact; no branding or proprietary assets are shipped.

The [official settings guide](https://wealthfolio.app/docs/guide/settings/) and its
[1440×900 screenshot](https://assets.wealthfolio.app/images/screenshots/app/settings.png)
were inspected. The image is local comparison evidence, may predate the source pin,
and is not a running upstream application. Settings section changes reset scroll without disturbing same-section filters/editors.
The adapted geometry uses a 240px sticky
sidebar, 40px gap and 1152px maximum width. Below 1024px, the index becomes a settings
list and details have a Back control. Hidden mobile content is **not mounted**, so
it cannot run effects or portaled editors. Existing `view` bookmarks remain usable.

Language stays first by user request. The application retains its own themes/fonts,
exact formatting, main sidebar and source-independent financial services.

## Confirmed boundaries — November 9, 2026

The user postponed category/taxonomy hierarchy and rollups; configurable event types;
audited FX writes and generic quote import/corrections; global provider priorities
and new browser credential configuration; contribution-limit engines; planned
income targets and manual starting rollover. Existing flat categories, event catalog,
explicit provider routing and reconstructed rollover remain authoritative.

The user approved safe personal backup/restore separately from demo reset. Small
account-group metadata and reviewed CSV/JSON exports are authorized. Groups organize
references only; named reporting scopes throughout dashboard pickers remain postponed.
No AI, cloud backup/sync, encryption engine, subscriptions or native update/menu
controls were added. The removed financial-color chooser stays removed. No floating
global navigation mode or unsupported text-size/region/timezone control is invented.

## Coverage matrix

| Area                       | Implemented behavior / explicit boundary                                                                             |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Settings shell             | Source-adapted groups, one outlet, responsive list and deep links                                                    |
| General                    | Language first, existing reporting-currency preference, browser timezone and formatting explanation                  |
| Language/region            | English, pt-BR, es-419; user/source text is not translated; no pretend locale/timezone engine                        |
| Money                      | Shared exact formatting, period thousands/comma decimal, two monetary decimals; record currencies retained           |
| Appearance                 | Six themes, legacy palettes, ten fonts, chart palettes, light/dark/system; Sidebar order last                        |
| Accounts                   | Shared main/Settings management component, search/status filter, create/edit/deactivate and original opening history |
| Account groups             | Local metadata CRUD, explicit membership, normalized names and atomic FK validation                                  |
| Spending overview          | Actual links to accounts, categories, budgets, payees, rules and Life Events                                         |
| Categories                 | Existing icon/color metadata, editing and referenced-deletion safeguards; hierarchy postponed                        |
| Investment classifications | Existing sector/geography editor; no inferred tags or custom-taxonomy engine                                         |
| Payees/learning            | Existing normalized names, raw-description separation and explicit corrections/suggestions                           |
| Rules                      | Existing search, editor, duplicate, preview and confirmed history application; metadata-only guards retained         |
| Budget setup               | Opens the migrated editor with actual targets/overrides/groups and reconstructed rollover                            |
| Life Events                | Existing catalog/events/purchase associations; configurable type catalog postponed                                   |
| Securities                 | Search/type filter, safe name edits, existing creation, classifications and exact quote history                      |
| Security identity          | Ticker/exchange/currency, acquisition history and fixed-income terms are protected                                   |
| Price management           | Existing manual close entry, per-security provider config/explicit refresh; new imports/corrections postponed        |
| Market providers           | Existing capability/configured-state/sync UI; no navigation-triggered live calls                                     |
| Demo providers             | Cache inspectable through securities; real connections/refresh remain disabled                                       |
| FX                         | Paginated dated cache, retrieval timestamps and exact 18-place observations; audited writes postponed                |
| Exports                    | Whitelisted exact CSV/JSON and existing derived holdings/history; no fabricated tax lots                             |
| Backups                    | Local bounded WAL-consistent create/download, validated upload and maintenance-only restore                          |
| Demo reset                 | Existing owned-generation reset; cannot invoke personal restore                                                      |
| Gmail                      | Existing optional OAuth/mapping/backfill/polling/disconnect/review; demo simulation retained                         |
| Pluggy                     | Existing read-only connection/consent/ingestion controls; blocked in demo                                            |
| Contribution limits        | Postponed; no country-specific retirement engine or decorative controls                                              |
| About                      | Actual version, SQLite/local deployment, repository and bundled licenses; no local paths                             |
| Platform services          | No AI, Connect, cloud, desktop updater, native menu or subscription controls                                         |

## Data and API

Migration `sqlite_0021` adds `account_groups` and `account_group_members`, with
foreign keys and composite membership identity. Names collapse whitespace and use
Unicode casefold for uniqueness. Validate every account before replacing membership;
deleting a group never deletes accounts/history. It is not a financial balance store.

`/api/settings` adds read-only `/preferences`, `/fx`, `/about`, `/exports`; metadata
CRUD at `/account-groups`; and name-only `PATCH /securities/{id}`. Exports use
`GET /exports/{dataset}?format=csv|json&as_of=YYYY-MM-DD`. Personal `/backups` routes
have additional local-origin/header guards. Existing domain APIs remain authoritative.

General writes existing MarketSettings, preserving FX/automatic settings. Dashboard,
Performance/Income and Net Worth read the shared reporting preference; explicit
currency bookmarks remain supported. This never rewrites accounts, activities,
security currencies, original-currency spending targets or FX. Missing coverage
stays unavailable. The unified demo keeps BRL and source-separation policies.

Exports whitelist columns rather than enumerate arbitrary ORM tables. Supported
datasets include accounts, transactions, activities, securities, prices/FX, manual
assets/debts and observations, goals/progress, budget configuration, rules, Life
Events, classifications and groups/members. Holdings and one-year portfolio/net-worth
histories reuse existing read services at the chosen date. Stored exports are capped
at 50,000 rows. JSON uses exact decimal strings, including all FX places. CSV retains
precision and prefixes potentially executable **text** cells with an apostrophe;
numeric Decimal signs stay unchanged. Nested rule metadata is JSON encoded.
Pretty two-decimal UI values are never authoritative exported values. No raw
source/email payload, provider credential or OAuth token is exported.

## Personal backups and restore

Backups contain private financial information and remain local in the database's
sibling `<database-stem>.backups/` directory. APIs expose opaque IDs, sizes and dates,
not filesystem paths. They require loopback, approved origin and `X-Finance-Admin: 1`.
The demo is rejected at the service boundary. Credentials remain in the OS vault.

Settings → Backup & export → Local backups creates a WAL-consistent SQLite backup.
The copy is staged, checked and atomically published. In-app files are limited to
128 MiB; copy/validation work and lock waits are bounded; insufficient disk space
fails safely. No cloud service is involved.

Restore is intentionally unavailable during ordinary financial operation. Stop
the normal backend, then start the same configured database in maintenance mode:

```powershell
# From backend/
$env:MAINTENANCE_MODE = 'true'
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Open the application normally: only the backup screen mounts. Financial API routes
return 503 and integration workers never start. A cross-process database lease
rejects another Finance Tracker API process. Use one worker and close external
SQLite tools. An optional raw SQLite upload is streamed within the 128 MiB limit,
validated locally, and never uploaded to an external service.

The user must type **RESTORE**. Validation checks header, integrity, foreign keys,
exact current tables/indexes/triggers and Alembic revision. Older/newer or different
schemas are rejected; this is not an automatic migration of arbitrary backups.
A consistent pre-restore recovery backup is retained. A separately validated copy,
successful WAL checkpoint, closed connections and atomic replacement protect
publication. On publication failure the current file remains and recovery is kept.
Maintenance remains active after success, preventing stale financial requests. The staged copy pauses automatic market updates and Gmail polling; review connections before enabling them after restart. Source backups, vault tokens and all financial postings remain unchanged.

Stop maintenance, clear the flag, then restart normally:

```powershell
Remove-Item Env:MAINTENANCE_MODE
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
```

SQLAlchemy reapplies foreign keys, WAL and the busy timeout. This is a local,
single-process workflow, not live multi-process restore. Backup pruning/encryption
is not automated. Review the restored state before removing recovery backups.

## Demo and validation evidence

The unified demo gains two deterministic metadata groups through a versioned,
additive extension. Existing group descriptions/memberships and financial edits
are preserved. Schema upgrades reuse validated-copy lifecycle; no normal database
is adopted, no financial balances change, and no screenshot reset is required.
There are no fake connected providers, automatic sync or token-vault calls.

Screenshots and gallery stay ignored under `docs/screenshots/v014-settings/`.
Completion results and known visual differences are appended after validation.

## Completed validation

- Final backend full suite: **572 passed**, with three inherited SQLAlchemy seed warnings.
  Covers populated/clean migrations, the owned v0.20 demo upgrade, exact exports,
  restore recovery, active-polling pause and existing financial regressions.
- Final frontend full suite: **328 passed / 75 files**. Existing jsdom chart-size
  and React-act warnings remain.
- Ruff lint and format, ESLint, Prettier, TypeScript and production build passed.
  The build retains the known large shared-chunk and dependency-annotation warnings;
  Settings is lazy-loaded, not added wholesale to the entry bundle.
- All **233** inventoried upstream fingerprints verified, including 19 Settings files.
- `node scripts/demo-e2e.mjs --settings-migration` (DEMO_E2E_PORT=5174) passed
  real account/category/group creation, security-name edits, protected CDB quote UI,
  all 25 supported export datasets, original balance equality, navigation, no external
  requests and 1440/1920/834/390 layouts.
- `node scripts/settings-maintenance-e2e.mjs` passed browser backup creation, download,
  validated upload, typed restore confirmation, recovery, restart, exact opening
  money, empty securities and error/retry. Its personal-style database is temporary;
  integration workers are disabled by the harness, never live OAuth or vault calls.
- The already-running owned local demo was restarted without reset. Account, security,
  portfolio, goal and net-worth API fingerprints are unchanged; new groups are ready.
  No personal financial database was migrated or restored during validation.

Local review: `docs/screenshots/v014-settings/index.html` pairs the official image
with the final 1440x900 adaptation. Additional light/dark, 1920px, tablet/phone,
security and maintenance captures are in that ignored directory. Geometry records
sidebar/content offsets. The reference has source branding and extra services; ours
intentionally omits them. Language-first ordering, our full theme/font registry,
flat classifications, account-group metadata and maintenance-only restore are
documented domain/platform differences. Dark/mobile reference-runtime parity is
not claimed from a light desktop screenshot.

No commit, merge, tag, push or version change was performed. Existing uncommitted
v0.14 work is preserved. Apply `uv run alembic upgrade head` before normal startup;
owned demos upgrade through their existing validated-copy lifecycle.
