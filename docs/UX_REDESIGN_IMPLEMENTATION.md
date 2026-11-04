# Approved UX redesign implementation

Updated 2026-10-29. This document records the implementation of
[UX_REDESIGN_SPEC.md](UX_REDESIGN_SPEC.md), approved on 2026-10-27.
The user authorized continuing all slices without intermediate approval pauses.
Git publishing remains unauthorized.

## Reference and evidence contract

- Pinned source: `d86c20194b4b61ad8133ce820739d5ac83f9045e`.
- The reference runtime is unavailable. The user approved the cached official
  screenshots for the named screens. The 1440x900 gallery pairs those images with
  the local application. The 1920x1080 captures are source-guided checks, not paired
  captures of a running reference. Responsive checks use 390x844.
- [Comparison gallery](screenshots/ux-redesign-shell/index.html) and
  [rendered measurements](screenshots/ux-redesign-shell/measurements.json).
  Reference images stay in the ignored local `.tmp` cache; they are not shipped
  as application assets. The earlier parity galleries remain historical evidence.
- Every product financial value comes from the isolated local demo API. No normal
  database was reset, reseeded or used for browser captures. The occupied user
  service on port 8001 was left alone; browser validation uses port 5174.

## Implemented screen and workflow changes

| Area | Implementation |
| --- | --- |
| Shell | Spending-first Dashboard; approved 70/220px sidebar, compact section navigation, semantic Olive tokens, self-hosted typography, separate demo appearance preferences and a compact Demo menu. Canonical hash routes preserve existing aliases. |
| Spending | Exact daily bars, keyboard/hover tooltip, average line, current/prior period totals, real range controls, independent monthly budget navigation, List/Map and optional existing category groups. Grouping identifies its budget configuration month. |
| Spending Insights | Where I am / What changed / When & where; three compact summary areas, income/cash-flow strip, existing category groups and filterable/sortable spending plan. Monthly comparisons use the same elapsed span in the previous month; broader/custom comparisons use an explicitly labeled preceding equal-length interval, server summaries and scoped category/payee drill-down. Invalid/future period ends are rejected in the display adapter. |
| Budgets | Compact grouped financial rows expose base target, signed rollover, available target, spent and remaining. Focused target dialogs preserve all configuration fields. Existing targets default to one-month edits even from setup; new setup targets default to ongoing, and new monthly targets default to one month. |
| Life Events | Date-scaled overlap lanes, real daily spending context, inline selected detail and bookmark state, mobile calendar, and focused event editing. Existing linking/refund/FX behavior is retained. |
| Investments | Hero value, gain, TWR and chart share the historical performance response. Exact dated allocation rows feed individual accounts and the top five known holdings. Scope/end/range and asset links persist. A separately dated current-goal preview never contributes to portfolio value. |
| Portfolio Insights | Reporting-currency value/cash/invested strip; four exposure gauges; full-width composition; exact member breakdown and concentration. Native cost/P&L stay grouped by their original currencies in a disclosure. Missing/negative compositions remain unavailable. |
| Performance | Dominant comparison panel with TWR, annualized XIRR, gain, ending value and net external funding. One optional benchmark remains explicitly a price proxy. Metric method/coverage reasons are keyboard-accessible beside their values. Percent axes use exact endpoints and dimensionless coordinates. |
| Income | One original payment currency across three summary areas, zero-filled calendar buckets, exact monthly average, monthly/cumulative receipt chart, and positive top-ten source ranking. Partial-month/no-comparison context, exact activity rows and separate redemption breakdown remain available. |
| Net Worth | Historical hero and real period controls precede the breakdown. Supporting metrics/methods use a disclosure. Genuine missing coverage adds an attention column. Category sheets open constituents; asset/debt detail uses bookmarkable Overview/Values views. |
| Manual positions | History/supporting metadata use a 2:1 layout. Last recorded value and chart use eligible nonvoided observations through the selected date; future and voided records remain in Values for audit. Single observations show their value without inventing a history series. Create/edit/value entry use focused dialogs. |
| Goals | Bookmarkable detail with actual savings/progress/milestones, separate contribution-only scenario, monthly plan and 2:1 trajectory/planning layout. Existing allocation/progress posting is explicit in a dialog. Target/deadline editing and lifecycle guards remain separate. |
| Accounts / Holdings | Compact financial lists and existing full-page details; account and investment editors use focused dialogs. Fixed income is a Holdings filter with bookmarkable contract detail and dedicated subscription/redemption actions. Generic activity/manual-price actions are absent for fixed-income contracts. |
| Activities | Transactions and investment activity share navigation, with contextual Tools access. Their records, forms, financial mutations and import confirmation contracts remain separate. Transaction creation/editing and transaction-to-rule drafts use focused dialogs. |
| Imports / Gmail | Shared right inspector on desktop and modal on mobile, with source evidence kept as text. Focus remains independent from approval selection. Resizing preserves an unsaved editor. Existing bank/Gmail/brokerage decision APIs are retained. |
| Statements | List opens one bookmarkable workbench, with account/currency/cutoff/status/revision, statement/cleared/difference summary, existing blockers and rows. Exact-zero/token checks remain; reopening explicitly explains later-statement invalidation. |
| Settings / Rules | Grouped General, Classification, Planning, Data connections and Previews. Categories stay configuration; rules use focused editors retaining advanced values and preview guards. Dated-index entry carries contract/index/account/date context with a return link. |

