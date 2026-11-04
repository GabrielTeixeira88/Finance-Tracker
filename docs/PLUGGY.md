# Pluggy / MeuPluggy read-only integration

Unreleased, explicitly authorized on 2026-10-30. This supersedes the earlier
exclusion of Pluggy integration; it does not authorize payment initiation, AI or
changing the ledger's source-of-truth rules. Core operation remains offline-capable.

## What is implemented

- Settings > Pluggy: OS-vault credential configuration, official hosted Connect
  widget, sandbox toggle, reconnect/consent renewal, existing Item adoption and
  connection discovery where the provider has enabled that API.
- Explicit bank refresh request and retrieval into a local SQLite cache. Bank and
  credit-card accounts/transactions, bills, investment positions/transactions,
  consents, identity and loan data are available as provider evidence, paginated
  and separated by connection/product. Product permissions vary by connector/plan;
  unavailable products are reported, not replaced by invented empty balances.
- Same-currency mapping to existing local accounts/assets. No provider balance is
  copied into an editable balance, opening transaction or fabricated holding.
- Bank review uses the existing import preview, rule/classification, duplicate,
  linking, schedule and atomic confirmation workbench. Investment review uses the
  existing funded-activity/position/duplicate validation and confirmation workbench.
  Charges must be verified explicitly; only supported canonical activities can post.
- Local pause, credential removal, item reconnect and explicit provider Item deletion.
  Local observations, reviews, financial records and source relationships are retained.
  Deleting an Item removes the Pluggy connection; it is not a guarantee that the bank
  has revoked every consent. Use the bank's own consent controls when needed.
- No Payments/PIX initiation, transaction modification at the provider, enrichment/AI
  endpoints, public webhooks, automatic ledger posting or external worker in demo.

## Setup

1. Have a Pluggy developer application with the products/connectors you intend to
   use enabled. Client ID/client secret identify that application; a bank or
   MeuPluggy website password is not an API credential. Plan/production/sandbox
   entitlements and institution availability are controlled by Pluggy.
2. Stop/restart your own normal backend as needed after applying the additive
   migration: from `backend`, run `uv sync --frozen` and `uv run alembic upgrade head`.
   Install/build frontend dependencies as described in README. Do not reset a DB.
3. Run the normal local stack. Use Settings > Pluggy, acknowledge external processing,
   and save the application credentials into Windows Credential Manager, macOS
   Keychain or Linux Secret Service. A supported, unlocked OS vault is required;
   plaintext/file keyrings and silent environment/file fallback are rejected.
   The vault namespace is derived from the resolved local database path.
4. Click Connect institution. Only a short-lived scoped Connect token reaches the
   hosted widget; the backend API key stays in memory and the secret stays in the
   vault. The widget handles bank authentication/MFA/OAuth. Use Reconnect to renew
   or resolve a connection that needs user input. Sandbox institutions are opt-in.
5. Existing connections from your own application can instead be attached using
   their Item ID. Discovery uses `GET /v2/items`, which Pluggy currently enables
   only on request for a team. A 403 here does not prevent manual Item adoption.
6. Choose the connection, request a bank refresh if needed, then Retrieve provider
   data after the asynchronous provider refresh finishes. Retrieval is explicit;
   loading the Settings page does not contact Pluggy. No public callback tunnel is
   required. Cached evidence remains available offline/after credential removal.
7. Map accounts and investments deliberately. For a bank account, open Prepare
   review and choose dates. For an investment, verify the selected page's charges
   and prepare its review. Complete the existing workbench confirmation separately.
   Normal account/security creation remains in Accounts/Holdings.

Custom local ports use `PLUGGY_LOCAL_ORIGINS` (see .env.example). Every integration
control/read requires a loopback Host, approved Origin when present, and the local
application header. Run one API worker. Native vault access is required; Docker or
headless environments without a supported vault cannot use this integration.

## Privacy and lifecycle

Pluggy is an external financial-data processor. It gathers/retains institution data
according to its own service and bank-consent terms. This optional integration is
not a promise that connected bank data exists only on this machine. Finance Tracker
stores its own evidence, history and ledger locally and has no telemetry or cloud
persistence. Third-party connection UI loads only after the user explicitly opens it.

Client secrets are write-only from the application's perspective: no GET response,
React state store, TanStack mutation/query cache, localStorage, SQLite or log contains
saved credentials. The credential form is reset after submission. API keys are cached
server-side below their two-hour validity and cleared on configuration/removal or
shutdown. The scoped widget token exists in memory only until closing/completing it.
Provider URLs/error bodies/payloads are not logged; untrusted pagination URLs are
never followed. Item deletion requires a named confirmation. Local pause only stops
local retrieval; it does not disable Pluggy's own synchronization or revoke consent.

The isolated demo blocks all `/api/pluggy` routes before service/vault access. There
is no normal integration worker in the demo, and no real credentials are seeded.
Databases/WAL/SHM, raw financial exports and credentials remain ignored by Git.

## Financial and identity rules

- JSON numeric tokens are parsed with Decimal (including integer money) and stored
  as exact strings. No financial amount passes through binary float/JS Number.
- Bank debits are negative; card purchases are positive debits and card credits are
  negative. Type/sign disagreement is invalid. Cards never become income merely
  because a provider amount is positive. Pending rows cannot post from this adapter.
