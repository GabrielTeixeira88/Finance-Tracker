# Preserve focused ingestion review workflows

Bank imports, Gmail review and brokerage imports share visual needs but have
different batch, queue and posting contracts. Keep Imports and Gmail review as
separate tools under Activities and retain distinct brokerage activity review,
accepting tool switching in exchange for preserving existing confirmation safety
without introducing a unified inbox aggregation and approval model.

Reuse review presentation where appropriate. The existing cross-source
reconciliation endpoint serves matching/corrections, not pending approval; do not
repurpose it or introduce a cross-tool Approve all action to simulate an inbox.

Accepted for the redesign specification in Q28 on 2026-10-26; implementation awaits
approval of the completed specification.
