# v0.8.0 release audit — 2026-10-14

Scope: Gmail integration and review-first transaction ingestion. No v0.9 reconciliation
functionality or application-shell redesign is included. See [Gmail setup](GMAIL.md).

## Validation

- Full backend suite: 311 tests; frontend: 85 tests in 15 files. Gmail-focused backend
  coverage: 49 tests, including six release-audit additions for custom/30/90-day windows,
  sender filtering, page limits, concurrent approval and polling/disconnect timing.
- Ruff lint/format, ESLint, Prettier, TypeScript and production build pass. Existing
  dependency annotation and bundle-size warnings are nonblocking.
- Tests migrate fresh temporary SQLite databases and check Alembic drift. A populated
  synthetic v0.7 upgrade snapshots every existing table before/after; financial,
  investment and cache records remain unchanged. No personal database is reset or copied.
- Required accounting scenario stays Checking 5,300, Savings 2,500, income 1,000,
  expenses 200, including after Gmail synchronization. Approval changes budgets once.
- Existing accounts, transfers, payees/rules, schedules, CSV/OFX, budgets, investments,
  market data/FX and investment analytics retain regression coverage.
- Edge at 1440×900, using a separate synthetic SQLite database and fake Google/vault,
  exercised Settings/Gmail, real loopback callback, label/account setup, backfill,
  review confirmation, exact balance/budget effects, resync, unsupported notifications,
  expired authorization/reconnect, disconnect and Transactions/Investments navigation.
  Initial browser setup encountered occupied old test ports; isolated new ports resolved
  the harness issue. Browser artifacts remain ignored under `.tmp`.

## Security and integrity

- Actual Windows Credential Manager was verified by writing, reading and deleting a
  unique synthetic credential through the application's CredentialVault. The cleanup
  was verified. macOS/Linux stores were not exercised on this Windows machine.
- Official Desktop OAuth requests only gmail.readonly, uses PKCE S256 and expiring
  one-use state, and validates the loopback callback Host/path. No authorization codes
  are logged. Tokens remain backend-only in the OS vault, with no plaintext fallback.
- Selected labels are application filters, not a restriction on the Google token.
  Minimal responses check eligibility before bodies are fetched. MIME size/depth/parts
  are bounded; attachments and external resources are not fetched or executed.
- Failed/partial sync leaves checkpoints unchanged; expired history triggers bounded
  recovery. Persistent leases and message claims protect retries and restarts.
- Rules/payees/schedule matching reuse existing services. Source retention is minimal
  metadata plus original parsed fields; complete bodies are ephemeral. Confirmation
  reuses the atomic ledger service. Concurrent/repeated approval posts once.
- Gmail and CSV can explicitly link to one transaction with two provenance records.
  Similar notifications remain possible duplicates, not automatically merged purchases.
- Working files and all reachable historical blobs were scanned for private paths and
  credential signatures; no findings. Synthetic fixtures were reviewed as permitted.
  Database/WAL/SHM files, `.env`, credentials, mail, logs, dependencies and builds remain
  ignored. Pattern scanning is not a guarantee against every possible secret format.
- GitHub main had no branch protection/rules and no open PRs at audit time. No CI
  workflow is configured in this repository; validation was performed locally.

## Explicit release limitations

Live Google consent, token refresh/revocation and mailbox access were **not performed**.
Only the fictional Synthetic Bank v1 format is verified. No real-bank compatibility
or public Google OAuth verification is claimed. Google External Testing expiry and
restricted-scope requirements are documented. The OS vault protects at rest under the
local user's account; it does not guarantee secrecy from malicious local software.

One mailbox and one primary label are supported. Polling requires the local backend
to remain open and one API worker. Backfill/recovery is bounded; long offline gaps can
require explicit historical ranges. Automatic retrieval never implies automatic ledger
posting. Transfers/refunds/card payments require existing-entry linking or skipping.
Full source reconciliation remains v0.9 work.

Release metadata is 0.8.0; the next branch must retain that version until its own release.
Historical commits/tags and existing branches are preserved.
