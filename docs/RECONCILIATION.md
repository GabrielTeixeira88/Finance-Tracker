# Local matching and statement reconciliation (v0.9.0)

The canonical version is 0.9.0. See [release validation](RELEASE_0_9_0.md).
Run the ordinary Alembic upgrade before starting the API. No database reset,
additional provider, background job, or financial-data export is required.

## Matching and source identity

CSV, OFX and Gmail continue to use the same SourceRecord, import preview and
atomic confirmation service. Reconciliation does not introduce another ledger
or candidate store. Opening entries and investment activities are not ordinary
purchase matches. Existing linked transfer sides can receive source evidence
independently, always within the same account and direction.

Reliable identity remains scoped by account and source context: file/row hashes,
explicit CSV IDs and namespace, bank-context/FITID, and Gmail mailbox/message.
Exact repeats are no-ops only when financial source fields remain consistent.
An identity with conflicting values, a detached link or incompatible current
ledger values requires inspection. Soft-deleted postings retain their claims;
reimporting them cannot silently recreate a financial event.

Without identity proof, suggestions require the same account, currency, exact
amount and direction within `RECONCILIATION_MATCH_DAYS` (default 3, range 0–14).
Date differences, normalized payee agreement and description-word overlap are
shown as evidence. Agreement improves the descriptive confidence classification;
it never authorizes an automatic fuzzy link. Multiple alternatives remain explicit.
Similar merchant evidence with a different amount across sources (or a manual
entry) is a conflict. Distinct same-source purchases with different amounts are
not automatically treated as one authorization/settlement event.

The UI exposes EXACT_SOURCE_DUPLICATE, HIGH_CONFIDENCE_MATCH, POSSIBLE_MATCH,
NO_MATCH and CONFLICT. Import status names remain backward compatible and add
CONFLICT. Rejected proposals stay excluded from subsequent previews; choosing
to keep an event separate still requires an explicit decision. Amount conflicts
cannot be linked. Explicitly keeping separate requires acknowledgment.

## Source precedence and correction

Linking attaches evidence, not financial corrections. It never changes the
ledger account, amount, date, currency, payee, category or manual-rule protections.
The source's purchase/settlement dates and raw parsed values remain in provenance.
Posted OFX evidence can support an explicit clearing action; neither OFX uploads
nor Gmail notifications automatically clear an entry. Gmail alone is not accepted
as bank-posting evidence; a user may independently verify a statement manually.

Transactions → Reconcile → Source matching re-evaluates existing observations
without posting. Draft rows open the existing import review, where the user can
link, keep separate or skip. Completed sources can be detached or reassigned to
a compatible existing transaction. Reliable-identity observations move together.
Detachment retains the original pointer and reserved claims as historical evidence,
with SourceDisposition marking the link inactive. Active source counts exclude it.
Repeats of detached identities are blocked until corrected. No source or posting
is deleted by unlinking. Reassigning clearing evidence removes that clearing claim;
completed statement links must first be reopened. Corrections require a reason.

Existing duplicates offers exact-money, nearby-date pairs for explicit inspection.
The user chooses the surviving entry, reviews both records/provenance and the
account-balance change, and confirms that they represent one event. The survivor's
metadata wins; provenance moves to it and the duplicate is soft-deleted through
the ledger. Transfers, openings, schedule completions, refunds and reconciled
entries block ordinary merges. There is no merge-all, automatic balancing entry,
or automatic pairing of opposite-account purchases into transfers.

## Review, clearing and statements

Review (NEEDS_REVIEW/REVIEWED) remains independent of bank status:

- UNCLEARED: no user bank verification.
- CLEARED: explicitly verified, optionally with a linked bank source.
- RECONCILED: included in an active completed statement revision.

Legacy records begin uncleared; migrations never infer bank verification.
Use the ledger's Evidence / clearing action for individual verification, or
Reconcile → Statements for a guided account/cutoff/ending-balance comparison.
Credit-card liabilities use negative ending balances. Opening history must be
explicitly cleared, just like other bank entries.

Statement totals reuse `ledger.balances` with an inclusive historical cutoff
and the selected cleared entry IDs. No SQL money aggregation or independent
balance engine is used. Earlier cleared/reconciled history remains included;
future dates and uncleared entries do not contribute. Clearing records a bank posting
date (source settlement date when available). A posting after the cutoff is excluded
without changing its purchase date. Manual clearing inside a statement attests posting
by that statement cutoff; individual clearing permits an explicit posting date. Changes
that affect an earlier completed statement require reopening it. Financial corrections
remove clearing until verified again; metadata-only edits do not. Completion requires exact
Decimal equality, no outstanding relevant draft bank sources/conflicts, and no
completed same-date or later statement. Sources may be explicitly skipped or
dismissed if they are not part of the statement. A nonconflicting Gmail notification
alone is not treated as an outstanding posted bank line.

