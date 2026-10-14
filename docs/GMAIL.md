# Gmail ingestion (v0.8.0)

Core finances remain offline-capable. Gmail is an optional external read-only source;
processing, candidates, provenance and ledger history stay on this machine. Released
version is 0.8.0. No live personal Gmail account was used during automated tests.

## Setup

1. In Google Cloud, enable Gmail API for your project. Configure Google Auth Platform
   branding/audience and the `https://www.googleapis.com/auth/gmail.readonly` scope.
   Personal Gmail requires an External audience; Internal is for eligible Workspace
   organizations. Add your account as a test user while the app is in Testing.
2. Create an OAuth client of type **Desktop app**. Put its client ID in the backend
   `GOOGLE_OAUTH_CLIENT_ID` environment variable (or ignored root `.env`). If Google
   supplies a client secret, use `GOOGLE_OAUTH_CLIENT_SECRET`. A desktop app is a public
   client; this value is not a confidential server authentication guarantee. Do not
   put either value or downloaded client JSON in React or Git.
3. Run `uv sync --project backend`, then `uv run --project backend alembic -c backend/alembic.ini upgrade head`
   from the repository root. Use the ordinary native backend/frontend startup in README.
   Run one API worker. No Gmail configuration is needed to keep using core finances.
4. The backend's OS user must have Windows Credential Manager, macOS Keychain, or an
   unlocked Linux Secret Service keyring. Plaintext/file/fallback keyrings are rejected.
   No automatic encryption-key fallback exists. Container/headless deployment without
   one of these stores cannot connect Gmail; use the native local backend.
5. In **Settings → Gmail**, click Connect, then the explicit Google authorization link.
   A temporary `127.0.0.1` listener on a random port handles the Desktop callback. State
   expires after three minutes and is single-use; PKCE uses S256. The listener closes
   after completion, expiry or disconnect. Keep authorization on this same machine.
6. Choose one label, active target account, optional exact sender allowlist, and a
   historical date range (up to 90 days). Save, then run initial backfill. Saving pauses
   polling. Review the first results before enabling automatic retrieval.

Create the label/filter yourself in Gmail: search for the intended bank sender, choose
Create filter, and apply your dedicated notification label. Finance Tracker only reads
the label IDs returned by Google; it does not create Gmail filters or change messages.

The readonly scope is **restricted** and covers mailbox contents. Labels are application
filters, not OAuth boundaries. No modify/send scope is requested; messages and labels
are never changed. External Testing refresh tokens for this scope normally expire in
seven days. Production distribution can require Google's verification/security review;
this local implementation does not claim verification or bypass Google's consent rules.

## Credentials, reconnect and disconnect

Access/refresh tokens live only in the OS vault, under a key derived from the resolved
local database path. Moving the database requires reconnecting. Tokens are refreshed
before expiry; rotated refresh tokens replace previous values. Revocation/invalid grant
pauses polling and reports RECONNECT_REQUIRED. Reconnection is restricted to the same
mailbox to preserve identity; multi-mailbox support is out of scope.

Disconnect pauses retrieval, clears authorization state, attempts Google revocation
and removes local tokens even when revocation fails. If offline, also remove the app
grant later in your Google Account. Already imported financial records, candidates,
minimal source metadata and message identities remain local. Disconnect is not deletion
of financial history. Cancel an active sync before disconnecting.

## Retrieval and recovery

- Manual synchronization or opt-in 1/5/15-minute polling; manual-only is also available.
  Polling runs while the local backend is open, not as an OS background service.
- At most 20 pages / 1,000 discovered message IDs per run, 100 IDs per page. HTTP calls
  use 15-second timeouts, three attempts, bounded backoff/Retry-After and 2 MiB responses.
  Narrow a large backfill range when the limit is reached. No cursor advances on failure.
- Backfill snapshots the mailbox history ID **before** listing eligible messages, so
  the next incremental pass catches messages arriving during backfill.
- Incremental history follows added messages/label changes and rechecks the current
  label with a minimal message response before fetching a body, then rechecks the full
  response. Opaque history IDs are retained only after all pages persist.
- Expired history (404) triggers a recorded BOUNDED_RECOVERY over the configured start
  or last 90 days, whichever is later, through today. This is not a claim of complete
  recovery after a long offline interval. Reconfigure a historical range to retrieve
  older missing messages explicitly.
- Short SQLite transactions store each candidate and identity together. A persistent
  two-minute lease plus in-process lock prevents overlapping jobs. Interrupted runs
  can retry after lease expiry; previously stored messages are not parsed/posted twice.
  Cancel stops between bounded network calls. No network occurs inside a write transaction.

## Supported formats and parser contract

Only **Synthetic Bank v1**, an intentionally fictional adapter, is currently supported.
There are no verified real-bank notification samples in this repository. Sender matching
is not cryptographic proof of authenticity. Real banks need reviewed sanitized examples
and positive/negative parser fixtures before support can be claimed.

Synthetic sender: `notifications@synthetic-bank.example`.
Exact subject: `[SYNTHETIC BANK] Transaction v1`. Example body:

```text
SYNTHETIC BANK DEMO v1
Date: 01/10/2026
Amount: 85,00
Currency: BRL
Kind: DEBIT_PURCHASE
Description: Fictional grocery purchase
Merchant: Synthetic Grocer
```

