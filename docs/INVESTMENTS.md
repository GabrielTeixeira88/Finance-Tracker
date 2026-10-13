# Investment Foundation — implementation decisions

Phase 5 adds activity-derived holdings, exact investment cash and dated manual valuation.

- Reuse FinancialAccount type INVESTMENT. Transfers fund/withdraw cash through the
  existing linked ledger. InvestmentActivity extends that ledger: its immutable
  cash amount/direction is the **only** cash posting for that activity. Shared balance
  and cash-history readers include activities once. No ordinary expense/income twin
  is created; budgets and personal cash flow exclude investment activity.
- Asset identity is normalized symbol + exchange + currency. ISIN is optional metadata;
  no fuzzy merging or remote lookup. Account, asset and activity currency must agree.
- BUY capitalizes fees and taxes; SELL deducts fees/taxes from proceeds. DIVIDEND and
  INTEREST credit net income; standalone FEE/TAX debit once. No margin or short sales.
- Quantities, prices and money accept exact decimal strings with up to six fractional
  digits. Gross quantity × price and cash settle to six digits using half-even rounding.
  Weighted-average reconstruction uses 60-digit Decimal precision, keeps intermediate
  basis unrounded, and releases all residual basis on a full close. Display/API calculated
  money is rounded to six digits. This is tracking, not jurisdictional tax compliance.
- Replay order is activity date then monotonic posting sequence. Historical insertion
  revalidates subsequent positions and investment cash. A correction explicitly voids
  an activity (retaining history) only if replay remains valid, then posts a replacement
  with a new request UUID. Request UUID uniqueness makes retries idempotent; conflicting
  reuse is rejected. Source-linked voids retain their identity and are not reimported.
- Holdings are reconstructed, never editable. Aggregate compatible account positions
  by asset/currency. Closed positions retain realized results. Manual prices are dated,
  never live; future observations are excluded from as-of reports. Missing prices leave
  total market value unavailable; known subtotal and cost basis remain separate.
- Reuse bounded CSV decoding, ImportBatch, SourceRecord, ImportProfile, preview tokens
  and explicit atomic confirmation. A separate typed investment-source link carries
  activity identity claims without pretending trades are ordinary transactions.
  Brokerage mappings/history are distinguished from bank imports. Exact identity repeats
  are no-ops; weak matches require explicit NEW or SKIP. Missing assets require manual
  asset creation and refreshed preview. No parser posts or automatically creates assets.
- Overview/Net Worth remain explicitly cash-balance histories, now including investment
  cash movements. Investment portfolio views expose cash + priced holdings separately;
  no historical market-value series is fabricated from current manual prices.
- The approved shell remains unchanged. Holdings/account/security tables follow the
  inspected investment reference's compact rows, right-aligned data and internal tabs.
  No third-party source is copied for this phase; existing legal notices remain intact.

Deferred: FX trades, security transfers, corporate actions, tax lots, intraday streaming,
performance returns, benchmarks, margin, short sales and automated investment posting.

## Posting and valuation formulas

- BUY: gross = quantity * price; cash debit and added basis = gross + fees + taxes.
- SELL: cash credit = gross - fees - taxes; released basis = prior basis * sold
  quantity / prior quantity; realized result = cash credit - released basis.
- Remaining average cost = remaining basis / remaining quantity; a full sale releases
  all remaining basis. Closed positions retain realized results and investment income.
- DIVIDEND / INTEREST: net cash and investment income = gross - fees - taxes.
- Standalone FEE / TAX: gross is the sole cash debit; additional charges are rejected.
  Standalone charges are not retrospectively allocated into security cost basis.
- Market value = quantity * selected eligible cached price at/before the as-of date.
  Unrealized result = market value - remaining basis. Account value = cash + holdings;
  any missing open-position price makes the complete value unavailable.

Current prices carry their actual date: prior observations up to seven days are
carried; older observations are stale cached values. Historical values require
seven-day coverage. This is a bounded carry policy, not an exchange calendar. Same-day ordering is posting sequence, not
intraday exchange execution time. Ordinary ledger cash is applied before investment
activities on the same date. Posting/voiding checks funding at each investment activity;
existing ordinary-ledger overdraft rules are unchanged. Do not interpret this as a
complete brokerage margin/risk engine.

## API and local workflow

All routes use `/api/investments`:

- GET/POST `/assets`; GET `/assets/{id}` for security/account positions.
- POST `/assets/{id}/prices` for a dated manual observation.
- GET `/portfolio`, `/holdings`, `/accounts`, `/accounts/{id}`; optional `as_of`,
  and optional `account_id` for portfolio/holdings.
- GET `/activities` with account/asset filters, limit and offset; POST
  `/activities/preview`, POST `/activities`, POST `/activities/{id}/void`.
