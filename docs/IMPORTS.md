# Local statement imports (Phase 3)

Use **Transactions → Imports**. Select a file and active account; for CSV, choose
format conventions, inspect the sample and map columns. Preview, review uncertain
rows, explicitly exclude invalid rows, confirm the target account, then confirm
the import. Uploading and previewing never post financial transactions.

Back returns to file/mapping; the original draft stays in history. Opening a draft
after refresh recalculates its preview against current rules and ledger state.
Only explicit confirmation posts. Confirmation is separate from transaction review:
new entries default to NEEDS_REVIEW, unless an explicit rule or user choice sets
REVIEWED. Inspect previous drafts and completed outcomes in the history below.

## Supported files and profiles

- Maximum **2 MiB**, **2,000 nonempty transaction rows**, 100 CSV columns, and 2,000
  characters per source field. Limits apply in both browser and backend. Uploads
  use bounded base64 JSON requests, not an external storage service.
- CSV: UTF-8/BOM or explicitly selected Windows-1252; comma/semicolon delimiter;
  quoted fields; optional header; YYYY-MM-DD, DD/MM/YYYY or MM/DD/YYYY dates.
  Map date, description, amount (or separate debit/credit), optional currency,
  external identifier and type. Indexes are zero-based in the API, one-based in UI.
- Select decimal and optional thousands separators. Grouping must be valid;
  `R$ 1.250,90` and `1,250.90` require their corresponding explicit conventions.
  Money remains Decimal/exact strings throughout; zero, excess precision,
  scientific notation and contradictory debit/credit columns are rejected.
- Amount convention: negative outgoing, positive outgoing, positive amount with
  CREDIT/DEBIT (also INCOME/EXPENSE or C/D), or separate debit/credit columns.
  Missing source currency uses the selected account's currency. A supplied currency
  must match; there is no conversion.
- Save, rename/update, reuse and delete CSV profiles. Profiles preserve conventions,
  column indexes and optional default account. Inspect each new file before preview:
  exporters may reorder columns. A stable **source namespace** scopes bank-provided
  CSV IDs. Without a namespace those IDs are retained but not used as exact identity.
- OFX: legacy SGML and XML bank/card statements via the `ofxtools` adapter. XML is
  additionally checked for well-formed structure. FITID, posted date, signed amount,
  type, name/memo and currency are preserved. One account per file; multi-account,
  brokerage statements, corrections and currency conversions require manual handling.
  DTD/entities, binary files and malformed markup are rejected.
- OFX account identifiers are hashed for identity and masked for display. Institution
  and account-type differences warn; local accounts do not contain bank account
  numbers, so ownership cannot be proved automatically. Explicitly confirm the account.

## Service boundaries

```text
CSV / OFX adapter (ingestion_parsers)
    → validated source-independent Candidate (ingestion_schemas)
    → durable ImportBatch + SourceRecord (ingestion)
    → source identity / candidate matching (ingestion_matching)
    → exact normalized payee + existing rules.evaluate + schedule suggestions
    → explicit decisions + stale-preview check
    → ledger.create_transaction OR link an existing transaction
```

Parsers never access the ledger. The reusable candidate contains date, raw description,
positive amount, currency, income/expense direction and classification metadata.
Description and source values remain separate from normalized payee assignment.
Unknown payees are not created automatically. Rules run through the existing pure
evaluator during preview and normal posting; explicit metadata overrides win.
Inference is not manual learning evidence and does not generate correction examples.

Schedule suggestions reuse the existing recurrence and candidate identity/amount
policy. They include expected and already completed occurrences. New postings that
resemble an occurrence require acknowledgement. Completing an expected occurrence
requires explicit selection; the existing matcher revalidates after posting/linking
inside the same database transaction. No automatic scheduled posting is introduced.

Transfer/payment/refund/contribution-like rows are flagged for explicit classification.
They can be skipped or linked to an existing compatible transaction, including a
transfer side. Only ordinary income/expense creation is supported by this importer.
Create a linked internal transfer using Add Transaction, then link the source row.
Never use “import as new expense” for an internal transfer or already recorded card
payment. Refunds need a deliberate user decision; a dedicated refund domain is deferred.

## Identity, possible duplicates and confirmation

