# Finance Tracker

Financial concepts used by Finance Tracker. These definitions preserve existing
domain boundaries; they do not prescribe pending navigation or visual decisions.

## Language

**Account cash balance**:
Cash reconstructed from an account's ledger movements, including the cash effect
of investment activities where applicable; it does not include securities value.
_Avoid_: Net worth, portfolio value when referring only to cash.

**Portfolio value**:
The value of scoped investment holdings together with their account cash, using
eligible dated prices and any required exchange rates.
_Avoid_: Performance, investment return.

**Holding**:
An investment position reconstructed from investment activities for a defined
account scope and date, distinct from the movements that created it.
_Avoid_: Investment activity when referring to the resulting position.

**Fixed-income contract**:
An acquisition with immutable contractual terms for a specific account and
instrument, distinct from its later valuation observations and redemptions.

**Net worth**:
Assets less liabilities, including ledger cash, investment holdings and manual
asset/debt observations without counting the same value twice.

**Investment return**:
Investment performance distinguished from contributions and withdrawals under
the stated calculation method and period.
_Avoid_: Balance change as an interchangeable term.

**Time-weighted return (TWR)**:
An investment return that adjusts for external funding flows within the selected
scope; Finance Tracker uses its documented daily end-of-day-flow convention.

**Annualized XIRR**:
A money-weighted investment return reflecting the amounts and dates of investor
cash flows, expressed as an annualized rate under Finance Tracker's actual/365 convention.
_Avoid_: Period TWR or unannualized period growth as interchangeable labels.

**Portfolio composition**:
The observed distribution of portfolio value across holdings or exposure
dimensions, distinct from desired allocations or rebalancing instructions.
_Avoid_: Allocation targets when describing observed composition.

**Paid investment income**:
Investment dividends or interest recorded as paid activity; it excludes merely
accrued fixed-income interest and redeemed principal.

**Net cash flow**:
Personal income minus spending for a stated period and currency scope, using the
shared refund classification and excluding transfers and investment activities.
_Avoid_: Portfolio return, or income minus spending minus investment transfers.

**Budget target**:
A category spending target for a month, distinct from available cash or an
allocation of cash into envelopes.

**Life Event**:
A named association of purchases with a life occurrence and its period; it does
not create additional spending, and linked refunds follow the purchase association.

**Goal allocation**:
A designation of existing eligible savings toward a goal, not a new financial
asset or a transfer of money.

**Goal contribution scenario**:
A hypothetical path from current progress toward a goal using stated planning
contributions without assumed investment growth; it is neither a guaranteed
outcome nor a scheduled ledger posting.

**Transaction review**:
The user's assessment of a transaction's classification and details, independent
of verification against a bank statement.
_Avoid_: Reconciliation, clearing.

**Ingestion candidate**:
A proposed financial record awaiting explicit ingestion decisions, distinct from
an already posted ledger transaction that needs user review.

**Source record**:
A retained observation from an input source, with its provenance and identity,
which may support an existing ledger record without creating another movement.

**Statement reconciliation**:
Verification of an account's cleared ledger history against a statement and its
closing balance, distinct from candidate approval or transaction review.

**Classification rule**:
Explicit matching conditions and metadata actions that can assign a payee,
category or review state without changing a financial movement.

**Historical rule application**:
An explicitly previewed and confirmed classification update to existing history,
distinct from saving an enabled rule for future transactions.
