# Life Events and deterministic planning views (unreleased)

Spending → Life Events creates a named, dated context for real purchases. Events
have a type, reporting currency, optional planned budget, description and semantic
color/icon. The budget is context, not a monthly budget target or ledger posting.

`sqlite_0015` adds `life_events` and `life_event_links`. A foreign key connects each
link to a transaction; a unique transaction ID prevents the same purchase being
counted in two events. Existing financial records are unchanged.

## Associations and exact costs

- Create/edit/remove events through `/api/life-events`; link/unlink explicit purchases
  through `/{id}/transactions`. Linking accepts at most 200 IDs and validates the
  whole batch before writing. The UI selects only the displayed page.
- Only live EXPENSE transactions within the event's inclusive date window can be linked.
  Transfers, openings, investment activities and ordinary income are rejected.
- Explicit purchase-linked refunds inherit the event and original category. They reduce
  cost on the credit date, including refunds after the event's end. As-of queries hide
  future credits. Unlinked income is never inferred to be a refund.
- Costs reuse shared spending classification. Cross-currency purchases use the existing
  dated FX provider with at most seven days' prior carry. Native amounts remain visible.
  Missing FX makes total/remaining unavailable, with known subtotal and missing IDs;
  it does not turn missing values into zero.
- Changing dates cannot exclude an already linked purchase; changing currency requires
  unlinking first. Ledger corrections remain authoritative: deleted purchases disappear
  from costs, and later date/category corrections are reflected. Event associations are
  reporting metadata, not a bank-reconciliation lock.
- Removing an event removes only its links, never transactions. No financial values are
  persisted as event totals. The timeline, daily costs and categories derive from the API.

The isolated demo contains four explicitly fictional events linked to existing
purchases: travel, home refresh, festival and education. No additional expenses are
invented to populate them. Events participate in baseline reset and deterministic tests.

## Spending story

Insights produces deterministic templates from exact ledger facts: elapsed-period
spending/income/net flow, recent seven-calendar-day average, remaining days, target
status and category changes versus the same elapsed span of the prior month (clamped
to that month's length). Refunds and transfers use the shared reporting policy.
The month-end pace is explicitly a simple extrapolation, not a prediction. Weekday
totals use recorded dates; hourly heatmaps are not available. No AI or external calls.

## Goal trajectory

Existing goal history remains actual progress. A dashed required line interpolates
from the goal start to its target/deadline; a separate dashed projection adds the
entered monthly contribution at each future month-end after the as-of date. No
interest or returns are assumed. Contribution inputs are temporary scenarios, not
automatic postings or saved schedules. All original exact values remain in a table.

Status precedence: paused/archived, unavailable coverage, completed when saved reaches
target, no deadline, then overdue/off track. Otherwise projected deadline savings at
or above target are on track; at least 90% are at risk; below 90% are off track. Zero
contributions and overfunding are valid. Unsupported horizons beyond 50 years stay
unavailable. Missing coverage never displays an invented actual balance. Existing
same-currency shared-account allocation guards remain unchanged. No tax-aware funding.
