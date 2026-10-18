# v0.9.0 release audit — 2026-10-18

Scope: Multi-Source Reconciliation. No v0.10 functionality or global UI redesign.
See [workflow, API and limitations](RECONCILIATION.md).

## Integrity review

- CSV, OFX and Gmail reuse identity-first matching and the existing atomic ingestion
  service. Exact identities reserve source claims across retries and restarts.
  Date-near, exact-account/currency/amount/direction proposals require explicit action;
  merchant overlap is explanatory evidence, never authority to merge.
- Same-merchant, same-amount, same-date purchases can remain separate. Multiple
  candidates and material amount conflicts cannot silently post or overwrite money.
- Linking preserves raw descriptions and manual classifications. Detach/reassign
  retains claims and before/after audit; duplicate correction previews the survivor
  and balance effect, preserves provenance and soft-deletes through the ledger.
- Clearing is independent of review. Gmail alone is not bank-posting evidence.
  Statement calculations use the cutoff and bank dates, exact Decimal money and
  explicit opening-entry verification. Nonzero differences block completion.
- Completed statement memberships lock history. Reopening retains prior results,
  invalidates later account statements, and permits explicit correction/recompletion.
  Database guards complement service validation; audit updates/deletes are rejected.
- Transfer sides can each receive their bank sources without new movements. A card
  purchase plus its payment counts as spending once. Brokerage contributions,
  withdrawals and investment accounting retain the existing regression coverage.
- Rules, manual overrides, schedules, refunds, budgets, market prices/FX and investment
  analytics remain on existing services. No parallel ledger or aggregate patches.

The release audit corrected one defect: PATCH date edits now invalidate clearing,
as PUT financial edits already did. Metadata-only review/category/payee edits do not
invalidate clearing. Locked date edits still reject atomically.
The match-evidence separator typo was also corrected without changing layout.

## Validation commands

Feature-branch result: **336 backend tests passed**, including 25 reconciliation
tests; **88 frontend tests passed** across 16 files. Ruff lint/format (103 files),
ESLint, Prettier, TypeScript and production build passed. Five release-audit backend
tests were added beyond the implementation checkpoint's 331-test suite.

From `backend/`:

```text
.venv/Scripts/python.exe -m pytest -q
.venv/Scripts/ruff.exe check .
.venv/Scripts/ruff.exe format --check .
```

From `frontend/`:

```text
npm.cmd test
npm.cmd run lint
npm.cmd run format:check
npm.cmd run build
```

Backend tests cover clean migrated SQLite files with Alembic drift checks. The
populated v0.8 migration test snapshots every existing table before/after, including
synthetic Gmail connection/message state and the investment/market/analytics demo.
No user database is reset or migrated by the release audit.

Release additions cover identical legitimate purchases, durable repeat claims,
the exact 5,300 versus 5,250 statement difference, reopening/recompletion, budget
recalculation after merging, PATCH-date clearing invalidation, and card-payment
source linkage. The core scenario remains Checking 5,300, Savings 2,500, income
1,000, expenses 200. Gmail-to-OFX matching yields one 85 expense, not 170.

Edge/Playwright exercised actual OFX file upload, possible-match review, explicit
linking, evidence, clearing, statement completion/reopening, audit display and repeat
OFX import. Additional browser checks exercised source reassignment/unlinking,
confirmed duplicate merge and clearing filters. Desktop 1440x900 and mobile 390x844
screenshots were inspected; no browser JavaScript errors occurred. All server data,
scripts and screenshots remain in ignored `.tmp/`. Google/vault responses were fake.

The initial sandbox blocked esbuild directory traversal; rerunning the same checks
with the required access resolved it. Package metadata formatting was corrected.
Production build retains nonblocking Zod annotation and large-bundle warnings.
No CI workflow is configured; validation is local and repeated on merged main.

## Privacy and release boundaries

Working files and reachable historical blobs were scanned for private file paths
and credential signatures, with no findings. Synthetic fixtures were reviewed;
no real financial data or credentials were introduced. Databases, WAL/SHM, mail,
secrets, backups, logs, dependencies and builds stay ignored. Signature scanning is
not a guarantee against every possible credential format. Audit payloads stay local,
never in application logs or telemetry. Existing OAuth/vault boundaries are unchanged.

GitHub main had no branch protection/applicable rules or open PRs at inspection.
Existing tags and branches are preserved. Canonical/frontend metadata is 0.9.0;
`uv lock --project backend --offline` was regenerated and required no content change
because Hatch supplies dynamic project metadata. The next branch retains 0.9.0.

Known limitations: brokerage activity statements require a separate workflow;
statement lists show at most 100 sessions. No automatic fuzzy merges, balancing
adjustments, matching-rule engine or new provider is introduced. Live Gmail OAuth
and real-bank parser templates remain the v0.8 documented validation gaps. The next
planned release is v0.10 Net Worth, Assets, Liabilities & Financial Goals; no such
functionality is part of this release.
