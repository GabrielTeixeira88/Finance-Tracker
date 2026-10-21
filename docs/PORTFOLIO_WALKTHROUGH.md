# Five-minute Finance Tracker walkthrough

Start the [isolated demo](DEMO.md). Everything belongs to fictional Alex Morgan.
Skip the tour to explore freely, or use Next/Previous to follow its nine stops.
No credentials are requested. The persistent strip identifies the demo on every page.

1. **Overview:** select 1M, 3M or ALL. Compare ledger-derived daily closing balances
   and cash flow. Transfers/openings are excluded from income/expense totals. Expand
   the exact chart-data table when keyboard or numerical inspection is preferable.
2. **Accounts / Transactions:** inspect the credit-card liability and BRL/USD/EUR
   accounts. Search Cedar; open a row and change category/review status. Add a small
   expense and inspect the resulting checking/spending change. Transfers stay in Add
   Transaction and preserve two linked entries.
3. **Budget:** choose September 2026, then another month. Inspect shopping/travel
   rollover. Edit a target; it changes a plan, not cash or past spending.
4. **Settings > Rules / Transactions > Scheduled:** preview a narrow rule before
   applying. Explicit manual choices are protected. Inspect matched, overdue and
   upcoming expectations; no automatic schedule posting occurs.
5. **Demo scenarios:** preview checking CSV. Inspect its existing grocery purchase,
   new stationery item and ambiguous cafe row. Preview OFX to see exact-repeat
   protection. Download the samples to try the normal upload/mapping flow.
6. **Settings > Gmail:** select Simulate Gmail notification, then Review notification.
   Inspect the candidate and confirm explicitly. Repeating simulation retains its
   identity. This is a MIME/parser exercise, not a connected mailbox.
7. **Transactions > Reconcile:** inspect the 85 BRL grocery transaction's two sources.
   Resolve ambiguous evidence explicitly. In Statements select Cash and inspect the
   completed October 2024 statement. Review and clearing are different concepts.
8. **Investments / Performance:** inspect holdings and activities. Select DEMOBENCH
   as benchmark to compare the labeled synthetic price proxy. TWR removes external
   contributions; XIRR uses dated flows. No price or return is hardcoded in React.
9. **Net Worth / Goals:** inspect property, vehicle and dated debts. Goals allocate
   existing savings without adding assets. Edit a goal, then Reset demo to restore
   the validated baseline. Stop the demo process to return to normal startup.

## Engineering discussion

Exact Decimal/string money, auditable openings and linked transfers; separate parsing,
candidate review and posting; many-source-to-one-transaction identity; read-only ledger
projections for analytics; explicit missing coverage; SQLite backup/generation reset;
and reused APIs/services across normal and demo modes. Start with
[architecture](architecture.md), [data model](DATA_MODEL.md) and [tests](DEMO_READINESS.md).

## Reviewer friction and boundaries

- First launch needs Python/Node dependency installation and a frontend build. There
  is no public one-click URL; the subsequent local entry is one Python command.
- Advanced workflows have deliberate confirmation steps; shortcuts prepare a real
  preview rather than bypassing those safeguards.
- The fixed September 2026 fixture is explained in the strip. It is not today's feed.
- Benchmark selection is explicit; the default is no benchmark. Synthetic weekdays
  are not an exchange holiday calendar. No real-time trading or tax reporting is implied.
- The application retains its existing monospaced financial styling and desktop-first
  dense tables. Mobile tables scroll horizontally; the navigation drawer remains usable.
- No independent first-time reviewer was recruited. The scripted browser walkthrough
  provides repeatable interaction evidence, not a claim of a human usability study.

See the [screenshot gallery](../README.md) and [deployment limits](DEMO_DEPLOYMENT.md).