Completion records the included IDs, calculated balance, difference, timestamp,
notes and revision. Database triggers protect included entries, clearing changes
and financial edits/backdated postings through completed cutoffs. Reopening records
a reason and invalidates the chosen statement and all later completed statements
for that account. Earlier valid checkpoints remain locked. Previous included rows
and results remain in immutable audit history; no history is erased.

Brokerage activity/position statement reconciliation is intentionally unavailable.
Investment cash/holdings remain governed by the existing investment services;
ordinary bank-side investment contributions can be reconciled as transfer entries.

## API and storage

Additive migration `sqlite_0011` creates transaction_clearing,
reconciliation_statements, reconciliation_entries, source_dispositions and
reconciliation_audits. Existing financial/source tables are not rebuilt or reset.
Statement balance magnitude uses ExactMoney, with a separate negative flag.
Unique request IDs and statement/revision/transaction membership prevent repeats.
Foreign keys remain enabled, and audit UPDATE/DELETE operations are rejected.

All write APIs use the existing BEGIN IMMEDIATE unit of work and commit audit,
source changes and financial corrections together. Caller-supplied request IDs
make retries idempotent; reuse with different input/target is rejected. Preview
tokens detect stale source, statement and merge decisions. Errors roll back the
whole request; SQLite lock exhaustion retains the existing bounded 503 behavior.

Key routes (under `/api`):

- GET reconciliation/candidates, reconciliation/duplicates, reconciliation/history.
- POST reconciliation/sources/{id}: LINK, UNLINK, REJECT, DISMISS, REOPEN.
- GET/POST reconciliation/sessions; POST reconciliation/sessions/{id}: COMPLETE/REOPEN.
- GET reconciliation/merge-preview; POST reconciliation/merge.
- GET transactions/{id}/sources; POST transactions/{id}/clearing.
- GET transactions adds clearing_status alongside existing filters.

Candidate/history/duplicate scans are paginated. Statements show at most 100
sessions; large archival statement navigation and specialized investment-statement
workflows remain future work. Rules remain classification-only; no configurable
matching-rule engine, material-amount auto-correction, or new provider is introduced.

Audit data is private local financial data, never telemetry. The history view
shows actor, decision time, before/after evidence and correction reasons. Raw
provenance is rendered as text, never email HTML. Existing Google/vault boundaries
and ingestion upload limits remain unchanged.

## Validation fixtures

`tests/test_reconciliation.py` uses isolated migrated SQLite files and synthetic
records, including fake Google responses and the existing synthetic OFX fixture.
It exercises Gmail purchase → one-day-later OFX → one posting with multiple sources
→ explicit clearing → zero-difference statement → repeat import/sync. Other tests
cover correction rollback, exact sub-cent differences, card signs, conflicting
amounts, rejection/reopening, stable identities, protected history and populated
v0.8 upgrades. The deterministic existing demo seed remains unchanged.

Validation on 2026-10-16 (isolated synthetic databases):

| Working directory | Command | Result |
| --- | --- | --- |
| `backend` | `.venv/Scripts/python.exe -m pytest -q` | 331 passed, including clean/populated Alembic migration checks |
| `backend` | `.venv/Scripts/ruff.exe check .` | Passed |
| `backend` | `.venv/Scripts/ruff.exe format --check .` | 103 files formatted |
| `frontend` | `npm.cmd test` | 88 passed across 16 files |
| `frontend` | `npm.cmd run lint` | Passed |
| `frontend` | `npm.cmd run format:check` | Passed |
| `frontend` | `npm.cmd run build` | TypeScript and production build passed |

Local Edge/Playwright checks exercised cross-date import linking, explicit clearing,
statement completion/reopening, source reassignment/unlinking, confirmed duplicate
merging, evidence display and clearing filters at 1440x900 and 390x844, with no
browser JavaScript errors. Scripts, screenshots and generated SQLite files remain
in ignored `.tmp/`; no real Gmail credentials or user database were used. The build
retains non-blocking dependency PURE-annotation and large-chunk warnings. These results describe the implementation checkpoint; the release audit records
additional checks and synchronized version metadata.
