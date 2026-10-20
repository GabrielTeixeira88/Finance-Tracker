# v0.11 product consolidation audit

Status: implementation validated for v0.11.0. See [release audit](RELEASE_0_11_0.md) for finalization checks.
Baseline: 362 backend tests and 94 frontend tests pass. The backend emits an
existing synthetic-seed connection-options warning.

## Reference inventory

Inspected before implementation:

| Reference | Concrete evidence | Pattern to adapt | Deliberate difference |
| --- | --- | --- | --- |
| Wealthfolio | Separate local reference checkout `392f272c5b15a4af45dc2ff71dcbec474f47112a`: `apps/frontend/src/pages/layouts/navigation/app-sidebar.tsx`, `pages/settings/sidebar-nav.tsx`, `pages/settings/spending/rules/spending-rules-page.tsx`, `pages/holdings/components/holdings-table.tsx`; previously captured running-reference screenshot at 1440×900 | Slim persistent sidebar, subdued selected rows, section navigation, searchable rules, compact financial tables | Preserve our ledger, exact decimal strings, and existing visual foundation; no branding or provider code copied |
| Actual Budget | Public `packages/desktop-client/src/components/rules/RuleEditor.tsx` and `components/accounts/Reconcile.tsx`; [rules documentation](https://actualbudget.org/docs/budgeting/rules/) | Separate original descriptions from classification; condition/action editing; explicit cleared-balance comparison | Keep manual-first metadata precedence and existing flat condition grammar; never create balancing adjustments |
| Securo | [Rules](https://docs.usesecuro.com/docs/features/rules), [imports](https://docs.usesecuro.com/docs/features/import), [reconciliation](https://docs.usesecuro.com/docs/features/reconciliation) | Contextual rule creation, preview before applying, staged ingestion and explicit matching | No nested rule engine, financial rule actions, or automatic posting |

The current public reference website was accessible through the browser search
tool; direct image download returned HTTP 403 and linked screenshots could not be
opened. Visual comparison uses the already captured running-reference screenshot,
not a claim to have run the latest upstream application. Source-only workflow
observations are distinguished from visual observations above. Existing license
notices remain authoritative; no reference source is newly copied for this pass.

## Findings

P0 = broken/misleading; P1 = everyday friction; P2 = consistency; P3 = polish.
Effort/risk are relative to this application. No financial defect was established
by this UI audit; passing tests alone do not prove every browser workflow.

| Area | Priority / impact | Proposed correction | Reference | Effort / risk |
| --- | --- | --- | --- | --- |
| Shell/navigation | P1: refresh/back loses destination | Bookmarkable routes and section state | Reference sidebar/settings | Medium / medium |
| Overview | P2: actions separated from review destinations | Preserve chart; contextual drill-downs | Reference overview | Medium / low |
| Accounts | P2: administration and daily activity compete | Keep account links and concise metadata | Reference financial rows | Small / low |
| Transactions | P1: eleven equal-weight filters dominate ledger | Primary filters plus advanced disclosure; retain all filters | Actual workflow | Medium / medium |
| Transaction editing | P1: repeated classification requires leaving context | Draft a rule from a selected ordinary transaction | Securo rules | Medium / medium |
| Transfers | P2: linked semantics need explanation | Retain neutral styling and atomic edit restrictions | Existing financial contract | Small / low |
| Payees | P1: rename/create buried in editors | Settings management using existing API | Actual normalization | Medium / low |
| Categories | P2: configuration location needs stable navigation | Settings deep link; preserve delete guards | Reference settings | Small / low |
| Rules | P1: basic rules expose priority and operators first | Simple condition/action entry; advanced disclosure | All three references | Medium / medium |
| Rule suggestions | P2: adoption differs from direct rules | Preserve preview and explicit approval | Actual / Securo | Small / medium |
| Schedules | P2: expectations can resemble posted activity | Preserve explicit posting and occurrence status | Actual workflow | Small / medium |
| CSV imports | P1: upload/mapping/review stages unclear | Persistent stage context; preserve mapping profiles | Securo import | Medium / medium |
| OFX imports | P2: same destination, different parsing controls | Shared review path; format-aware configuration | Securo import | Small / medium |
| Gmail | P1: configuration/review destinations disconnected | Stable section links; explicit opt-in context | Existing ingestion contract | Medium / medium |
| Source review | P2: technical provenance competes with decisions | Keep source details secondary; never discard provenance | Securo | Medium / medium |
| Matching | P2: proposals must not appear authoritative | Preserve explicit accept/reject and identity warnings | Securo | Small / medium |
| Reconciliation | P1: clearing versus review easily confused | Visible workflow explanation; retain exact difference | Actual reconciliation | Small / medium |
| Spending | P2: drill-down state disappears after navigation | Persist destination filters | Reference spending | Medium / medium |
| Budgets | P2: advanced target/rollover controls compete | Disclosure without changing monthly targets | Existing budget contract | Medium / medium |
| Investments | P2: many activity/valuation views | Keep scope context and missing-coverage states | Reference holdings | Medium / medium |
| Performance | P2: incomplete coverage requires clear labels | Preserve unavailable returns and benchmark distinctions | Existing analytics contract | Small / medium |
| Market data | P2: configuration separate from stale quote context | Keep explicit refresh, adapter errors and settings | Existing market contract | Small / medium |
| Net Worth | P2: financial/manual observation hierarchy | Preserve dated observations, currency and coverage | Reference hierarchy | Medium / medium |
| Goals | P0: reached milestones looked like actual progress; P2: allocation/scenario terminology | Label exact actual progress separately; retain milestone history and scenario distinction | Existing wealth contract | Small / medium |
| Settings | P1: sections not bookmarkable; payees absent | Consistent section navigation and payee management | Reference settings | Medium / low |

## Workflow map

1. Account → opening record → activity: Accounts creates; account row opens scoped ledger.
2. Manual transaction → classification → review: Transactions posts through existing service; metadata stays separate.
3. Transaction → rule draft → preview → save: no financial mutation; historical application remains explicit.
4. Schedule → occurrence → match/post: expectations never become entries without user action.
5. CSV/OFX → mapping → candidate → duplicate decision → confirm: source retained; only confirmation posts.
6. Gmail configuration → sync → candidates → approve/link/skip: read-only provider; no automatic posting.
7. Source matching → transaction link → clearing → statement completion: review and reconciliation remain separate.
8. Expense/refund → Spending → budget target → filtered ledger: exact shared spending classification.
9. Investment activity → cash/holding → price/FX → Performance: no ordinary-transaction twins or fabricated returns.
10. Asset/debt observation → Net Worth: dated manual history, no cash posting.
11. Goal → shared allocation → shortfall/projection: existing savings only; scenarios are not actual returns.

## Validation plan

Capture the twelve requested screens before/after at matching desktop sizes.
Exercise browser history, deep links, mobile drawer, advanced forms and each
financial journey against isolated synthetic databases. Preserve all baseline
tests; add interaction coverage. Run backend/frontend tests, lint/format, build,
and migration checks. Record actual results and remaining work before declaring
completion. Screenshots and generated databases stay in ignored `.tmp`.

## Implementation disposition

Implemented the P1 route/history, ledger-filter, contextual-rule, basic/advanced
rule, rule-search/duplicate, payee-management and workflow-discovery fixes.
Shared section navigation replaces duplicated settings/transaction navigation.
Gmail configuration and review now link directly; imports expose stage context;
reconciliation explains evidence, clearing and zero-difference completion.

The visual pass retains the approved shell and chart geometry. It reduces ledger
row height and technical clutter, moves evidence to an accessible icon, adds
consistent destructive action treatment and fixes an obsolete Net Worth preview
tooltip. New controls use existing semantic tokens. Overview has direct review
and spending actions. Spending targets disclose advanced rollover/order controls.
Holdings gain original-currency filtering and a truthful filtered-empty state.
Performance explains TWR versus XIRR; Goals shows remaining values in its list.
Visual review caught a goal at 48% displaying its 25% reached milestone without a
label. Actual progress now uses the exact API ratio; milestones have their own
caption and unavailable coverage has no misleading zero-valued progress bar.
This is a presentation correction, not a change to goal/account calculations.
CSV mapping controls now appear only after choosing a file.
Wealth/goal queries gain retries and their shared form gains cancellation and a
pending-field guard.

Retained after review: context-sensitive investment activity fields, exact
valuation gaps, existing schedule expectation/posting separation, source audit
details, native confirmation dialogs, loan/property linkage and hypothetical goal
projections. These capabilities already implement the required domain separation;
no replacement financial engine or gratuitous dashboard rearrangement was warranted.
Reports remains a preview. No production backend, API or migration changed.

### Remaining presentation debt

- Detail selections and unsaved drafts are not route-persisted.
- Rules retain the existing flat grammar; no nested groups/regex are invented.
- The 50-match payee API needs refined search for larger lists.
- Some legacy inner analytics tabs still use their existing compact controls.
- Formal screen-reader and WCAG certification is not claimed.
- Browser scenario helpers remain local validation artifacts; a maintained demo/E2E
  harness is a v0.12/v0.13 deliverable.
- Existing dependency annotation and bundle-size build warnings are not hidden.

### Browser evidence

Validation uses isolated synthetic SQLite databases. A read-only frontend snapshot
of the original commit and the updated frontend share an untouched synthetic API
for like-for-like comparisons. Both versions are captured at 1440×900 and
1920×1080; updated pages also run at 768 and 390 pixels. Screenshots wait for
financial loading states to resolve. Files are ignored under `.tmp/v011-*`.

Exercised: account/income/expense/transfer and 5300/2500 balances; budget
targets/overrides/rollover/refunds; CSV mapping, duplicate decisions and confirmation;
mocked Gmail OAuth/configuration/sync/review/approval/spending/disconnect;
source evidence/linking/clearing/statements/reopen; investment funding, activities,
weighted basis, manual prices, holdings, imports and analytics ranges/coverage;
manual assets/debts/disposal and shared goal allocations/projections.

New workflow walkthrough verifies contextual rule preview/save, disabled
duplication, status filtering, payee create/rename/search and unchanged balances.
Routing checks exercise bookmark reload, exact filters, browser Back, page finder
and mobile drawer. Light mode is checked on the payee screen. These are synthetic
browser checks, not claims of live bank, Gmail or market-provider validation.

### Final validation results

| Check | Command / evidence | Result |
| --- | --- | --- |
| Backend suite | `.venv/Scripts/python.exe -m pytest -q` from `backend` | 362 passed; existing seed connection-options warning |
| Frontend suite | `npm.cmd test` from `frontend` | 104 passed across 19 files; baseline 94 |
| Backend lint/format | `backend/.venv/Scripts/ruff.exe check backend`; `backend/.venv/Scripts/ruff.exe format --check backend` | Passed; 113 files formatted |
| Frontend lint/format | `npm.cmd run lint`; `npm.cmd run format:check` from `frontend` | Passed; zero ESLint warnings |
| Type checking / production build | `npm.cmd run build` from `frontend` | Passed (TypeScript and Vite) |
| SQLite | Fresh isolated migration plus populated-migration regression tests | Head `sqlite_0013`; foreign keys on, WAL, 5000 ms busy timeout |
| Browser workflows | Local Playwright/Edge scripts described above | Passed with synthetic databases; Gmail provider mocked |
| Visual comparison | Twelve screens before/after at 1440×900 and 1920×1080; updated 768/390 widths | No document-level horizontal overflow; dense tables retain local horizontal scrolling |
| Privacy | Local audit of 269 nonignored working files and 544 historical blobs | No findings; generated databases, screenshots and builds ignored |
| Diff hygiene | `git diff --check` | Passed; no staged files |

The main JavaScript bundle decreased from 636.77 kB (181.28 kB gzip) to
542.28 kB (159.23 kB gzip) through page-level lazy loading. The existing Zod
annotation and greater-than-500-kB chunk warnings remain; this is not a claim
that all frontend performance work is complete.

A repeated wealth browser run initially selected an already disposed synthetic
asset from a previous run and timed out waiting for its valuation form. Rerunning
with distinct synthetic record names passed asset/history, debt, goal, projection
and disposal checks. No financial behavior was changed to satisfy the test.

Implementation changed no backend behavior, API contract, schema or dependencies.
Release finalization synchronizes version 0.11.0. User databases were not reset or
migrated. The results above record implementation validation; release reruns are
recorded separately in RELEASE_0_11_0.md.

## Release issue disposition

Each area from the findings table is classified below. No unresolved P0/P1
workflow blocker was found in the tested scope.

| Audit areas | Status | Evidence / remaining boundary |
| --- | --- | --- |
| Shell/navigation; Transactions; Transaction editing | Resolved | URL/history/filter tests and browser rule-draft journey |
| Payees; Categories; Settings | Resolved | Settings routes, create/rename/search and preserved category guards |
| Rules | Resolved | Simple entry, advanced retention, preview, disabled duplicate, manual-precedence tests |
| CSV imports; OFX imports; Gmail | Resolved | Real API browser journeys, explicit stages and review; Gmail transport mocked |
| Reconciliation | Resolved | Source link, clearing, exact statement completion/reopen and audit journey |
| Goals | Resolved | Exact 48% progress versus 25% milestone regression and allocation/projection journey |
| Overview; Accounts; Transfers | Resolved | Reference layout retained, account navigation and exact transfer regression |
| Rule suggestions; Schedules | Resolved by retention and validation | Existing explicit approval/posting preserved; no new automation engine |
| Source review; Matching | Partially resolved | Stage/context improved; detailed source controls remain deliberately secondary |
| Spending; Budgets | Partially resolved | Ledger drill-down filters persist; advanced targets disclosed; selected month itself is not bookmarked |
| Investments; Performance; Market data | Partially resolved | Section bookmarks, holdings filtering and coverage explanations; detailed account/date/analytic selections remain local |
| Net Worth | Partially resolved | Section routes, retry/cancel/pending guards; individual asset detail not bookmarkable |

Deferred with justification: draft recovery, uniform legacy inner-tab controls,
formal assistive-technology certification and a maintained browser fixture runner
belong to the demo/stability milestones. No financial semantics were relaxed to
simplify the UI. The original root URL still opens Overview; the prior release
used in-memory navigation and exposed no stable section URLs requiring redirects.
