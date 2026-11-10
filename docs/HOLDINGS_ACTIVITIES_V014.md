# Holdings and Activities migration

Work in progress on `feature/v0.14.0-frontend-refinement`; no release or Git publishing.
Implement directly in the existing frontend and normal demo. The deleted
`frontend-next` experiment is not recreated.

## Source and compatibility decisions

Upstream revision: `92b4647f74ec51fbbb1a772db4f42ea91060c518`, matching the
[v0.14 workflow](FRONTEND_V014_WORKFLOW.md). The ignored reference checkout is
`.tmp/reference-v014`. GitHub's pinned Holdings table styles were independently
retrieved through the GitHub connector. The application source is AGPL-3.0;
the copied shared UI package declares MIT. Preserve both notices and source hashes.

The migration copies actual component markup, styles and interactions. It replaces
upstream platform/data hooks, Number-money models, implicit zero fallbacks and
financial localStorage with exact typed adapters, existing services and URL state.
The app shell, existing theme choices and all existing financial workflows remain.
Source identities are recorded in `frontend/src/vendor/wealthfolio/SOURCE.json`.

The read-only Holdings projection extends the existing API with remaining basis,
disposed basis, gains, received income, original-currency cash-inclusive weights
and eligible previous-day comparisons. It never posts or creates another price,
cost-basis or balance authority. Optional daily results are unavailable when the
position quantity changed that day. Contract-based CDB/RDB values do not become
fictional exchange quotes. Acquisition history is not tax-lot accounting.

## Confirmed capability boundary

The user chose to postpone these substantial new engines:

1. Split transaction posting and associated budget/refund allocation.
2. Loan amortization, generated payment schedules and inferred principal/interest.
3. Security transfers and corporate-action postings.
4. Tax-lot/FIFO accounting and options contracts.
5. Direct editable holdings snapshots independent of activities.

Named portfolios and custom classification hierarchies remain postponed from the
earlier decision. Keep supported recorded debt terms/balances, asset associations,
acquisition history, dated valuation projections and activity-based corrections.
Do not expose fake working actions for the postponed engines.

## Migration checklist

Status on November 7, 2026. This is an implementation record, not final visual
acceptance. “Composition” means the actual source page structure/shared controls
were adapted while Finance Tracker's existing controller/forms were retained.

