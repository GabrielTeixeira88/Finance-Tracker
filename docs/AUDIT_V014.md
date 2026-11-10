# v0.14 application audit and stabilization

> **Historical pre-approval evidence.** The investigation and results below are
> retained as recorded, including old grants, hashes and pending decisions.
> On 2026-11-10 the owner approved AGPL-3.0-only for original work and accepted the
> documented development-only minimatch risk for this merge. The current decision,
> asset exclusions and source-access implementation are in
> [v0.14 finalization](FINALIZATION_V014.md). No local tests or audits were rerun.

Follow-up, 2026-11-10: [licensing and dependency review](COMPLIANCE_SECURITY_V014.md)
now documents the backend's GPL-covered OFX dependency, Options A-D, file-level
inventories and exact approval requirements. Root licensing remains unchanged.
The ten development audit entries trace to one minimatch advisory; no compatible
parent-range fix was available. Existing public distribution and remaining notice/
source-access clearance require review before further publication.

Audit dates: 2026-11-09 through 2026-11-10. Working branch: `feature/v0.14.0-frontend-refinement`.
The released version remains 0.13.0. This is an unreleased working-tree audit,
not a release approval. Existing migration changes are preserved.

## Boundaries and evidence

- The user confirmed one unified demo, retaining official CDI/Treasury provenance,
  fictional security prices, and archived regression-only scenario factories.
- All browser writes use runner-owned temporary databases under ignored `.tmp/`.
  No personal database or existing saved demo is reset, restored or modified.
- No live Gmail/Pluggy authorization, market refresh, token-vault access or paid
  integration is part of this audit.
- Reference source: `92b4647f74ec51fbbb1a772db4f42ea91060c518`, per
  [the pinned workflow](FRONTEND_V014_WORKFLOW.md). Cached official screenshots
  are the previously approved fallback. They can predate that revision; source
  behavior takes precedence over older screenshots where they differ.
- The reference runtime is unavailable. A native official 1440×900 screenshot
  comparison is possible; other resolutions are local responsive checks, not
  new captures of the reference application.
- Evidence is generated locally in ignored `docs/screenshots/v014-audit/`, with
  `index.html`, `audit-results.json` and native viewport images. Workflow suites
  retain their own `v014-*` evidence directories. Screenshots are not published.

## Issue ledger

| ID | Severity | Finding | Resolution/status |
|---|---|---|---|
| A01 | Release blocker | Root all-rights-reserved license does not resolve distribution of the adapted AGPL frontend | User chose separate licensing review; preserve notices, do not relicense or publish |
| A02 | P2 | Six appearance previews created nested main landmarks | Replaced preview landmarks with styled divs; regression asserts a single main |
| A03 | P2 | Export dataset labels fell back to technical English identifiers | Added EN/pt-BR/es-419 labels, leaving API dataset identifiers unchanged |
| A04 | P2 | Unified demo securities lacked classification metadata; schedules had no example | Additive, versioned fictional classifications and one rent expectation; no ledger postings or ETF look-through |
| A05 | P3 | Dashboard tabs touched the top/left content edge rather than the reference gutter | Restored 16px dashboard top and tab-inline gutter; retain compact mobile navigation |
| A06 | P2 | Older unified smoke suite expected five goals/old totals and obsolete CSS; App test expected the former Settings heading level | Update checks to the migrated screen contracts, preserving financial/reset assertions |
| A07 | P2 | Current scope docs/changelog still claimed v0.14 was unimplemented | Correct current working-tree scope; retain historical release records |
| A08 | P2 | Classic dark muted text measured 4.26:1 on raised cards | Raise muted luminance by two HSL points; remove the Classic contrast exemption in browser validation |
| A09 | P2 | New inventory runner allowed a port rejected by demo origin policy, so screenshots could be blank | Keep the supported origin, require the rendered main landmark, reject blank results; regenerate captures |
| A10 | P2 | Security detail tabs measured 396px inside a 374px phone content area, widening the document to 404px; source hashes also lacked wrapping | Constrain the tab strip while preserving its internal horizontal scrolling; wrap hashes/URLs without truncating them; add phone regressions |
| A11 | P2 | Manual asset category/liquidity badges showed raw canonical enums | Shared localized enum labels in details and liquidity controls; preserve API values and custom category text |
| A12 | P3 | Insights placed the translated `under/over by` phrase after its amount | Restore the pinned source prefix ordering; no financial or translation-value changes |
| A13 | P2 | Development audit reported mocker/minimatch advisories | Patch Vitest to 4.1.12; 10 moderate development-only minimatch-related entries remain; no compatible upstream-range fix; no forced downgrade/override |

