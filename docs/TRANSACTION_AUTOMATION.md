# Transaction automation contracts (Phase 2B)

## Rules and manual precedence

`transaction_rules` stores name, enabled state, numeric priority, ALL/ANY mode,
allowlisted JSON conditions/actions, UUID and timestamps. Lower priority numbers run
first; ties use creation time then UUID. The first matching action wins **per field**.
All conditions see the original classification basis, not changes from earlier rules.
An automated field retains its prior basis in `rule_assignments`, making repeat
evaluation idempotent even when a rule changes a field used in its own conditions.

Text fields description/payee_name support contains, not_contains, equals, starts_with.
Text comparison uses Unicode casefold and collapsed whitespace. Amount supports equals,
greater_than, less_than with exact Decimal magnitudes. Account/category UUIDs, currency,
ordinary transaction type and review status support equals. No regex, SQL, scripts,
external requests, financial actions, transfer actions, or nested expression language.
Actions assign existing payee/category or a review state. Inputs and references are
validated before storage. Category deletion also checks rule and suggestion references.

Precedence: explicit manual assignment (including clearing) > rules > defaults.
Transactions record `manual_fields` and per-field `rule_assignments`. Omitted creation
fields are defaults; supplied metadata is manual. PATCH locks only supplied fields;
legacy PUT locks metadata that actually changes. The editor omits untouched fields.
Users may explicitly release a field via `unlock_fields` without changing its value;
apply a previewed rule afterward. The additive migration protects all legacy ordinary
metadata, including nulls, because its origin was not previously tracked.

Evaluation is pure. New ordinary entries run enabled rules in their posting transaction.
Historical application requires a preview token covering rules and the full affected
set, not just the first 50 displayed examples. A changed preview causes HTTP 409.
Manual skips, priority conflicts and already-assigned values are explained. Applications
and `rule_applications` audit snapshots commit atomically. Deleting/disabling a rule
does not revert existing classifications or delete its audit history.

Routes: GET/POST `/api/rules`, PATCH/DELETE `/api/rules/{id}`, POST `/rules/preview`
(draft), POST `/rules/{id}/preview`, POST `/rules/{id}/apply` (preview_token),
GET `/transactions/{id}/automation`. All relative routes in this document are under `/api`.
Historical evaluation scans local ordinary history; it is intentionally not a job engine.

## Conservative learning

`transaction_corrections` records explicit user category/payee changes, prior/new IDs
and narrow context. Automated rule changes and ingestion are not learning evidence.
The demo explicitly labels fabricated corrections `DEMO_USER`.

Require at least LEARNING_MIN_EXAMPLES distinct transactions (default/minimum 3),
consistent non-null payee and category, and a meaningful description. Only a trailing
numeric reference is generalized; generic descriptions such as PAYMENT/CARD PURCHASE
are rejected. Groups also require identical account, currency and ordinary type.
Repeated changes to one entry count once. Deleted, changed-context or conflicting
evidence does not support a pending suggestion. Existing equivalent rules suppress it.

`rule_suggestions` has a unique context fingerprint, conditions/actions, evidence count
and PENDING/STALE/ACCEPTED/DISMISSED lifecycle. Pending evidence is revalidated before
acceptance. Accept creates a normal future-only rule; edit allows review before accept;
dismissal persists across later corrections. No fuzzy merging or automatic activation.
GET `/rule-suggestions`, POST `/{id}/accept` (optional edited rule), POST `/{id}/dismiss`.

## Schedules and occurrences

`schedules` references one account, optional payee/category, original currency and exact
positive amount. Frequency is ONCE, WEEKLY, BIWEEKLY, MONTHLY or YEARLY. Start date is
the recurrence anchor; end date is inclusive. Monthly/yearly dates clamp to the last
valid day while retaining the anchor: Jan 31 → Feb 28 → Mar 31, Feb 29 returns in leap
years. Disabled schedules generate no new expectations. Ended schedules may retain
uncompleted overdue occurrences. `next_due_date` is the oldest uncompleted occurrence,
including overdue dates, and is derived rather than mutable state.

Occurrences are computed, not pre-created ledger entries. Read-only range requests
cover at most 367 days/5,000 occurrences; status is UPCOMING, DUE, OVERDUE or COMPLETED.
Expected income/expense/net excludes completed events, stays separate by currency and
never participates in actual account balances or dashboard income/expense totals.
Amount and approximate tolerance use the existing exact text-backed money adapter.

Candidate matching requires same account, type, currency, payee (or exact normalized
description when no payee), non-deleted/unmatched ordinary transaction, date within
SCHEDULE_MATCH_DAYS (default ±3), and exact amount or configured absolute tolerance.
Multiple candidates are explicitly ambiguous. The user always confirms the selected
transaction, with eligibility rechecked on submission. Approximate amounts never post
automatically. Explicit posting takes the actual amount/date and uses the ledger service
inside the same transaction as completion. No timer, worker or implicit posting exists.

`schedule_completions` has unique (schedule_id, due_date) and unique transaction_id,
foreign keys and an expected-value snapshot. One transaction cannot complete two
occurrences. Database triggers prevent incompatible completion insertion, completion
updates, and changes to completed posting amount/account/currency/type/date/deletion.
Metadata remains editable. Unlink first to make a financial correction; unlinking or
deleting a schedule never deletes an actual transaction. Completed occurrences remain
visible even if their schedule is disabled. Changes to recurrence/account/type require
unlinking completions; an end date cannot exclude confirmed occurrences.

Routes: GET/POST `/schedules`, PATCH/DELETE `/schedules/{id}`, GET `/schedules/upcoming`
with date_from/date_to/as_of; GET `/{id}/occurrences/{due}/candidates`, POST `/match`,
POST `/post`, DELETE `/match`. Schedule deletion with completions returns 409.

## Future boundaries

Phase 3 imports normalize candidates and reuse these rules and schedule matching before
explicit posting; see [import contracts](IMPORTS.md). Gmail and bank reconciliation
remain unimplemented. Review remains separate
from bank clearing and schedule completion. Future budgeting will use monthly category
spending targets, independent of available cash: not envelopes, zero-based allocation or
balance-constrained assignment. No budget editing engine is implemented in this phase.