- GET/POST `/imports/profiles`; GET `/imports`; POST `/imports/preview`;
  GET `/imports/{id}`, PATCH `/imports/{id}/rows/{source_id}` and POST
  `/imports/{id}/confirm`.

Create an investment account under Accounts, fund it through Add Transaction ->
Transfer, then create a security and use Investments -> Add activity. Inspect the
calculated gross/net cash before confirming. Open a security to add a manual price.
Void requires confirmation and cannot invalidate subsequent positions or funding;
post a replacement separately. There is no destructive activity edit/delete.

## Generic brokerage CSV

Map zero-based columns for date, type, symbol, exchange, quantity, unit_price,
gross_amount, fees, taxes, currency, external_id and optional notes. Defaults match
`backend/tests/fixtures/synthetic/brokerage.csv`. Supply an explicit broker namespace
when using reliable external IDs. Supported CSV formats are comma/semicolon, UTF-8 or
Windows-1252, ISO/day-first/month-first dates, and explicit decimal/grouping separators.
Limits remain 2 MiB and 2,000 rows. Enter rows in chronological economic order,
particularly purchases preceding related sales. Source records preserve original rows.

Create missing securities before refreshing preview. Invalid rows block confirmation
unless explicitly skipped. Exact account/file/row or account/namespace/external-ID
identities are no-ops; conflicting reuse is rejected. Possible content matches require
NEW (a separate activity) or SKIP. Manual linking to an existing investment activity,
broker-specific type aliases, OFX investment statements and automatic asset lookup
are deferred. Saved brokerage profiles are separate from bank profiles; profile
renaming/replacement UI is not included. Previews and confirmation replay history;
large-history indexing/materialization is future work, not a background queue.

## Synthetic demo and validation

On a separate empty migrated database run `python -m app.seed_investment_demo`.
It adds to the existing deterministic spending fixture: six accounts, 506 ordinary
ledger entries, 74 linked transfers, five securities, 14 investment activities,
four manual observations and two brokerage batches (one exact repeat). The same
security exists in two accounts; examples include a realized loss, closed position,
dividend, interest, fees/taxes, an unpriced position and stale-price behavior when
advancing the as-of date. Symbol examples are fictional holdings, never real records.
Repeated seeding preserves edits and never upgrades/reset-populates an existing demo.

Validation on isolated databases includes fresh migrations, populated Phase 4 upgrade
with unchanged old-table snapshots, foreign keys, deterministic seeds, persistence,
weighted averages, partial/full closes, fractional basis, currency/identity checks,
invalid amounts/oversells, cash integration, rollback and duplicate-safe imports.
Browser acceptance exercises funding, BUY/SELL, dividends/fees, account/security views,
manual/missing prices, preview/confirmation/reimport, existing bank CSV/OFX, budgets,
and the original 5,300 / 2,500 accounting scenario. Screenshots use 1440x900,
1920x1080 and 390px responsive layouts; all artifacts stay ignored in `.tmp`.

Manual observations are add-only (one per asset/date); a price-correction audit workflow
is deferred. The original v0.5 release excludes provider prices, historical market value
and FX; the v0.6.0 extension below adds those. Security transfers, corporate actions,
TWR/IRR, benchmark returns and jurisdictional tax reports remain deferred.

### Validation checkpoint - October 11, 2026

- Full backend suite: 190 passed; 25 investment tests passed again after final
  identity/profile-boundary validation changes. No earlier financial tests removed.
- Frontend: 71 passed, including investment form confirmation, exact holdings,
  missing prices, account/security navigation, manual pricing and import errors.
- Ruff, ESLint, both formatter checks, TypeScript and production build passed.
- Fresh/populated migrations, Alembic drift check and deterministic seed tests passed.
  A live API restart preserved the entire investment portfolio response exactly.
- Investment acceptance plus existing bank-import and budget browser suites passed.
  Budget income/expense totals were unchanged by investment operations.
- Build warnings: existing Zod comment annotations and a main bundle over 500 kB.
  Neither prevents startup; route-level splitting can be considered separately.
- The regular user database was not reset, migrated or seeded for validation.
  All generated databases, logs and screenshots remain ignored; nothing is staged.

## v0.6.0 market-data extension

Provider and manual observations share the extended price table. Security pricing
preferences, explicit coverage gaps, dated FX and portfolio/security charts are
implemented independently of activity posting. Current totals may use labeled stale
cache; historical gaps remain null. Original currencies, cost basis, realized results
and cash are unchanged. See [market-data policy and setup](MARKET_DATA.md).

## Unreleased v0.7 analytics extension

Performance, income and allocation now compose these same reconstruction services.
The earlier performance deferrals describe historical release boundaries; the current
working implementation is documented in [investment analytics](INVESTMENT_ANALYTICS.md).
Activity posting and correction rules remain unchanged.
