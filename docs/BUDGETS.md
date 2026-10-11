# Spending & Budgets — Phase 4

Budget is now a functional sidebar destination. Its **Overview / Budgets / Insights**
views share a selected calendar month and currency. Targets are spending guidelines,
independent of available cash. This is category-based budgeting, not envelopes,
zero-based budgeting, or mandatory allocation of account balances.

## Targets and history

- One `BudgetTarget` per existing category/currency. Zero is a valid target.
- `BudgetVersion` stores effective-from-month defaults: amount, active state,
  rollover setting, group assignment, and category sort order. A new version affects
  that month through the next saved version; months before it remain unchanged.
- `BudgetMonthOverride` replaces the complete configuration for exactly one month.
  Later months resume their applicable default. Existing overrides outrank defaults.
  Restore monthly default removes only the selected override.
- Editing an already saved version explicitly corrects its effective period. Targets
  are not immutable audit snapshots; neither are transaction categories. Correcting
  past ledger entries appropriately recalculates historical spending and carryover.
- Disable preserves history and writes an inactive default from the selected month;
  it also disables that month's override. A separately saved later version/override
  can explicitly reactivate it. No ledger records are deleted.
- Groups are flat, named, ordered presentation entities. Membership/order belongs
  to versioned target configuration. Group names and group order are current display
  settings, not historical snapshots. Numeric order controls reorder groups/categories.
  Referenced groups/categories cannot be deleted. Group totals count each category once.

Copy previous month writes destination overrides from the previous effective settings.
It copies amounts, grouping/order, active and rollover flags; never actuals, postings,
or a stored carryover. Identical copies are no-ops. Conflicting destination overrides
return 409 unless replacement is explicitly confirmed. Destination-only targets remain.

## Signed rollover

For an uninterrupted chain of active, rollover-enabled months:

`carry next month = carry this month + base target - net spending`

Both underspending and overspending roll forward. Available target is base plus
carry; it can be negative. Disabling rollover or the target resets the chain. A
month-specific override participates in the same calculation. Future-month targets
are visible, but actuals and prospective carryover are not fabricated. Carry becomes
available as that calendar month begins. No rollover changes an account balance.

Statuses: No target, No spending, On track, Approaching target (80% through 100%),
Over target (strictly above available). A zero/nonpositive denominator has no percentage.
Negative available amounts and refunds still retain their exact signed values.

## Classification and refund policy

The ledger is authoritative. Expense entries count once regardless of entry/import
source. Income does not count as spending. Transfers, investment cash contributions,
credit-card payments recorded as transfers, opening balances, deleted entries,
source observations, and unposted schedules are excluded.

**Refunds require an explicit link** from an ordinary INCOME credit to an EXPENSE
purchase. Use Refunds in the workspace to create a credit or associate an existing
manual/imported credit without another posting. No description/sign heuristic guesses
a refund. Until linked, an ambiguous credit remains ordinary income.

The refund reduces expenses on its own transaction date, not retroactively on the
purchase date. It uses the purchase's current category/payee. Original credit
metadata, descriptions, import provenance, and monetary posting remain intact. Partial
refunds are supported up to the original purchase amount in total, in the same currency,
dated on/after the purchase. The receiving account may differ in that currency.
Refunds never also count as income. A refunded month/category can have negative spending.

Posting and association occur in one writer transaction. Unique/FK/validation triggers
protect relationships; the exact aggregate refund cap is checked by the service under
BEGIN IMMEDIATE. Financial fields and soft deletion of linked purchases/credits are
blocked until the user explicitly unlinks them. Unlink keeps the credit and restores
income classification. Metadata edits remain permitted and balances remain unchanged.
This is refund classification, not bank reconciliation.

## Reporting contracts

`app.spending` shares exact classification across budgets, dashboard and history.
Queries use transaction-date boundaries (`start <= date < next month`) and indexed
SQL filtering. Report columns are streamed in batches of 500 and summed with a
60-digit Decimal context. SQLite SUM/REAL is deliberately avoided for exact money.
Monthly reports make two bounded column scans: cross-currency cash-flow context and
selected-currency category/month spending. Rollover requires history from the earliest
applicable target; otherwise the range is twelve months. No account snapshots or
manually maintained spent fields are introduced.

Currencies remain separate. Select an account currency; other currency activity is
flagged and excluded. There is no FX conversion or implicit cross-currency total.
Account-inactive history still counts. No account/subcategory budget dimension is added.

The selected month shows targets, available target, net expenses, remaining amount,
budgeted/unbudgeted spending, income and net flow. Uncategorized expenses stay visible.
Insights include previous-month changes, largest absolute category movers (increases
and decreases), top ten payees, daily net spending, and twelve-month actual cash flow.
Percentage comparisons are absent for zero/negative prior spending. A current month
compares its partial actuals with the full previous month and is labeled accordingly.

Actuals stop at the report's `as_of` date (local today by default). Historical months
show 100% elapsed, future months 0%. Current-month projection requires at least three
elapsed days and positive spending: `spent / elapsed days * days in month`. It is a
simple estimate, not a guarantee or a forecast based on schedules.