| Screen/component | Copied upstream | Backend connected | Demo populated | Visual parity verified | Functional tests |
| --- | --- | --- | --- | --- | --- |
| Shared tables, column controls, dialogs, sheets and popovers | Yes | Exact adapters | Yes | Captured; review ongoing | Unit/browser |
| Native Holdings/Activities page pills and mobile shell | Yes | Hash routes | Yes | Desktop/mobile captures | Browser |
| Investment holdings and applicable columns | Yes | Tested projection | Yes | Paired 1440 comparison | Exact/balance regressions |
| Open/closed positions, search, sort, type and columns | Yes | Exact local sorting | Gain/loss examples | Captured | Backend/browser; extended checks ongoing |
| Holdings mobile list and filters | Yes | Yes | Yes | 390 capture | Browser smoke |
| Account-scope selector | Yes | Original-currency scope | Multiple accounts | Captured | Backend scope regression; UI matrix pending |
| Assets table/mobile list | Yes | Dated observations | House/car/equipment | Desktop capture | Backend/browser smoke |
| Recorded-liability overview | Yes, adapted | Recorded debt only | Mortgage/vehicle loan | Overview and mortgage-detail captures | Exact projection tests; browser detail |
| Manual asset/debt add/edit and close | Native dialog composition | Existing guarded APIs | Existing records | Desktop/mobile native forms captured | Existing backend/forms; browser create/close with retained audit |
| Manual valuations/history/correction/void | Source detail composition | Existing immutable audit | Four dated observations per example | House/history captures | Existing financial tests; browser add/correct with retained audit |
| Security Overview/chart/markers/ranges | Source composition | Shared eligible price history | Official/SIM provenance | Detail capture | Chart regressions/browser smoke |
| Security price history and manual addition | Source close-table composition | Existing cached prices/add API | Dated SIM prices | Price History capture | Exact quote/provenance test |
| CDB/RDB Values and Treasury identity | Adapted source structure | Dedicated contract services | Official dated history | CDB Values capture; wider Treasury matrix pending | Fixed-income regressions; real CDB browser history |
| Acquisitions and per-account holdings | Source composition | All paged activities; weighted average | Multiple purchases/accounts | Capture | Consolidation regression/browser |
| Account detail/history/holdings/activities/cash | Source composition | New read-only projection | Multiple brokerages | Account capture | Exact account/balance tests |
| Account reconciliation and opening-history editing | Native composition around existing workflows | Existing services | Ledger history | Full visual audit pending | Existing reconciliation/forms regressions |
| Investment Activities desktop/mobile/day groups | Yes | Server-side stable paging | Long history | Desktop capture | Projection/UI/browser |
| Activity search/account/security/type/date/status/sort | Source controls | Combined server query | Yes | Source review ongoing | Combined filters/order tests; browser search |
| Activity column controls | Yes | Appearance-only preferences | Yes | Capture | Browser smoke |
| Editable investment grid/bulk financial replacement | Postponed by user | No atomic batch editing API | Not fabricated | Pending | Not claimed |
| Activity type picker, exact forms and confirmation | Actual picker plus native forms composition | Preview then explicit post | Funded accounts | Transfer and investment-preview captures; broader form matrix pending | Exact draft/API tests |
| Activity inspection/copy/guarded void | Source menus/dialogs | Existing immutable-history guards | Including closed trades | Source review ongoing | Backend regressions; browser buy/guarded-void flow |
| Spending desktop/mobile/day grouping | Actual rows/cards | Existing transactions API | Household history | Desktop/mobile captures | Exact transfer/refund mapping; browser |
| Spending search/category/payee/review/details | Source facets and editor sheets | Existing metadata/posting APIs | Normalized payees/review mix | Capture | Navigation/filter/form regressions |
| Selected-record bulk review/category/payee | Source bar, local confirmation sheet | Existing atomic metadata API | Page-scoped selection | Selection capture; real review interaction | Explicit-ID, transfer guards and browser cash invariance |
| Linked transfers and refunds | Source rows, local domain semantics | Existing linked records | Yes | Neutral transfer presentation | Financial regression plus real browser posting |
| CSV/OFX upload/mapping/account review | Source page/upload/step controls; local mapping | Existing bounded parsers | Fictional test fixtures | Preview capture | Unit/import regressions; CSV browser |
| Brokerage import/security review | Source page/upload/steps; local row decisions | Existing preview/confirmation | Existing SIM securities | Source-frame preview/results captures | Backend import regressions; real broker CSV preview/confirmation |
| Import duplicates/provenance/confirmation/results | Local protected controllers retained | Atomic posting and identity claims | Fictional fixtures | Confirmation capture | Backend/unit; bank CSV browser |
| Schedules/rules/learning access | Source action palette; existing editors | Existing services | Existing demo | Nested editor visual migration remains | Navigation/automation regressions |
| Gmail review/configuration | Source action palette; existing editors | Existing opt-in services | No fake connection | Nested editor visual migration remains | Existing Gmail regressions |
| Matching/statements/source audit | Source actions; existing protected views | Existing services | Existing evidence | Nested editor visual migration remains | Existing reconciliation/matching regressions |

## Additional capabilities postponed

The user also chose to postpone these four additions after the deeper source
review. Existing supported workflows remain available:

- Audited correction/deletion of cached prices (currently add-only observations).
- Atomic bulk investment editing and void-and-replace correction (currently safe
  individual voiding and separately confirmed new drafts).
- Bulk spending deletion and reimbursement flags (existing linked purchase refunds
  remain distinct and supported).
- OHLC/volume storage and generic quote imports (the current price contract stores
  dated close observations; it does not supply invented open/high/low/volume).

Quote tables expose real close observations; imports retain the
established candidate review rather than pretending to support a new posting engine.

## API adapters and invariants

- `GET /api/investments/workspace/holdings`: exact consolidated holdings, basis,
  realized/unrealized gains, paid income and cash-inclusive original-currency weights.
- `GET /api/investments/workspace/manual-holdings`: dated asset/debt values, known
  linked equity and recorded balance reductions; no generated repayments.
- `GET /api/investments/workspace/activities`: combined account/security/search/type/
  date/status filtering, bounded server pages and stable date/sequence ordering.
- `GET /api/accounts/{id}/workspace?start=...&end=...`: cash and portfolio history
  from existing authoritative services, retaining unavailable price coverage.

There are no schema migrations or independent money/return authorities in this
slice. CDB/RDB values use their contract history, not equity price-entry controls.
Metadata edits never add postings. Transfer sides cannot be independently copied
or deleted. Refunds display their purchase category. Page-edge day counts do not
claim to count records on another page. Calendar-only records do not invent times.
All money remains exact API strings; display rounds only at the shared formatter.

