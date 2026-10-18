"""Conservative matching shared by file adapters and future ingestion sources."""

from datetime import date
from decimal import Decimal

from sqlalchemy import inspect, or_, select

from app import schedules
from app.config import get_settings
from app.models import Schedule, ScheduleCompletion, SourceRecord, Transaction


def compatible(row, candidate, account_id):
    return (
        row.deleted_at is None
        and row.account_id == account_id
        and row.currency == candidate.currency
        and row.amount == candidate.amount
        and abs((row.transaction_date - candidate.transaction_date).days)
        <= get_settings().reconciliation_match_days
        and row.direction == ("IN" if candidate.transaction_type == "INCOME" else "OUT")
        and row.transaction_type != "OPENING_BALANCE"
    )


def duplicates(session, source, candidate, account_id):
    claims = list(
        session.scalars(
            select(SourceRecord).where(
                or_(
                    SourceRecord.file_claim == source.source_fingerprint,
                    SourceRecord.external_claim == source.external_fingerprint
                    if source.external_fingerprint
                    else False,
                )
            )
        )
    )
    if claims:
        transactions = {c.transaction_id for c in claims}
        from app.reconciliation_models import SourceDisposition

        changed = any(
            any(
                c.normalized_data.get(key) != source.normalized_data.get(key)
                for key in ("transaction_date", "currency", "transaction_type")
            )
            or Decimal(c.normalized_data["amount"]) != candidate.amount
            for c in claims
        )
        detached = (
            session.scalar(
                select(SourceDisposition.id).where(
                    SourceDisposition.source_id.in_([c.id for c in claims]),
                    SourceDisposition.detached,
                )
            )
            if inspect(session.connection()).has_table("source_dispositions")
            else None
        )
        if detached:
            return (
                "INVALID",
                [],
                "Source identity has a detached link; resolve it without reposting",
            )
        if changed or len(transactions) != 1:
            return (
                "INVALID",
                [],
                "Source identity conflicts with financial values; inspect instead of reposting",
            )
        linked = session.get(Transaction, claims[0].transaction_id)
        if linked and not linked.deleted_at and not compatible(linked, candidate, account_id):
            return "INVALID", [], "Claimed ledger values changed; inspect the source conflict"
        return (
            "EXACT_DUPLICATE",
            [str(claims[0].transaction_id)],
            "This file row or account-scoped source identifier was already recorded",
        )
    days = get_settings().reconciliation_match_days
    start = date.fromordinal(max(1, candidate.transaction_date.toordinal() - days))
    end = date.fromordinal(min(date.max.toordinal(), candidate.transaction_date.toordinal() + days))
    rows = session.scalars(
        select(Transaction)
        .where(
            Transaction.account_id == account_id,
            Transaction.currency == candidate.currency,
            Transaction.amount == candidate.amount,
            Transaction.transaction_date.between(
                start,
                end,
            ),
            Transaction.deleted_at.is_(None),
        )
        .order_by(Transaction.transaction_date, Transaction.id)
    )
    matches = [str(row.id) for row in rows if compatible(row, candidate, account_id)]
    rejected = set()
    if inspect(session.connection()).has_table("source_dispositions"):
        from app.reconciliation_models import SourceDisposition

        state = session.scalar(
            select(SourceDisposition).where(SourceDisposition.source_id == source.id)
        )
        rejected = set(state.rejected_ids) if state else set()
    if matches and rejected:
        matches = [id for id in matches if id not in rejected]
        if not matches:
            return (
                "POSSIBLE_DUPLICATE",
                [],
                "Previous proposals were rejected; explicitly keep separate or skip",
            )
    if not matches:
        from app.rules import normalize

        conflicts = list(
            session.scalars(
                select(Transaction)
                .where(
                    Transaction.account_id == account_id,
                    Transaction.currency == candidate.currency,
                    Transaction.direction
                    == ("IN" if candidate.transaction_type == "INCOME" else "OUT"),
                    Transaction.deleted_at.is_(None),
                    Transaction.transaction_type.in_(["INCOME", "EXPENSE"]),
                    Transaction.transaction_date.between(
                        start,
                        end,
                    ),
                )
                .order_by(Transaction.transaction_date, Transaction.id)
            )
        )
        conflicts = [
            r
            for r in conflicts
            if r.amount != candidate.amount
            and (
                normalize(r.description) == normalize(candidate.description)
                or (candidate.payee_id and candidate.payee_id == r.payee_id)
            )
        ]
        origins = {}
        for tid, origin in session.execute(
            select(SourceRecord.transaction_id, SourceRecord.source_type).where(
                SourceRecord.transaction_id.in_([r.id for r in conflicts])
            )
        ):
            origins.setdefault(tid, set()).add(origin)
        conflicts = [
            r
            for r in conflicts
            if not origins.get(r.id)
            or any(origin != source.source_type for origin in origins[r.id])
        ]
        if conflicts:
            return (
                "CONFLICT",
                [str(r.id) for r in conflicts],
                ("Merchant evidence overlaps but amounts differ; keep separate explicitly or skip"),
            )
    # Same amount/date/account/direction is a conservative candidate, never proof.
    return (
        "POSSIBLE_DUPLICATE" if matches else "NEW",
        matches,
        "Same account, currency, amount and direction within the date window; confirm explicitly"
        if matches
        else "No existing candidate",
    )


def schedule_matches(session, row):
    days = get_settings().schedule_match_days
    start = date.fromordinal(max(1, row.transaction_date.toordinal() - days))
    end = date.fromordinal(min(date.max.toordinal(), row.transaction_date.toordinal() + days))
    result = []
    for schedule in session.scalars(
        select(Schedule).where(
            Schedule.enabled,
            Schedule.account_id == row.account_id,
            Schedule.currency == row.currency,
            Schedule.transaction_type == row.transaction_type,
        )
    ):
        if not schedules.matches_candidate(schedule, row):
            continue
        completed = schedules.completion_map(session, schedule)
        for due in schedules.dates(schedule, start, end):
            completion = completed.get(due)
            result.append(
                {
                    "schedule_id": str(schedule.id),
                    "name": schedule.name,
                    "due_date": due.isoformat(),
                    "transaction_id": str(completion.transaction_id) if completion else None,
                    "status": "COMPLETED" if completion else "EXPECTED",
                }
            )
    return result


def linked_completion(session, transaction_id):
    return session.scalar(
        select(ScheduleCompletion).where(ScheduleCompletion.transaction_id == transaction_id)
    )