Dates use DD/MM/YYYY and amounts use Brazilian comma decimals, optional dot grouping,
and positive exact Decimal values. Supported kinds include debit/credit purchases,
income, PIX directions, transfers, refunds and card payments. PIX requires explicit
classification acknowledgement; transfers/refunds/card payments can only link an existing
compatible ledger entry or be skipped. Cancellation, unknown kind, template changes,
missing fields and invalid amounts remain unposted errors. Different currencies remain
exact and require a matching account; no automatic FX conversion occurs.

`gmail_parsers.py` exposes a registry/protocol independent of ORM and network. It handles
bounded UTF-8 plain/HTML multipart content, preferring plain text, ignoring attachments
and stripping executable HTML. It never loads images, links, styles, scripts or remote
tracking resources. Other encodings/templates are unsupported. Complete message bodies
are ephemeral; persistent provenance contains IDs, sender/subject/timestamps, parser
version and original parsed candidate fields, not complete MIME bodies.

## Review and accounting

One message becomes one existing ImportBatch/SourceRecord. Rules, payees, schedule
suggestions and duplicate previews reuse the CSV/OFX service. Unsupported messages remain
visible with diagnostics and can be skipped; email text is never rendered as HTML.

**Transactions → Gmail review** shows candidates, parser diagnostics, mapped account and
exact amounts. Open a row to edit proposed details/category/payee, explicitly choose
new/link/skip and confirm. Original parsed values remain provenance. Bulk approval is
limited to explicitly selected, unambiguous current-page candidates, at most 25, with
confirmation and one all-or-nothing transaction. Ambiguous/schedule items need individual
review. Stale previews fail safely. Repeated approval does not repost.

Mailbox + message ID has a durable unique claim independent of label and account mapping.
Different notifications for a similar event are possible duplicates, not proven identity.
CSV/OFX and Gmail can explicitly link to one ledger transaction, retaining both sources.
Review remains distinct from bank clearing/reconciliation. No automatic posting exists:
sync alone never changes balances, spending, budgets, holdings or personal income.

## API and storage

`/api/gmail`: status; `/connect`, `/disconnect`; `/labels`; PUT `/configuration`;
POST `/sync`, `/cancel`, `/polling`; GET `/runs`, `/queue`; PUT `/candidates/{batch_id}`;
POST `/approve`. Controls require a loopback Host, `X-Finance-Gmail: 1` and, when present,
an exact allowed Origin. Adjust `GMAIL_LOCAL_ORIGINS` for custom local frontend ports.
OAuth callback uses its separate temporary listener and never logs request URLs/codes.
These guards do not replace OS security against malicious software on the same machine.

Migration `sqlite_0010` adds singleton `gmail_connections` (configuration/cursor/lease),
`gmail_sync_runs` (bounded operational diagnostics), and `gmail_message_claims` (unique
message digest → existing SourceRecord FK). Tokens and bodies are not stored there.
No existing financial tables are rebuilt or reset. Read-only operational errors expose
constant codes, not provider payloads, tokens or request URLs.

## Troubleshooting and validation

- OAUTH_CLIENT_NOT_CONFIGURED: set Desktop client environment and restart backend.
- SECURE_CREDENTIAL_STORE_UNAVAILABLE: unlock/configure a supported OS vault; no plaintext fallback.
- RECONNECT_REQUIRED: consent expired/revoked; reconnect the same mailbox.
- INVALID_LABEL: refresh labels and save a current label ID.
- GOOGLE_RATE_OR_SERVICE_LIMIT / GOOGLE_UNREACHABLE: retry later; cached candidates remain.
- SYNC_LIMIT_NARROW_BACKFILL: split the date range; identities make overlap safe.
- UNSUPPORTED_NOTIFICATION_FORMAT: add a verified adapter; do not force-post guessed data.
- GMAIL_OPERATION_IN_PROGRESS: wait or cancel the active sync before changing configuration.

Tests use synthetic fixtures, an in-memory credential vault and fake Google transport,
including real SQLite migrations and the shared posting path. Never point tests at the
personal database. Live OAuth, OS-vault unlock behavior across platforms and real-bank
templates require separate authorized validation. v0.9 should extend explicit source
matching/conflict review and statement reconciliation, not weaken current identity guards.

Implementation validation on 2026-10-13: 305 backend tests and 85 frontend tests passed;
the Gmail-focused backend suite contains 43 tests. Ruff, ESLint, Prettier, TypeScript
and the production build passed. Fresh migrations and a populated v0.7 upgrade preserve
existing records. A 1440×900 Edge run with fake Google and an isolated synthetic database
exercised the loopback callback, mapping/backfill, review approval, exact balance/budget
changes, duplicate-safe resync, unsupported parser diagnostics, reconnect/disconnect and
existing Transactions/Investments navigation. No live Google authorization was tested.
Build output retains nonblocking dependency annotation and large-chunk warnings.

## Reference decisions

Google's [Desktop OAuth](https://developers.google.com/identity/protocols/oauth2/native-app),
[scope](https://developers.google.com/workspace/gmail/api/auth/scopes),
[sync](https://developers.google.com/workspace/gmail/api/guides/sync) and
[history](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.history/list)
contracts informed this implementation. [OAuth lifecycle](https://developers.google.com/identity/protocols/oauth2)
documents Testing-mode expiry; [keyring](https://keyring.readthedocs.io/en/latest/) provides OS storage.
The roadmap's approved ingestion references were inspected: account-scoped source IDs,
preview-before-posting, adapters and preservation of manual choices were reused as patterns.
We deliberately avoid automatic fuzzy merging, source-payload debug logging and an external
queue. No source components or third-party assets were copied for this implementation.