## Shared implementation

- Shared `ActivityNavigation`, `CandidateInspector`, focused `DetailDrawer`, exact
  Money formatting, chart data alternatives and section/query state primitives.
- Inspector wrapper identity stays stable across desktop/mobile changes. Closing
  changed dialogs prompts before discard; disabled submission fieldsets prevent
  closing during a pending mutation. Native dialogs provide focus containment and
  Escape behavior, with restoration to the trigger.
- Exact BigInt display adapters cover income calendar buckets, budget curves,
  event overlap geometry and comparable top holdings. Monetary amounts never
  become JavaScript Number; only normalized chart coordinates do.
- Additive `daily`, `monthly` and `payees` fields in `/spending/summary` use the
  existing exact spending aggregation. The monthly narrative additionally exposes
  all category comparisons, previous spending and exact percentage change from
  its existing same-elapsed-span query. This prevents mixing full prior-month
  spending with current month-to-date values. Historical performance valuation
  fields remain read-only. No financial posting algorithm or schema was redesigned
  for the UI.

## Validation record

The latest completed backend run is **412 passed**, with three existing SQLAlchemy
connection warnings. Fresh/populated migrations and financial invariants are
covered by that suite. An earlier run failed because Windows denied pytest's
system temporary path; the successful run used a new repository-local temporary
root and disabled the cache provider. No test databases were substituted for
normal data.

The completed frontend suite is **184 passed across 32 files**. New coverage
includes exact income averaging, arbitrary-range comparison/drill-down, historical
observation selection, scoped budget defaults, inspector resize preservation,
route compatibility, same-response investment values, comparable top holdings,
same-elapsed month comparison and spending-plan filters that never mutate money.

The isolated browser screenshot runner passed desktop 1440x900/1920x1080 and
390x844 checks: canonical navigation, nonempty real charts, range/filter changes,
benchmark selection, detail bookmarks, fixed-income index context, dirty-dialog
guards, responsive navigation, light mode and real empty/error/missing-data states.
The complete demo workflow runner also passed: real income/expense/transfer
creation with exact balance/reporting assertions, CSV/OFX and notification
simulation review, responsive inspector draft preservation, rule preview,
budget/goal/category edits and owned-demo reset. Imported synthetic decisions
remain explicit; viewport changes do not submit them.

Ruff lint and formatting passed (143 Python files). ESLint, Prettier, TypeScript
and the production frontend build passed. `git diff --check` passed; Git reports
existing CRLF-to-LF normalization notices, with no whitespace errors. Logs remain
local under `.tmp/ux-backend-final-position.log`, `.tmp/ux-layout-*.log`,
`.tmp/ux-delivery-browser.log` and `.tmp/ux-demo-workflows3.log`.

