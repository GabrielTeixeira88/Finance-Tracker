# Net worth and goals (v0.10.0)

Release version is 0.10.0. See [final audit](RELEASE_0_10_0.md).

## Authoritative values

Net worth is positive financial balances plus manually valued assets, minus negative
financial balances and manual debts. Checking, savings and cash use the existing
ledger. Credit-card debt is negative; an overpayment is an asset. Inactive accounts
remain in historical and current reporting. Brokerage cash and holdings are included
once through the existing historical investment valuation service. Goals never enter
net worth. There is no editable net-worth balance or authoritative report cache.

All aggregation uses Decimal with 60-digit working precision. Money remains exact
TEXT millionths in SQLite and decimal strings on the API. Charts convert only
dimensionless BigInt-normalized coordinates to JavaScript numbers.

## Historical coverage and currency

The history endpoint accepts an explicit inclusive date range, at most 3,660 days,
ending no later than today. The UI offers 1M/3M/6M/YTD/1Y/3Y/ALL/custom; ALL is a
documented ten-year window. Values are end-of-day. Period change compares the two
displayed endpoints and is **not investment performance or reconciled attribution**.
Percentage change is available only with a complete, positive opening value.

Bank history uses `ledger.balance_series`; investment history reuses historical
quantities, raw/manual observations and the established seven-day carry limit.
FX uses `FXBook`, dated EUR-cross rates and its seven-day limit, without fetching
anything. Native values remain visible beside converted values. A genuine zero
position needs no FX quote. Missing required prices, FX or manual observations
make consolidated totals unavailable; known components remain labeled as partial.
Synthetic and live price sources follow the existing market preferences.

## Manual assets and debts

`manual_positions` holds ASSET or LIABILITY records. Categories describe property,
vehicles, collectibles, precious metals, private businesses or other manual items;
they are separate from spending categories and investment securities. Liquidity is
explicit (liquid, marketable, illiquid, unknown). Manual categories cannot represent
existing account/security types, and exact normalized account/security/manual names
are rejected as obvious duplicates. Differently named real-world duplicates cannot
be reliably inferred; users must avoid entering the same holding twice.

`position_observations` contains dated nonnegative values. Latest effective value
at or before the reporting day carries forward until disposal/payoff. Before the
first observation, an owned position is unavailable, not zero. Acquisition cost is
metadata, never an automatic valuation or bank posting. Names and notes are editable;
kind, currency and ownership start are immutable. Currency is inherited from the
parent. Corrections atomically void and replace observations; removal retains a
reason and timestamp. A live position/date has a unique observation.

A mortgage may reference a separate same-currency property. Gross property and
debt are counted independently; no additional equity asset is created. Disposing an
asset or marking debt paid off sets an explicit effective end date, retains prior
history and makes no cash posting. Disposal proceeds are descriptive only.

### Debt payments

This version uses the explicitly manual balance-update workflow. Annual interest
rate, minimum payment, payment frequency and expected payoff date are optional
descriptive fields (`sqlite_0013`); additional notes remain available. There is no
amortization or automatic principal/interest split. Update outstanding principal from verified information.
The update itself never becomes spending. Interest/fees, when recorded in the ledger,
are separate ordinary expenses. Do not record an entire loan payment as an expense
and claim it has been split by this feature. Ledger-integrated principal payments,
amortization schedules and automatic bank-payment linking remain deferred.

## Goals

`goals` has a target, original currency, start, optional deadline, notes and lifecycle.
MANUAL mode sums dated contributions minus withdrawals. ACCOUNT mode uses dated
fixed allocations to same-currency checking/savings/cash accounts; a newer allocation
replaces that goal/account amount rather than adding another contribution.

`goal_entries` retains correction/void history. Allocations are explicit, never
inferred from transfers. The shared total cannot exceed available positive savings
at affected historical dates or today. SQLite's existing serialized writer transaction
makes validation and mutation atomic. Later unrelated ledger withdrawals can reduce
available savings; the UI then warns of over-allocation and withholds goal progress
instead of inflating it. The shared-savings table shows allocated and unallocated
amounts. A goal may be overfunded; its bar caps at 100%, while exact amounts remain.

Statuses are ACTIVE, PAUSED, COMPLETED and ARCHIVED. Completion is explicit.
Archiving is final and releases allocations from today, preserving earlier dates;
create another goal to start again. Manual progress remains historical information
after archive. Goal edits and progress entries never create ledger movements.

Required monthly savings divides the remaining target by available calendar
month-end contributions through the deadline and rounds upward to a cent. A deadline
before the next month-end has no monthly installment opportunity. Missing/past
deadlines return unavailable required saving. Hypothetical projections begin at the
current month-end, assume a constant explicitly entered contribution and **zero
interest/return**, and stop at a 50-year horizon. These are scenarios, not forecasts.
Zero targets are complete; negative targets/contributions are rejected (use an
explicit withdrawal direction). Milestones are 25/50/75/100%. Currency totals are
kept separate, with no conversion of goal allocations.
Active goals due within 30 days are identified separately from overdue goals.