## Screen and workflow inventory

The automated inventory covers dashboards, Holdings investment/assets/liabilities
tabs, security/property/vehicle/account detail, investment activity, transactions,
review filters, bank/investment imports, reconciliation, schedules, Budget,
Spending Insights, Life Events, Goals and goal detail/planner, Performance,
Portfolio Insights, received/accrued Income, Accounts, Settings index and fourteen
configuration subpages.

Important nested interactions are covered separately: transaction/investment
creation and correction, transfer posting, quote history, manual valuation edit,
budget editor/override/rollover, event association, goal planning/allocation/
archive/restore, widget customization, allocation targets, filters/ranges,
exports, and personal-style backup upload/restore/restart/recovery. A rendered
page alone does not count as financial or interaction verification.

## Demo content added during stabilization

`app.demo.audit_content` extends only an owned unified fixture, once per version.
It fills missing classification records, preserving any existing user metadata,
and creates an October rent expectation through the schedule service. The
expectation does not post spending, reserve funds or imply automatic posting.
Fictional security classifications are descriptive metadata, not researched fund
exposures, custom taxonomies or ETF look-through. Official fixed-income valuation
and synthetic security price provenance remain separate.

## Licensing release gate

The root license expressly grants no general open-source redistribution rights.
Adapted upstream application source carries AGPL-3.0-only terms, shared components
have their own MIT grants, and bundled fonts have OFL notices. These notices do
not by themselves establish a compatible license for the combined distributed
frontend. The user explicitly requested recording this as a blocker for separate
review. No relicensing decision, legal certification, release or publication is
made here. Preserve the complete source record and license texts in
`THIRD_PARTY_NOTICES.md`, `frontend/public/licenses/` and the source manifest.

## Financial reconciliation

The executed Holdings/Activities browser flow creates isolated accounts and posts
the required opening/income/expense/transfer scenario through the actual forms.
Checking ends at `5300.000000`, Savings at `2500.000000`; reporting changes by
`1000.000000` income and `200.000000` expense, excluding the transfer. Metadata
review preserves balances. Bank preview does not post; confirmation yields
`67.500000` cash. Investment purchase changes cash from `100.000000` to
`49.000000`; void restores `100.000000`. Investment import preview remains
unposted; confirmed purchase leaves `75.000000`.

At 2026-09-30 in the untouched unified fixture, the investment Dashboard account
values sum exactly to portfolio/performance `126859.330460`. Household assets
`648286.200760` minus liabilities `164000.000000` equal Net Worth
`484286.200760`. The five-driver Net Worth bridge sums to the period change.
Goals refer to existing savings/holdings and do not add assets. The emergency
reserve is `3865.733100`, the Caixinha gross valuation, not another cash account.

The 1Y Performance check reports TWR `14.785959`%, XIRR `14.782864`%, ending
value `126859.330460` and net external flows `2200.000000`. The period gain
is `16208.814430`; deposits are excluded from that gain. Received income totals
`2564.587500` across 135 cash payments/10 sources; unreceived CDB/RDB accrual is
separate. These are deterministic fictional holdings and distributions, not live
investment results. Official fixed-income observations retain separate provenance.