Category, payee, and daily drill-downs open the existing 50-row paginated ledger with
combined date/currency/net-spending filters. Linked refunds use purchase classification
for these filters. Clear drill-down filters restores the ordinary transaction list.
Budget writes invalidate budget queries only; ledger/metadata/import/refund writes
refresh existing dependent queries, including budgets, without full-page reloads.

## API

- `GET /api/budgets/monthly?month=2026-09&currency=BRL[&as_of=2026-09-30]`
- `POST /api/budgets/targets` — upsert category/currency and selected default/override.
- `DELETE /api/budgets/targets/{id}?month=YYYY-MM` — disable from month.
- `DELETE /api/budgets/targets/{id}/override?month=YYYY-MM` — restore default.
- `POST /api/budgets/copy-month` — month, currency, replace_existing.
- `GET/POST /api/budgets/groups`, `PUT/DELETE /api/budgets/groups/{id}`.
- `GET /api/spending/summary?date_from=...&date_to=...&currency=...` — **exclusive**
  end date; optional account_id, maximum ten years per request.
- `GET/POST /api/spending/refunds`, `POST /api/spending/refunds/link`,
  `DELETE /api/spending/refunds/{id}`. List is paginated (default 50, maximum 200).
- Additive transaction filters: currency, spending_only, uncategorized, no_payee.
  Existing transaction list end dates remain **inclusive** for compatibility.
  Transaction responses add optional refund_purchase_id/spending_category_id context.

## Demo and limits

On a **new separate, migrated SQLite file**, run `python -m app.seed_spending_demo`.
It atomically builds the existing deterministic demo plus ten targets, three groups,
an August override, signed rollover examples, one explicit partial card refund and
one uncategorized purchase: **502 ledger entries**. Repeated runs preserve all edits.
Existing older demos are not auto-extended; select another file to inspect the new
fixture. Generated databases and validation screenshots remain ignored.

No automatic refunds, FX, envelope allocations, budget-specific rules, workers,
income targets, savings goals, time-of-day heatmaps, or investment analytics are
included. Refund selectors show the latest 100 search matches; refine the search for
older entries. The UI displays the latest 50 links; API pagination supports older ones.
State-based navigation does not persist a drill-down in a URL. Long rollover histories
are reconstructed on demand; caching and high-volume analytical storage remain deferred.

## Validation checkpoint — October 11, 2026

- Baseline: 129 backend / 53 frontend tests. Phase 4: **163 backend / 61 frontend**,
  preserving prior tests and adding 34 backend / eight frontend cases.
- The final audit verifies the exact 1,000 / 600 / 400 / 60% target example,
  1,100 group spending, 8,500 - 5,730 = 2,770 cash flow, leap-day/zero-spending
  pace boundaries, and CSV/OFX rules/payees with repeat-import exclusion. It also
  fixes a date-overflow edge case when the optional report date is `9999-12-31`.
- Ruff, Ruff formatting, ESLint, Prettier, TypeScript and production build pass.
  Non-blocking Zod annotation warnings and a roughly 520 kB main-bundle warning remain.
- Fresh SQLite migration, a backup copy of populated Phase 3 preserving existing tables
  (including imported transactions, source records and mapping profiles),
  Alembic drift check, foreign keys/uniqueness, repeat seeding and exact deterministic
  demo snapshots pass. A real validation API restart preserves the budget report.
- Isolated Edge workflows exercised target/group creation and editing, monthly
  overrides, copying with confirmation, rollover settings, categorized expense and
  category correction, income, transfers, credit-card payment, refund entry, paginated
  spending drill-down, CSV rule application, confirmation and exact re-import.
  The existing CSV/OFX browser regression also passed explicit source linking,
  rule classification, schedule matching and invalid-row exclusion. Existing Rules,
  Scheduled, Overview and Accounts screens were opened successfully.
  Settings category create/rename/delete and payee create/rename/assignment also
  passed in the browser, with unchanged account balances after metadata edits.
  Automated backend tests additionally cover schedule exclusion, cross-source links,
  financial-edit guards, metadata changes, month/year boundaries, refund caps and
  signed multi-month carry chains. The original 5,300 / 2,500 accounting scenario passes.
- The public spending overview, budget and insights reference images were inspected
  alongside local screenshots. Local light/dark captures use 1440×900 and 1920×1080;
  expanded navigation was checked at 1280px and drawer/table containment at 390px.
  The implementation retains the existing shell and uses the reference's compact
  headline/chart, grouped plan rows and supporting-column hierarchy. It is not an
  exact visual clone: category rows start expanded, target ordering uses numeric
  controls, charts use exact-label daily bars, and unsupported income/FX/savings
  planning controls are omitted. No source components were copied for this module.
- Scripts, synthetic databases, screenshots and logs remain ignored under `.tmp`.
  The normal user database was not reset, overwritten or used for browser mutations.
  Git finalization is a separately authorized checkpoint; no Phase 5 implementation
  is included in this validation.