## API and UI

- `GET /api/net-worth/summary?as_of=&currency=` and `/history?start=&end=&currency=`.
- `/api/manual-positions`: list/create, `/{id}` edit, `/{id}/observations` list/add,
  `/{id}/close`; `/manual-observations/{id}/correct` and `/void` retain audit.
- `/api/goals`: list/create, `/{id}` detail/edit, `/{id}/entries`, `/{id}/status`;
  `/goal-entries/{id}/void`, `/goal-allocations` show shared savings. Goal detail accepts
  `as_of` and an exact decimal-string `monthly` scenario assumption.

Net Worth replaces its preview, with Overview/Assets/Liabilities sections. Goals is
a separate sidebar destination. Reports stays a preview. Existing shell, themes,
forms, money display, query invalidation and chart geometry are reused. Account
components navigate to their existing detail; manual rows open valuation/debt history.
No global redesign or new third-party source/assets were introduced.

## Synthetic demo

On an **empty separate local database**, apply Alembic then run from `backend/`:

```powershell
$env:DATABASE_PATH = 'data/wealth-demo.db' # choose an unused local path
uv run alembic upgrade head
uv run python -m app.seed_wealth_demo
```

Relative paths resolve against the project root, not the working directory. Prefer
`data/wealth-demo.db` if keeping the file inside the ignored data directory. Never
delete a database to rerun the demo. Existing workspaces are preserved; repeated
runs are no-ops. The new fixture extends analytics examples with four manual items,
72 monthly valuations, three goals and 18 progress/allocation entries. It supplies
explicit synthetic historical prices/FX to cover the new net-worth chart through
2026-09-30. Older demo commands retain their intentional coverage-gap examples.
No fixture is used as a hardcoded React balance.

## Boundaries

No automatic property pricing, amortization, debt optimization, tax/FIRE modeling,
Monte Carlo, cash movement from a goal, or separate financial-account authority.
Category and liquidity changes describe the current classification of history;
classification history is not versioned. Manual value freshness is visible by date,
but no claim of current market accuracy is made. Missing valuations stay unavailable.

## Validation record — 2026-10-19

- Full backend suite: **362 passed**, including **26 new wealth tests**.
  Includes exact 380,000 − 160,000 = 220,000, property/mortgage equity, brokerage
  cash plus holdings, shared goal allocations, concurrent reservation rejection,
  correction rollback, credit-card signs, missing/future FX, calendar projections,
  and the mandatory 5,300 / 2,500 ledger and 1,000 / 200 cash-flow scenario.
- Full frontend suite: **94 passed** across 17 files. New tests cover navigation,
  as-of period requests, missing coverage, API-backed creation, zero targets and
  maintaining editable projection inputs during query updates, and preventing creation
  before initial goal-list loading completes.
- Ruff lint/format, ESLint, Prettier, TypeScript and production build pass.
- Fresh Alembic migration and populated v0.9 upgrade pass. The populated test compares
  every pre-existing table row and checks SQLite foreign keys/integrity.
- Fresh demo audit: 10 accounts, 516 ledger records, 39 investment activities,
  4,708 price observations, 1,176 FX observations, four manual positions,
  72 manual values, three goals and 18 progress/allocation records. Wealth records
  have identical IDs, values and timestamps across fresh seeds. September coverage
  is complete; restart/reseed preserves synthetic browser edits.
- Isolated Edge checks exercised asset creation and two valuations, linked loan
  creation, descriptive loan terms without changing balances, exact net-worth effect,
  date-range and assets/liabilities chart controls, goal creation/allocation,
  visible over-allocation rejection, projection edits, manual contribution/withdrawal,
  completion/archive, desktop 1440×900 and 1920×1080, and mobile drawer navigation.
  Existing Accounts, Transactions, Budget, Investments and Performance received
  navigation smoke checks; their financial workflows are covered by regression tests.
- Public reference screenshots were inspected beside the approved shell. New screens
  retain dense tables, neutral surfaces, aligned figures and existing step charts.
  They intentionally omit decorative goal imagery and unsupported forecast bands.
  Review captures live under ignored `.tmp/v0100-*.png`; no images or databases are
  added to Git.
- Privacy scan: all nonignored project files and reachable historical blobs inspected,
  with no sensitive-path or credential-pattern findings. This is a pattern-based
  audit, not a claim of exhaustive secret detection.

Nonblocking warnings: the inherited demo seed emits an SQLAlchemy warning when the
existing writer connection is reused; tests confirm atomicity and repeat safety.
The build reports dependency comment annotations and a main bundle over 500 kB.
Consider bundle splitting and workflow refinements in v0.11, not a new finance engine.