Reproducible commands: `npm test`, `npm run lint`, `npm run format:check`,
`npm run build` from `frontend`; `DEMO_E2E_PORT=5174 node
frontend/scripts/ux-shell-e2e.mjs` and `DEMO_E2E_PORT=5174 node
frontend/scripts/demo-e2e.mjs` from the repository root (set the environment
variable using the host shell). Backend checks use `pytest`, `ruff check .` and
`ruff format --check .` from `backend`. Windows pytest used a fresh `.tmp`
base directory and `-p no:cacheprovider` because its system temporary path was
not accessible.

Production builds retain the dependency annotation and large-chunk advisories.
These are build advisories, not missing financial data or failed compilation.

## Visual acceptance and deviations

The implementation follows the source's screen organization and the approved
adaptations. Reference figures and chart shapes are intentionally different from
our fictional ledger. No allocation targets/rebalancing, AI, FIRE planning,
expected-return goal input, tax-aware funding, unsupported daily movers or
unsupported net-worth pace/attribution were introduced.

The Spending income strip intentionally shows income and net cash flow rather
than inventing the reference's employment taxonomy or savings destinations.
Existing user-defined category groups are preserved, including Ungrouped; demo
data is not reclassified just to reproduce the screenshot. Income charts show
actual paid receipts and their cumulative sum; no unsupported previous-period
series or expected future income is added. The ALL income view is bounded by the
existing API's ten-year history window. Portfolio composition spans the available
width because allocation targets/rebalancing are explicitly excluded.

### 1440x900 comparison anchors

Reference anchors below are read from the approved screenshot pixels, not a
running reference DOM. Local values come from the browser's rendered bounds.
They establish useful geometry checks; they do not certify every text baseline,
plot inset, icon or control against the specification's tolerances.

| Anchor | Reference | Finance Tracker | Result |
| --- | --- | --- | --- |
| Collapsed sidebar width | 70px | 70px | Matches approved width |
| Spending hero height | Approximately 280px | 280px | Matches screen hierarchy |
| Spending Insights summary top | 160px | 152.5px | -7.5px, within 8px anchor tolerance |
| Spending Insights income strip top | 410px | 407.7px | -2.3px, within tolerance |
| Spending plan table top | 627px | 629.4px | +2.4px, within tolerance |
| Spending plan ordinary row | Approximately 49px | 49px | Matches; rollover metadata adds a second line where present |
| Portfolio summary top | 76px | 72px | -4px, within tolerance |
| Portfolio exposure top | 181px | 176.2px | -4.8px, within tolerance |
| Portfolio composition top | 421px | 416.2px | -4.8px, within tolerance; full width is approved |
| Income summary top / height | 76px / 150px | 72px / 150px | -4px / same height |
| Income lower panels top / height | 250px / approximately 625px | 246px / 624.7px | Within major-bound tolerance |
| Goal detail panels top | 102px | 101px | -1px, within tolerance |
| Manual-position panels top | 97px | 101px | +4px, within tolerance |

Remaining differences: the manual-position panel is about 14px taller than its
reference counterpart; exact chart plot insets and every row/control have not
received a complete tolerance certification. Performance retains the supported
scope/currency/date controls and price-proxy label rather than unsupported
comparison overlays and volatility/drawdown metrics. Source badges, decorative
category icons and reference-specific copy are not duplicated. Exact BRL labels,
coverage disclosures and actual ledger-derived data alter text and chart shapes.
The 1920 captures are source-guided only; no equivalent reference runtime capture
exists. These limits remain visible for review, rather than being recorded as
full visual parity.

Rendered bounds are retained per viewport. The comparison gallery is the review
artifact; passing functional tests does not assert pixel parity. Final visual
signoff, including the specification's control/row tolerances and all screen states,
remains a user review gate. Any measured differences still outside the approved
bounds must be reported, not silently treated as passed.

No commits, pushes, merges or tags were performed.
