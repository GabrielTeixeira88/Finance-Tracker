# Goals and Savings Planner — v0.14 migration

Unreleased implementation on `feature/v0.14.0-frontend-refinement`. Version metadata
remains 0.13.0. This migration preserves the preceding Holdings, Activities,
Spending, Budgets, Income, Insights and Net Worth work; it does not publish a release.

## Source and compatibility

Pinned upstream: [`92b4647f74ec51fbbb1a772db4f42ea91060c518`](https://github.com/wealthfolio/wealthfolio/tree/92b4647f74ec51fbbb1a772db4f42ea91060c518).
Source files/hashes: `frontend/src/vendor/wealthfolio/SOURCE.json`, `goals_files`.
The dashboard, cards, creation/detail/edit pages, funding layout, Save Up workspace,
projection card, milestone rail and lever controls retain actual source structures.
Local compatibility hooks replace upstream DTOs, Rust/platform calls, navigation
and monetary Number calculations. Shared source DatePickerInput, Calendar RAC,
DateField RAC and Textarea retain MIT notices; Goals source/illustrations retain
AGPL attribution. React Aria/date runtime licenses and existing Merriweather OFL
notices are bundled locally. No branding, reference screenshots or retirement art
are shipped. See `THIRD_PARTY_NOTICES.md`.

The feature-page fetch failed; the official [Goals guide](https://wealthfolio.app/docs/guide/goals/)
was accessible. Visual validation uses the previously approved cached official dark
detail at 1440×900 and a light marketing composite. They may predate the code pin;
no running upstream application is claimed. The composite is not a same-viewport
reference. Additional desktop/tablet/mobile captures are source-guided checks.

## Approved capability boundaries

The user approved saved goal types/templates and per-goal monthly assumptions,
plus archive restoration and soft deletion with retained history. Expected-return
compounding/rate persistence, return uncertainty, percentage-of-account funding
and Retirement/FIRE remain postponed. No AI, risk simulation, tax-aware funding,
rebalancing or automatic goal transactions are introduced. No further decision is
pending for this migration.

Five editable templates: Education, Home Purchase, Car Purchase, Wedding and
Savings Goal. Template target amounts are editable form defaults, never portfolio
data. Existing manual/account modes and original currencies remain explicit.
The expected-return control stays visible at zero, disabled with an explanation.

## Financial contract and additive storage

`sqlite_0019` creates four tables only: `goal_plans`, `goal_lifecycle`,
`goal_entry_epochs` and `goal_investment_funding`. Existing financial/goal tables
and rows are not rewritten. Old archived dates are backfilled into dated lifecycle
events. Foreign keys, exact-money constraints and serialized writer transactions
remain enforced. Migration tests compare every pre-existing row and check integrity.

- Plans store a supported type and exact monthly assumption. Target/deadline and
  assumption changes save atomically; previews use a detached view and never write.
- Previews start from authoritative saved progress. Future equal contributions occur
  at month ends; no investment return is assumed. Required monthly amounts round
  upward to a cent. The existing 50-year horizon and missing-coverage guards remain.
- Actual history uses manual entries, fixed dated allocations or the reserved
  investment account's existing gross dated valuation. No synthetic progress is
  reconstructed from a current total. Chart coordinates alone are dimensionless.
- Milestones show exact 25/50/75/100% thresholds. Dates say **First recorded**,
  **Estimated**, or unavailable, without claiming an unobserved achievement date.
- Goal-only changes never post cash or add assets to Net Worth. Manual progress is
  planning history, not a second bank account. Caixinha progress reuses the existing
  fixed-income valuation; no duplicate RDB, interest payment or asset is created.
- Fixed cash allocations share eligible same-currency balances. Whole investment
  accounts are exclusive reservations, not upstream percentage shares. Corrections
  retain voided entries. Multi-account updates roll back together on failure.
- Archive/delete releases reservations on its dated event. Restoration retains
  history but starts an empty funding epoch: money is never silently reclaimed.
  Manual historical progress is retained. Backdated release cannot erase later
  recorded funding; start edits cannot exclude lifecycle history.
- Soft deletion retains all records and hides the goal from listing. History remains
  retrievable; subsequent mutation is rejected. It is not reversible via the UI.

New/extended APIs follow existing `/api` patterns:
`POST /goals` (type/monthly), `GET /goals/{id}` (saved plan, lifecycle, milestones,
allocations), `POST /goals/{id}/preview?as_of=`, `PUT /goals/{id}/plan`,
`PATCH /goals/{id}/metadata`, `PUT /goals/{id}/funding`,
`POST /goals/{id}/status` (effective date), `DELETE /goals/{id}` (soft).
Existing entry/void/shared-allocation endpoints remain available.

## Interaction conventions

Dashboard cards open `#/goals?goal=<id>`; `?new=true` opens source templates.
Saved assumptions are read separately from debounced in-memory scenario drafts.
Save persists, Cancel/reset restores saved assumptions, and leaving a dirty scenario
requires a discard choice. Drafts are never stored in localStorage. Existing hash
bookmarks/back navigation and TanStack Query invalidation remain in use.

The funding card offers fixed amounts or eligible whole-account selection, a
source-style read/edit layout and a detail sheet with shared savings and original
entry/correction history. Manual goals use contribution/withdrawal actions.
Metadata/status use the source edit dialog; archive/restore/delete use explicit
confirmation. Desktop/mobile milestones retain the original rail/list composition.

The source detail grid remains 2:1 at desktop with a 24px gap; chart height is 300px.
Dashboard uses three columns at wide desktop, two at smaller widths, one on mobile.
Exact Brazilian-format financial labels require more endpoint-label space than
upstream's abbreviated labels. Recorded discrete allocations use steps; hypothetical
monthly scenarios use linear guides, with genuine null gaps preserved. Reduced
motion disables chart/CSS transitions. The underlying decimal strings remain exact; the table/tooltips use the shared two-decimal display.

## Demo content

The owned unified BRL demo retains its five existing goals and gains two records:

| Goal | Funding / saved at 2026-09-30 | Scenario / state |
| --- | --- | --- |
| Emergency reserve | Existing Caixinha gross valuation, unchanged | 100/month; active |
| Vacation | Existing 6,000 fixed savings allocation | 400/month; on track |
| Vehicle upgrade | Existing 1,000 fixed allocation | 200/month; off track |
| Design course | Existing 3,000 manual progress | Completed |
| Home studio | Existing 2,000 manual progress | Paused |
| Wedding celebration | 1,000 + 2,000 + 2,500 − 700 = 4,800 | 1,200/month; 20,000 target by 2027-09-30; at risk |
| Photography workshop | 300 + 400 + corrected 500 = 1,200 | Archived; original 600 entry retained as voided |

Wedding entries are dated 2025-11-01, 2026-02-01, 2026-05-01 and 2026-07-01.
Photography entries are dated 2026-01-15, 2026-02-15 and 2026-03-15; archive is
2026-05-31. New records use stable UUIDs and fixed timestamps. A versioned fixture
marker prevents duplication/overwriting saved edits. No cash/quote/asset postings
are added. Reset/restart tests use disposable owned demo roots; personal data and
archived scenarios remain untouched. Launch instructions: [DEMO.md](DEMO.md).

## Coverage matrix

“Adapted” means actual source JSX/layout/interaction plus local exact API adapters;
it does not imply identical financial models or a running reference application.

| Component | Upstream copied | API integrated | Demo populated | Visual parity | Tests |
| --- | --- | --- | --- | --- | --- |
| Goals Dashboard | Adapted page/hook | Existing list | 7 goals | Source grid/summary | UI + browser |
| Goal Cards | Adapted card/progress + licensed art | Detail summaries | Varied states | Source covers/status/rows | UI + captures |
| Goal Creation | Adapted source form/flow | POST goal | Browser-created record | Source page/cards | UI + browser |
| Goal Templates | Source template composition | Saved type | 5 types | Licensed source illustrations | Browser + model checks |
| Goal Details | Adapted source page/actions | Detail/metadata | All goals | Paired dark 1440×900 | UI + browser |
| Savings Overview | Source hero/callouts | Exact projection adapter | Varied funding/status | Source 2:1 workspace | Backend + browser |
| Funding Editor | Source card/read/edit/sheet layout | Atomic fixed/manual APIs | Cash/manual/Caixinha | Fixed amounts replace shares | Backend + browser |
| Funding Source Selection | Source account-list pattern | Currency/exclusivity guards | Existing reserves | No percent allocation engine | Backend + browser |
| Historical Progress | Source chart plus actual series | Existing historical service | Dated entries/accrual | Steps for discrete progress | Backend + browser |
| Savings Projection | Source chart/header/guide | Zero-return trajectory | Real saved balance | No unsupported range bands | Backend + captures |
| What-if Controls | Source lever/sidebar | Read-only preview / explicit save | Saved assumptions | Source controls | UI + browser |
| Target Date Controls | Source RAC picker | Preview/save dates | Varied deadlines | Source calendar | Browser validation |
| Monthly Contribution Controls | Source lever/slider | Exact decimal assumptions | 0/100/200/400/1,200 | Dimensionless slider only | UI + browser |
| Milestones | Source desktop/mobile rail | Exact historical/estimated dates | Reached/estimated/unknown | Source rail/markers | Backend + UI + browser |
| Goal Editing | Source dialog | Atomic metadata | Browser edit | Source fields/status choices | Browser + backend |
| Status Management | Source actions/choice cards | Dated lifecycle | Active/paused/completed | Retained local semantics | Backend + browser |
| Archiving | Source action/confirmation | Release + restore epochs | Archived workshop | Source disclosure/cards | Backend + browser |
| Deletion | Source confirmation | Retained tombstone | Disposable browser goal | No destructive row deletion | Backend + browser |
| Mobile Layouts | Source stacking/rail + existing drawer | Same real APIs | Same demo | 390/768 captures | Browser overflow/navigation |

## Validation record — 2026-11-08

- **535 backend tests pass**, including fresh/populated Alembic upgrades, retained
  row comparisons, SQLite foreign-key/integrity checks, exact saved plans/previews,
  atomic multi-account rollback, archive/restore epochs, same-day reallocation,
  explicit investment re-reservation, retained deletion and demo repeat/reset isolation.
  The original 5,300 / 2,500 account and 1,000 / 200 cash-flow regressions still pass.
- **308 frontend tests pass across 71 files**. Added source-control, huge/localized
  exact draft, slider, milestone, unsaved-navigation, empty/error/separate-currency
  and repeated lifecycle-dialog coverage. The delayed-response test verifies that
  confirmations remain open/disabled until the real API operation finishes.
- Ruff check/format, ESLint, Prettier, TypeScript and production build pass.
  All **162** inventoried upstream file hashes verify against the pinned checkout.
- The isolated real browser suite passes creation/templates, metadata editing,
  date/target/monthly preview changes, cancel/save, dirty navigation keep/discard,
  manual contribution/withdrawal, exact savings allocation, archive/restore without
  reclaim, soft deletion, preserved Caixinha value, real tooltips and milestones.
  Account balances and the complete Net Worth response are identical before/after
  goal-only mutations. It uses a new owned SQLite root, not saved/personal databases.
- Dark captures: 1440×900, 1920×1080, 1024×900, 768×1024 and 390×844; light
  dashboard/detail: 1440×900. Mobile drawer, milestone rail and metadata dialog
  work. The phone chart measures **324×300px**, SVG width 324, with four nonempty
  curve paths. A mobile max-width regression that collapsed Recharts' measured
  wrapper is removed and directly guarded in the browser test.
- Existing Spending/Budgets and Holdings/Activities browser suites also pass.
  Other finance/import/Gmail/fixed-income regressions are covered by the backend
  suite; no real mailbox, credentials, provider refresh or public service was used.
- Reference and Finance Tracker dark detail captures are paired at 1440×900.
  Hero/sidebar start at y=101; chart starts at y=542 (cached reference y=541).
  The 2:1 grid, 24px gutter, source typography/controls and 300px chart are retained.
  Dashboard comparison uses source and a marketing composite, not an identical
  running reference. No blanket pixel-perfect parity claim is made.

Local review gallery: `docs/screenshots/v014-goals/index.html`; machine-readable
checks: `validation.json` and `mobile-chart-geometry.json` in that directory.
Captures, logs, databases and temporary references remain ignored. No Git publishing
was performed. Personal and saved normal databases were not migrated or reset by
these checks. Normal installations must apply Alembic through `sqlite_0019` before
using new write APIs; the owned demo lifecycle performs its reviewed upgrade itself.

### Commands

From `backend/`: `.venv/Scripts/python.exe -m pytest -q`,
`.venv/Scripts/ruff.exe check .`, `.venv/Scripts/ruff.exe format --check .`.
From `frontend/`: `npm test`, `npm run lint`, `npm run format:check`, `npm run build`.
Browser checks (after building): set `DEMO_E2E_PORT=5174`, then run
`node scripts/demo-e2e.mjs --goals-migration`, `--spending-migration` and
`--holdings-activities` separately. They refuse an occupied port and own fresh roots.

## Remaining differences and limitations

- Funding uses exact fixed amounts / an exclusive investment account rather than
  percentage shares, and does not reclaim released reservations on restore.
- Expected return stays disabled at zero. Compound returns, uncertainty/risk bands,
  retirement/FIRE, percentage funding and tax-aware liquidation are not implemented.
- Full two-decimal BRL values reserve a wider chart endpoint-label gutter than
  upstream's compact labels. Recorded progress has a separate step series; future
  scenario values are explicitly hypothetical. Existing fonts/themes/branding and
  actual Finance Tracker data are preserved, so colors and content can differ.
- A running upstream runtime was unavailable; cached reference captures may predate
  the pin. Additional resolutions are source-guided layout checks.
- Soft-deleted goals retain history but have no restore UI; restoration applies to
  archived goals. Goal target/deadline edits use the current target when displaying
  historical progress; they do not version target assumptions or rewrite entries.
- Nonblocking inherited warnings: three demo seed SQLAlchemy connection warnings,
  dependency comment annotations and the existing shared production bundle >500kB.
  No new financial engine or unrelated bundle redesign was added to suppress them.