Backend tests independently exercise Decimal/ExactMoney storage, weighted cost,
oversells, atomic transfers, cash-flow-adjusted TWR/XIRR, missing dates/FX, raw
versus adjusted/synthetic sources, CDB/RDB lots/IR/IOF, Treasury prices/redemption,
refunds, budgets/rollover, dated manual observations, goal reservations and reset
isolation. Passing browser rendering is not substituted for these financial tests.

## Screen matrix

V = Verified; L = Verified with limitations; P = Postponed; U = Unsupported.
Every listed local screen is included in the viewport/locale inventory. Visual
status V requires an inspected paired image; source inspection alone is L.
Workflow evidence IDs below refer to the executed scripts and their ignored
`docs/screenshots/v014-*` directories. Metadata-only screens have no independent
financial calculation to certify.

| Screen / nested workflow | Functional | Demo populated | Visual comparison | Responsive | Financial verification | Remaining limitations |
|---|---|---|---|---|---|---|
| Spending Dashboard | V: Spending suite | V: income/purchases/refunds | V: official Spending dark | V: inventory + Spending suite | V: shared spending/refund tests | Whole-month budget comparison is explicit |
| Investments Dashboard | V: Dashboard suite | V: 4 investment accounts | V: official Investments dark | V: Dashboard suite | V: account totals equal portfolio/performance | Account groups remain organizational metadata |
| Net Worth Dashboard/category sheets | V: Dashboard suite | V: assets/debts/history | V: official Net Worth dark | V: Dashboard suite | V: assets minus liabilities; bridge equality | Recorded debt changes do not imply loan payments |
| Holdings investment table | V: Holdings suite | V: open/closed positions | L: official Holdings, different product mix | V: Holdings suite | V: weighted cost and authoritative ledger tests | No editable position snapshots/tax lots |
| Personal Assets / property / vehicle | V: Holdings suite | V: 4 manual assets | L: official property detail, source table | V: Holdings + inventory | V: correction retains original; no cash posting | Sparse valuations are observations, not daily prices |
| Liabilities / linked mortgage | V: Holdings suite | V: 2 recorded debts | L: source inspection | V: inventory | V: debt/NW tests | No amortization or inferred interest engine |
| Security details / prices | V: Holdings suite | V: dated SIM/official data | L: official asset detail, fictional identity | V: phone tabs and expanded hash regression | V: quote/quantity/cost tests | No quote deletion, OHLC or corporate actions |
| Account details / account activity | V: Holdings + Dashboard | V: cash and brokerage | L: official account image | V: inventory | V: cash/holdings counted once | Single-account/all-account scopes |
| Investment Activities / create / void | V: Holdings suite | V: purchases/sales/income | L: pinned source grid | V: Holdings suite | V: posting/void/import cash assertions | Bulk financial edits and security transfers postponed |
| Spending Transactions / filters / review | V: Holdings suite | V: purchases/refunds/review | L: pinned source ledger | V: Holdings suite | V: balances unchanged by review | No split transactions/bulk financial deletion |
| Income / expense / transfer forms | V: Holdings suite | V: test-owned form entries | L: adapted source dialogs | V: phone form checks | V: exact mandatory scenario | Transfers remain linked and atomic |
| Bank CSV/OFX import/review | V: browser CSV + backend OFX | L: upload-ready; fake fixtures | L: local source-adapted tool | V: inventory | V: preview/confirm/duplicate/provenance tests | No real bank files; blank queue is legitimate |
| Investment CSV import | V: Holdings suite | L: test-owned synthetic file | L: local adapter | V: inventory | V: no preview posting; confirmed cash exact | No generic quote-file importer |
| Reconciliation / matching | V: backend integration | L: explicit start state | L: local extension | V: inventory | V: identity/statement/reopen tests | No automatic fuzzy merge or balancing adjustment |
| Schedules | V: backend integration | V: rent expectation | L: local extension | V: inventory | V: expectation never posts automatically | Posting/matching always explicit |
| Budget / editor / overrides | V: Spending suite | V: groups/targets/rollover | L: official light Budget/source | V: Spending suite | V: targets/overrides/refunds/rollover tests | Planned income/manual starting rollover postponed |
| Spending Insights stages | V: Spending suite | V: category/month history | L: official Insights + pinned source | V: Spending suite | V: exact shared spending projections | No target proration or advanced reports |
| Life Events / event detail/edit | V: Spending suite | V: linked purchases/refund | L: official events/source | V: Spending suite | V: associations never add spending | Configurable event-type catalog postponed |
| Goals overview / archived list | V: Goals suite | V: 7 goals incl. archive | L: source and official overview at a different native size | V: Goals suite | V: no NW/balance change | Goal totals use existing allocation semantics |
| Goal detail / Savings Planner / lifecycle | V: Goals suite | V: plans/milestones/history | L: official goal detail; zero-return adaptation | V: Goals suite | V: preview/cancel/save/archive/restore guards | Expected returns/FIRE/tax funding postponed |
| Performance / comparisons / attribution | V: Performance suite | V: 1Y history/risk/results | V: official compare, pinned responsive header | V: Performance suite | V: TWR/XIRR/risk/coverage tests | Full trading/cash/FX attribution postponed |
| Portfolio Insights / explorer/widgets | V: Performance suite | V: allocation/classifications | V: official overview + pinned 5-widget layout | V: Performance suite | V: cash-inclusive allocation/coverage | Classifications are not fund look-through |
| Stage A allocation targets | V: Performance suite | V: targets/edit/delete tests | L: pinned target rails | V: Performance suite | V: versioned target/drift tests | Stage B rebalancing worksheet P |
| Received investment Income | V: Income/Dashboard suites | V: 135 payments/10 sources | V: official summary | V: Income suite | V: exact paid totals and payment-date FX | No forecast distributions or accrued-as-cash |
| Accrued Earnings | V: Income/Dashboard suites | V: 12 contracts | L: local fixed-income extension | V: inventory | V: historical gross/net/redemption tests | Tax estimates remain explicitly estimates |
| Settings index / General / Language | V: Settings suite | V: preferences; FX empty in BRL demo | L: official light Settings + local constraints | V: Settings suite | Metadata; locale tests preserve API values | No synthetic FX for official BRL holdings |
| Appearance / themes / fonts / sidebar order | V: Settings/theme suites | V: 6 themes/10 fonts/5 palettes | L: source + own approved controls | V: Settings/theme suites | Metadata; account equality check | Token checks are not a full WCAG certification |
| Account administration / groups | V: Settings suite | V: accounts/groups | L: source Settings rows | V: Settings suite | V: no ledger edits from membership | Groups are not named financial portfolios |
| Securities / classifications / quote access | V: Settings + Holdings | V: security metadata | L: source Settings composition | V: Settings suite | V: protected CDB/price guards | Hierarchies and quote correction P |
| Categories / payees / rules | V: Settings + backend | V: categories/payees/rules | L: source/native editors | V: inventory | V: metadata-only rules/bulk tests | No classification hierarchy/rule autoposting |
| Market data / cached FX | L: mocked providers; no live refresh | L: cached observations; disconnected setup | L: local adapter | V: inventory | V: adapter/coverage tests | Live credentials/entitlements not tested |
| Gmail / Pluggy | L: mocked backend/disconnected UI | L: intentionally no fake connection | L: local extensions | V: inventory | V: candidate/review-before-posting tests | Live OAuth/vault/bank sync not authorized |
| Export / Backup / Restore | V: Settings + maintenance suites | V: exports and owned recovery data | L: source settings + local maintenance flow | V: Settings suite | V: exact exports, integrity/staging/rollback tests | No encrypted backup engine; local single-process model |
| About / license notices | V: Settings suite | V: actual metadata | L: source composition | V: inventory | Metadata only | Licensing release blocker A01 |
| Reports | L: read-only preview | L: explicitly preview data | L: existing preview | L: existing tests, outside 42-screen inventory | U: no reporting engine claimed | Full engine P |

