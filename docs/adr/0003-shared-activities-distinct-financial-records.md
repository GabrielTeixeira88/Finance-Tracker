# Shared Activities navigation with distinct financial records

Banking transactions and investment movements currently have separate navigation
homes. Group them under **Activities**, with separate **Transactions** and
**Investment Activity** views, accepting the broader label and an extra view
selection in exchange for one discoverable financial-movement workspace.

This is a navigation boundary, not a ledger unification: preserve distinct tables,
forms and posting services, atomic transfers, activity correction guards and the
single cash effect of investment activities. A future implementation must not
create ordinary transaction twins to populate the shared workspace.

Accepted for the redesign specification on 2026-10-26; implementation awaits
approval of the completed specification. Ingestion, schedules and reconciliation
placement are not decided by this ADR.
