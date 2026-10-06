# Phase 1 data model

All financial records stay in local PostgreSQL. The ledger is authoritative; there
is no editable or cached account-balance column.

```mermaid
erDiagram
    FinancialAccount ||--o{ Transaction : records
    Category o|--o{ Transaction : labels
    FinancialAccount ||--o{ Transfer : source
    FinancialAccount ||--o{ Transfer : destination
    Transfer o|--|{ Transaction : "exactly two linked sides"
```

## Accounts and categories

`financial_accounts`: UUID id, name, type, three-letter uppercase currency code,
optional institution, active flag, created_at, updated_at. Supported types:

| Type | Meaning in this phase |
| --- | --- |
| CHECKING | Everyday bank account |
| SAVINGS | Savings cash account |
| CASH | Physical cash |
| CREDIT_CARD | Signed balance; debt is negative |
| INVESTMENT | Account type only; cash ledger, no holdings or valuation |

Currency is required by the domain and immutable through account updates. BRL is
only a frontend/demo default. ISO-style codes are shape-validated; no external
currency registry, exchange rates, or per-currency minor-unit rules are implemented.
Account deletion deactivates it. Historical balances remain in dashboard totals,
and new postings/transfers to inactive accounts are rejected. Existing ordinary
entries can still be corrected or soft-deleted on an inactive account.

`categories`: UUID id, user-defined name, created_at, updated_at. Names are unique
case-insensitively after trimming. Categories are applicable to both income and
expense, with no hierarchy. A category cannot be deleted while referenced by any
transaction, including soft-deleted history. Foreign keys enforce this as well as
the API's explicit check.

## Monetary convention

Amounts use PostgreSQL `NUMERIC(24,6)` and Python `Decimal`. They must be finite,
strictly positive, less than 10^18, and have at most six fractional digits. APIs
require decimal **strings**, rejecting JSON numbers rather than risking float
conversion. Excess precision is rejected before persistence, not silently rounded.
Responses serialize money as strings; the frontend formats those strings directly.

Every transaction and transfer stores currency. Composite foreign keys tie it to
the referenced account's currency. No aggregation combines different currencies.
All timestamps are timezone-aware; transaction dates are calendar dates with no
timezone conversion.

## Transactions and opening history

`transactions`: UUID id, account_id, transaction_type, positive amount, currency,
direction, transaction_date, description, optional merchant/category_id, optional
transfer_id, created_at, updated_at, and nullable deleted_at.

| Type | Direction | Income/expense reporting |
| --- | --- | --- |
| INCOME | IN (+) | Income |
| EXPENSE | OUT (-) | Expense |
| TRANSFER | IN or OUT according to linked side | Excluded |
| OPENING_BALANCE | IN for assets, OUT for a starting liability | Excluded |

An account creation may specify nonnegative `opening_balance`, `opening_direction`
(IN by default), and an explicit opening date. A nonzero amount creates one opening
entry atomically with the account. Zero creates no ledger entry, because ledger
amounts must be positive. A partial unique index permits at most one opening entry
per account. There is no independently editable starting-balance field.

Opening entries and transfers are immutable through both the API and database
update/delete triggers. Correcting or reversing them is intentionally deferred.
Ordinary entries can change type (income/expense), amount, date, description,
merchant, and category; their account and currency cannot be reassigned. Updates
retain id/created_at and advance updated_at, but a full revision audit is not yet
implemented. Deleting an ordinary entry sets deleted_at, preserves the row, and
excludes it from balances, lists, and reporting. Retrieve-by-id can still inspect it.
Physical transaction deletion is blocked by a database trigger.

## Transfers

`transfers`: UUID id, source_account_id, destination_account_id, positive amount,
currency, date, description, created_at, updated_at. A transfer links exactly two
transactions through transfer_id: OUT on the source and IN on the destination.

The dedicated API locks the two active accounts in UUID order, inserts the parent
and both entries within one transaction, and commits once. Same-account transfers
and cross-currency transfers are rejected. Composite foreign keys require both
accounts to match the transfer currency. A unique `(transfer_id, direction)`
constraint and a deferred PostgreSQL constraint trigger require two matching sides
(accounts, amount, currency, date, description) when the transaction commits. Any
failure rolls back the parent and both sides. No overdraft prevention is imposed;
negative balances are legitimate, especially for credit cards.

## Balances and dashboard

For each account, sum non-deleted IN amounts minus non-deleted OUT amounts across
**all recorded dates**, including future-dated entries. There is no as-of-date
balance feature yet. Dashboard total account value is the sum of these balances,
including inactive accounts and signed credit-card liabilities, grouped by currency.
INVESTMENT accounts contribute their ledger cash balance only.

The frontend supplies its local current month as `YYYY-MM` to `/api/dashboard`.
The backend includes dates from that month's first day (inclusive) to the next
month's first day (exclusive). Only INCOME contributes to income and only EXPENSE
contributes to expenses. Both opening entries and transfers are excluded. Recent
transactions contain up to ten non-deleted ledger entries, including both transfer
sides. Listing supports basic filters and limit/offset pagination.

Mandatory example: Checking opening 5,000 + income 1,000 - expense 200 - transfer
500 = **5,300**. Savings opening 2,000 + transfer 500 = **2,500**. Reporting is
**1,000 income**, **200 expenses**; the transfer changes neither report total.

## API surface

All paths are under `/api`. IDs are UUIDs. Monetary request/response values are strings.

| Method | Path | Operation |
| --- | --- | --- |
| GET / POST | `/accounts` | List with calculated balances / create with optional opening |
| GET / PUT / DELETE | `/accounts/{id}` | Retrieve / update metadata and active flag / deactivate |
| GET / POST | `/categories` | List / create |
| PUT / DELETE | `/categories/{id}` | Rename / delete when unreferenced |
| GET / POST | `/transactions` | Filtered list / create INCOME or EXPENSE |
| GET / PUT / DELETE | `/transactions/{id}` | Inspect / correct ordinary entry / soft-delete |
| POST | `/transfers` | Atomically create a linked pair |
| GET | `/transfers/{id}` | Inspect the transfer relationship |
| GET | `/dashboard?month=YYYY-MM` | Currency-separated balances and monthly totals |

Transaction filters: `account_id`, `transaction_type`, `category_id`, `date_from`,
`date_to` (both inclusive), `limit` (1–200, default 100), `offset` (default 0).
PUT requests replace the documented editable fields; omitted optional merchant or
category fields clear them. Errors use 404 for missing records, 422 for invalid
input/unsupported currency operations, and 409 for immutable/referenced records or
constraint conflicts. Database exception details are not returned to the browser.

See FastAPI `/docs` for complete request and response schemas.