## Executed checks

- Backend: `.venv\Scripts\python.exe -m pytest -q` - **573 passed**, three existing
  seed connection-option warnings. Includes clean/populated Alembic paths through
  `sqlite_0021`, financial invariants, constraints, demo upgrades/reset/isolation,
  safe backup/restore and mocked Gmail/Pluggy/market services.
- Frontend: `npm.cmd test` - **330 passed / 76 files**, rerun on patched Vitest
  **4.1.12**. Earlier runs exposed stale Settings/Goals/font/DOM assertions; these
  now use the migrated screen contracts without weakening accounting/reset checks.
- Directly affected component rerun: **31 passed / 10 files**.
- Ruff lint/format passed; **215 files already formatted**.
- ESLint, Prettier, TypeScript and production build passed again after the tooling
  patch. Existing ~2.3MB shared-entry and dependency-annotation warnings remain.
- `npm.cmd audit --omit=dev --json`: **zero production vulnerabilities**.
  Full audit initially reported 12 moderate development-tool entries; the Vitest
  patch removed two mocker-related entries. **10 moderate development-only
  minimatch-related entries remain; zero high/critical**. The patched minimatch
  major does not fit the current lint-tool ranges. No forced downgrade/override or
  peer-validation bypass was used. npm 10.9.3 crashed resolving peers; temporary
  `npx npm@11.6.2 install --save-dev vitest@4.1.12 --ignore-scripts` succeeded,
  updating the lockfile without changing global npm.
  Primary advisories: [mocker registration](https://github.com/advisories/GHSA-qxg6-89mg-rqv8),
  [Windows traversal](https://github.com/advisories/GHSA-xp26-3454-mjgp),
  [minimatch amplification](https://github.com/advisories/GHSA-g3hv-75wg-m249).
- All **233** original-source fingerprints match the pin; no missing files.
- Working-tree privacy scan found no high-confidence private-key/token patterns.
  No database, secret environment file, dependency/build or new screenshot artifact
  is included in tracked/unignored project content. Existing v0.12 screenshots are
  historical synthetic artifacts; OFX matches are whitelisted fake fixtures.
- Browser suites passed: `--holdings-activities`, `--spending-migration`,
  `--goals-migration`, `--performance-insights`, `--dashboard-migration`,
  `--settings-migration` and `settings-maintenance-e2e.mjs`.
- Full inventory: **504 native captures / 42 screens**, light/dark at all five
  requested sizes, plus each screen in pt-BR and es-419. It found the security phone
  overflow; final affected-screen retests produced **28 additional captures with
  zero overflow, alerts, unnamed enabled controls or raw keys**. Original evidence
  remains; `validated-results.json` combines initial cases and actual final retests.
  Blank screenshots never count as verification.
- `--unified` passed six visible plus one archived Goal, dashboard sections,
  paid/accrued Income, expanded mobile provenance with complete hashes, navigation,
  unchanged accounts and explicit reset. The seven-goal API assertion is retained.
- `net-worth-empty-e2e.mjs` passed real migrated empty/negative/unavailable histories
  and transport-error/retry states without normal workers or vault access.
- Theme checks passed **12 theme/mode combinations**, ten fonts, five chart palettes,
  persistence and system mode. Classic dark muted text is **5.18:1** on background
  and **4.60:1** on cards, formerly 4.26:1 on cards. Unit tests cover live reduced
  motion and keyboard selection; captures disable motion. No full screen-reader or
  WCAG compliance certification is claimed.

### Performance observations

Full-inventory navigation/capture settlement: median **1.21s**, p95 **3.71s**,
including document reload, font readiness and the deliberate network-idle wait.
This local diagnostic is not a universal cold-load benchmark. The large entry
chunk remains an optimization candidate. Existing paginated/virtualized tables
and query reuse remain; no speculative financial cache or optimization engine was added.

### Reproduction and evidence

See [validation commands and safety boundaries](TESTING.md). Open
`docs/screenshots/v014-audit/index.html` for the native source comparison gallery;
`v014-audit-followup/` holds final affected-screen images. Financial/workflow
results and maintenance recovery evidence remain in their respective `v014-*`
directories. All generated evidence is ignored and contains only fictional data.
The full layout sweep preceded the final minor Classic contrast adjustment;
final theme checks and affected-screen retests verify the adjusted tokens.

## Visual interpretation and retained differences

The shared 70px collapsed sidebar, 16px tab gutter, full-width history areas,
restrained surfaces and typography are compared using native 1440×900 images.
The pinned Dashboard uses a 280px chart (`h-70`), while some cached screenshots
have a shorter plot. The pinned Insights has five separate configurable value
widgets; its older screenshot has three. The pinned Performance header stacks
below the title before the `2xl` breakpoint. The pinned Spending Insights has
a Money Flow Sankey where its older cached image shows an income/saving block. These are source revisions, not
reasons to replace working components with older screenshot approximations.

Approved product differences remain: Spending-first tabs, exact Brazilian money
with two decimals, local account selectors, explicit as-of/coverage and accrued
earnings controls, zero-return goal plans, fixed rather than percentage account
allocations, mocked/disconnected integrations, neutral light-theme card surfaces,
and single-user backup maintenance. Income retains an additional received/accrued
selector because the source does not model our CDB/RDB accrual distinction.
Financial curves/amounts are never modified for a prettier match. Official/native
reference evidence is absent for some Finance Tracker-only tools and mobile layouts;
those rows are L, not a claim of pixel-identical reference parity.

## Remaining work and recommendation

**NOT READY FOR RELEASE REVIEW.** A01 requires a separate owner/licensing decision
before publication. A13 retains development-tool advisories for review. Of **13
tracked findings**, **11 are resolved**, with those two open. No P0 financial
corruption or P1 primary-flow defect was found in the executed checks. Listed
functional stabilization and verification are complete. The large entry chunk,
inherited seed warnings, full screen-reader coverage and live provider/OAuth
entitlements remain limitations rather than invented successes. No release,
publication or architecture rewrite is implied by passing tests.

All previously postponed financial engines remain postponed: splits, amortization,
corporate actions/security transfers, tax lots/options, holdings snapshots, full
attribution, ETF look-through/hierarchies, rebalancing worksheets, planned income,
manual starting rollover, quote corrections/OHLC imports, AI/FIRE/tax-aware funding.
Account-group metadata and Stage A targets are implemented exceptions, not a claim
that their postponed financial engines exist. No Git write or publishing operation
is part of this task.

## Working-tree scope and handoff

The branch remains `feature/v0.14.0-frontend-refinement`, HEAD `7407991`.
Existing v0.14 migration work is preserved; nothing is staged, committed or published.
The full branch diff includes the previous migrations and is not presented as changes
made solely by this audit. Stabilization touches the additive demo extension/lifecycle,
appearance semantics/contrast, Dashboard gutters, mobile security tabs/provenance,
manual-asset labels, export labels/dates, Insights copy order, test runners and current
documentation. Vitest and its compatible lockfile entries are patched. No financial
engine or schema migration is introduced. Existing saved servers are left untouched;
the additive demo metadata is picked up by its validated-copy startup lifecycle.

No real user data, secret, generated DB, new screenshot or build artifact is staged.
`git diff --check` passes. Keep publication blocked until the separate license review;
review the development-tool advisories without forcing incompatible dependency changes.