- Exact file/row identity: hash of selected account, file bytes and row ordinal.
- Exact external identity: selected account + source format + source context + ID.
  OFX context includes the statement bank/institution/account hash. It is never a
  global FITID. Conflicting financial values for an existing identity are invalid.
- Unique nullable file/external claims are acquired only on successful posting or
  explicit linking. Each upload still has its own source observations; many source
  records can reference one transaction. Repeats cannot resurrect soft-deleted entries.
- Existing same-account/currency/amount/date/direction entries are **possible** matches,
  not proof. Description variations across sources are therefore reviewable. Identical
  content within a file without reliable IDs is also a possible duplicate. The user
  chooses new, skip or a compatible existing link. Legitimate same-day purchases are
  allowed as separate explicit postings. No fuzzy or automatic reconciliation occurs.
- Matching uses exact dates (schedule suggestions use the existing bounded date window).
  Candidate linking never changes an existing transaction's metadata or financial fields.
- Reordered or overlapping exports use reliable account-scoped external IDs when present.
  Without those IDs, matching rows require an explicit link/skip/new decision. Decimal
  spellings such as `5` and `5.00` compare by exact value, not textual representation.
- Confirmation uses one BEGIN IMMEDIATE transaction. Postings, source claims, schedule
  completion links and final batch counts commit together, or all roll back. A token
  covers the reviewed rows/rules/decisions; changed previews return 409 for fresh review.
  Repeated confirmation of a completed batch returns its durable outcome, without posting.
- Excluded invalid rows remain auditable. Skipped unclaimed records can be tried again.
  Completed batches cannot be destructively reprocessed. Correct ledger entries using
  their existing safe editing/deletion operations; no bulk import rollback is provided.

## Storage and API

Alembic `sqlite_0005` adds three tables without rebuilding/changing existing ledger rows:

- `import_profiles`: name, validated configuration JSON, optional account FK.
- `import_batches`: source type (extensible string), filename/hash, account FK,
  DRAFT/COMPLETED state, configuration/context, outcome counts and completion timestamp.
- `source_records`: batch FK and unique row ordinal, source type/ID/fingerprints,
  retained mapped raw fields, normalized candidate, errors, decisions, status,
  optional transaction FK, and unique successful identity claims. Transaction FK is
  deliberately nonunique. All records have UUIDs and creation/update timestamps.

API prefix `/api/imports`: POST `/inspect` (sample), GET/POST empty suffix (history/draft),
GET `/{id}` (preview/outcome), PATCH `/{id}/rows/{row}` (decision), POST `/{id}/confirm`.
Profiles use GET/POST `/profiles`, PUT/DELETE `/profiles/{id}`. History uses limit/offset;
the UI displays 50 preview rows per page. Draft preview work is bounded by the file limit,
not intended for unbounded ingestion jobs.

## Privacy and synthetic testing

All raw and normalized records stay inside local SQLite. Original file bytes are
discarded after parsing; only mapped CSV fields or whitelisted OFX transaction fields
are retained. Unmapped CSV columns, full bank account identifiers, signon data and whole
statements are not stored. Import/parser errors never echo complete financial payloads
to logs. The OFX parser's payload-capable loggers are disabled. Drafts retain useful
provenance until a future explicit retention feature; there is no automatic purge.

Use only the fictional fixtures in `backend/tests/fixtures/synthetic/`:
`br-bom.csv`, `legacy.csv`, `us.csv`, `debit-credit.csv`, `review-workflow.csv`,
`bank-sgml.ofx`, `bank-xml.ofx`, `repeated-fitid.ofx`, and `card.ofx`.
The review fixture contains invalid rows, identical legitimate purchases, a refund,
card payment, transfer and rule/schedule examples. Match its Netflix/Uber rows using
explicit rules and schedules on the chosen synthetic account. Fixtures do not modify
the existing deterministic seed or run at startup.

From `backend/`, run `uv run pytest tests/test_ingestion*.py`; the normal full test
suite also runs these tests and validates clean/populated migrations. Browser writes
must use a separate synthetic DATABASE_PATH. Generated databases, exports, screenshots
and logs remain ignored. No changes to a user's existing database are needed beyond
the reviewed additive migration.
