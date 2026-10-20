# Demo readiness

This is a preparation checklist, not implementation of v0.12.

## Available now

- Existing opt-in seed commands use real SQLite, migrations and financial services.
  Use an unused database path; seeding an existing workspace preserves its contents.
- Synthetic ledger, budget, investment/analytics and wealth fixtures exercise
  historical charts, price-coverage gaps, manual assets/debts and shared goals.
- Product destinations and internal sections can be bookmarked. Rules, payees,
  imports, schedules and reconciliation are discoverable through Find a page.
- Imported files and Gmail candidates follow explicit preview/review/confirmation.
  Browser validation uses synthetic files and a test-only mocked Gmail adapter.
  It does not connect to a real mailbox or external market provider.
- The approved local shell works with live API responses, empty workspaces and
  synthetic data; presentation components do not contain fake financial arrays.

## Still required for v0.12

- One-click isolated demo initialization and clear switching between demo and
  personal workspaces.
- Explicit, safe reset of demo-only state; never reset a user's financial database.
- Guided feature tour, beginner explanations and interviewer-oriented entry points.
- A cohesive synthetic persona across every ingestion/automation workflow.
- Persistent, reproducible browser fixtures instead of developer-local helpers.
- Showcase media and portfolio documentation. Any hosted demo needs a separate
  security review and must not expose real data, credentials or OAuth functionality.

## Suggested review path

Overview → Accounts → Transactions → Create rule → Settings/Rules →
Transactions/Imports → Reconcile → Spending/Budgets → Investments →
Performance → Net Worth → Goals.

Use the documented analytics account/date/benchmark for a fully covered return
example. Other fixtures intentionally demonstrate unavailable values; these are
not zeros or a broken chart. Goal scenarios are hypothetical, not returns.

## Boundaries

Reports remains a labeled preview. Rules retain the existing flat ALL/ANY grammar.
No envelope budgeting, automatic schedule posting, new financial engines, live
demo credentials or reset endpoint is added. Generated databases, screenshots,
browser logs and local reference copies remain ignored. Stable-release readiness
still belongs to v0.13 validation followed by explicit v1.0 acceptance.