## Demonstration content

The owned unified demo retains its existing household, goals, official CDI/Treasury
observations and fictional SIM income. A versioned additive extension adds camera
equipment, a home mortgage and vehicle loan, with four recorded observations each.
Two completed fictional ETF positions demonstrate BRL 116 realized gain and BRL 154
realized loss after fees. Their combined funded brokerage cash change is BRL -38.
No personal-income or daily-interest transactions are invented.

Startup upgrades a validated backup of older owned unified content before atomic
publication. It retains saved rows and the previous generation, and preserves the
active pointer if extension fails. Tests cover retry, repeatability, reset and
personal/archive isolation. See [demo lifecycle](DEMO.md).

## Run and inspect

From the root, build with `cd frontend; npm.cmd run build`, then run
`cd ../backend; .venv/Scripts/python.exe -m app.demo`.
Open `http://127.0.0.1:8001/#/holdings` or
`http://127.0.0.1:8001/#/activities?view=transactions`.
The released version remains 0.13.0. Do not reset saved work to inspect this change.

Browser validation, from `frontend`, creates its own owned temporary workspace:

```powershell
$env:DEMO_E2E_PORT='5174'
$env:DATABASE_PATH='.tmp/holdings-e2e-never-personal.db'
$env:PYTHON_KEYRING_BACKEND='keyring.backends.null.Keyring'
node scripts/demo-e2e.mjs --holdings-activities
```

Local screenshots/reports are in `docs/screenshots/v014-holdings-activities/` and
remain ignored. The official cached dark Holdings reference is 1440×900 and older
than the pinned source: it supports comparison, not proof of a running exact-pin
application. 1920×1080 and mobile captures are source-guided checks.

## Validation and remaining differences

- Full backend run: **515 passed**, three existing legacy seed warnings.
- Full frontend run: **279 passed** across 62 files.
- Backend/frontend lint and formatting checks pass; TypeScript and production build pass.
- Browser verified native navigation, holdings/manual/security/account details,
  transaction search, mobile layout and the actual 5,300/2,500 posting scenario.
  Income/expense changes were exactly 1,000/200; transfers were excluded; original
  demo accounts were unchanged. CSV preview left cash at 100; explicit confirmation
  posted 32.50 once, leaving 67.50. Investment preview left cash at 100; the confirmed
  two-share purchase at 25 plus fee 1 left 49; guarded void restored 100 and retained
  the activity history. Brokerage CSV preview also left cash at 100, with the
  explicitly confirmed purchase reducing it to 75 exactly once. Selected-record
  review changed no balances. A new manual asset was entered on mobile, valued at
  980 and corrected to 970, retaining the original observation. Closing it retained
  both audit rows. All new records
  existed only inside the browser harness's temporary demo root.
- Browser regression found and fixed a dropped upstream row-click guard: native
  checkbox selection had also opened the editor. The adapted guard now preserves
  control cells, portals and text selection, with tests using the real Checkbox.
- Responsive browser validation found another issue: switching Dialog/Sheet
  component trees discarded unsubmitted financial drafts. The adapted modal now
  retains one Portal/Popup and reuses source sheet styles on mobile. Tests preserve
  the same inputs and exact strings through desktop/mobile/desktop changes.
- Existing theme/font choices, BRL decimal formatting, generic monogram avatars,
  contract-rate cells and explicit missing-data explanations intentionally differ
  from the cached screenshot. Native assets do not acquire upstream branding.
- Native editor forms reuse the protected exact controllers because upstream forms
  coerce monetary inputs to Number and depend on unsupported financial engines.
  Native surfaces remove the duplicate legacy panel; field grouping follows the
  source two-column desktop/single-column mobile composition.
- Native close-history and safe posting controls replace unsupported destructive
  quote editing and direct holdings snapshots. The editable financial grid and new
  engines remain postponed by the user. Existing local import row-decision and
  automation/reconciliation editors retain some Finance Tracker presentation; their
  backend behavior is preserved rather than replaced with unsupported source engines.
  A wider visual/empty/error matrix and final visual acceptance remain outstanding.
- All 98 original source hashes in the migration manifest match the pinned checkout.
- Production build retains large-chunk and dependency annotation warnings. No
  dependency audit force-fix, new financial engine or Git publishing was performed.