- The provider's ISO calendar date is the statement-date convention; preserve the
  complete timestamp and purchase metadata in evidence. UI language never re-parses
  amounts/dates. No implicit timezone shift or guessed FX is applied.
- A supplied amountInAccountCurrency can supply the booked account-currency amount;
  original currency/amount remain in source evidence. Without that fact a currency
  mismatch is invalid, not converted using an invented rate.
- Known transfers, investment cash movements and card credits/payments require an
  existing compatible link or an explicit skip. They cannot be forced into ordinary
  income/expense creation. Other ambiguous descriptions require explicit review.
- Repeated provider IDs are scoped to the mapped account and institution/account
  identity where available. Without stable provider identity, Item/account/Pluggy ID
  scopes apply and weak/content matches require explicit user decisions. Pluggy IDs
  can change during card cycles/reconnects; no fuzzy proposal posts automatically.
- Changed provider payloads retain immutable previous observations. Draft reviews
  become stale and cannot post changed evidence. Re-staging uses the shared source
  conflict/duplicate logic; posted history is never silently edited or deleted.
- Investment positions are observations, not authoritative holdings. Supported
  activities reconstruct holdings through the existing activity service and carry
  exactly one cash posting. Missing history, unknown charges, mismatched net cash,
  oversells and unfunded buys remain errors. BOND contracts/redemptions retain their
  dedicated immutable-term services; generic broker import never bypasses them.
  Unsupported products/movements remain readable evidence, not guessed postings.
- Loan/bill snapshots do not automatically create liabilities, repayments or expenses.
  No balances, debt, portfolio value or income are counted twice from snapshots.

## Local model and API

`sqlite_0016` adds PluggyItem, PluggyResource (current normalized provider envelope +
optional local account/asset mapping) and immutable PluggyObservation revisions.
It preserves all existing rows and extends the investment-source guard to admit
PLUGGY_INVESTMENT while keeping matching batch/source type, account and no ordinary
transaction-twin requirements. Destructive downgrade is refused.

`/api/pluggy` exposes status, write-only credentials, scoped connect tokens,
discovery/adoption, Item refresh/retrieval/pause/delete, paginated cached resources,
observation history, mappings and bank/investment review preparation/history.
Confirmation remains in `/api/imports` or `/api/investments/imports`. Read-only
provider adapters do not depend on financial ORM/domain schemas. Network calls run
before short SQLite write transactions; retrieval publishes all fetched evidence
atomically. One in-process operation lock prevents overlapping controls.

Transport bounds: 15-second requests, 8 MiB responses, up to 40 pages/product,
20,000 records, 50 bank accounts/200 investments per retrieval, and a total retrieval
budget of 256 requests/180 seconds. Rate/permission/service failures preserve the
existing cache. Retry explicitly; no unbounded automatic refresh/backoff loop exists.
A bank review is bounded to 2,000 rows and an investment review to 200 explicit rows.

## Validation and limitations

Tests use isolated migrated SQLite databases, a fake vault and clearly synthetic
provider responses. The browser runner is `node frontend/scripts/pluggy-e2e.mjs`:
it refuses occupied port 5174 and starts its own API/database with no integration
workers or real bank calls. No normal/saved demo database is reset. Existing suites
must continue to pass. Live OAuth/MFA, production MeuPluggy entitlement and actual
institution payload coverage require the user's own authorized local setup; these
are not claimed as tested by the synthetic runs.

The browser runner sets its scratch database configuration before importing the
normal routes, overrides dependencies on the route-owning application, and verifies
the owned workspace before any seed request. Live transport/vault service creation
is forbidden. This is important when reusing FastAPI route objects: copying routes
alone does not replace their original dependency override provider.

Synthetic [desktop/mobile screenshots](screenshots/pluggy/index.html) show the
Settings connection list and the existing investment review handoff. Bank sources
also appear in the existing reconciliation workbench; clearing remains an explicit
user operation, separate from review and provider retrieval.

Validation on 2026-10-30: 443 backend tests and 193 frontend tests passed;
Ruff, ESLint, formatting, TypeScript/production build, the isolated Pluggy browser
runner and the existing full demo browser runner passed. The Pluggy suite includes
31 cases; a final investment-preview display correction was rechecked with the
58-case Pluggy/investment subset. Existing populated-upgrade tests and isolated
fresh migrations pass. Three existing SQLAlchemy seed warnings and the frontend
large-chunk build warning remain.

## Official references inspected

- [Authentication](https://docs.pluggy.ai/en/docs/authentication) and [quick start](https://docs.pluggy.ai/en/docs/quickstart).
- [Cursor transaction API](https://docs.pluggy.ai/en/reference/transaction/transactions-list-by-cursor) and [transaction sign/identity semantics](https://docs.pluggy.ai/en/docs/products/transactions).
- [Card statement cycles](https://docs.pluggy.ai/en/docs/products/credit-card-statement-cycle).
- [Investment activity fields](https://docs.pluggy.ai/en/reference/investment/investment-transactions-list), [bills](https://docs.pluggy.ai/en/reference/bill/bills-list), [consents](https://docs.pluggy.ai/en/reference/consent/consents-list).
- [Opt-in Item discovery](https://docs.pluggy.ai/en/reference/items/items-list-by-cursor) and [Item deletion](https://docs.pluggy.ai/en/reference/items/items-delete).
- Installed official `react-pluggy-connect` / `pluggy-connect-sdk` package source/types.
