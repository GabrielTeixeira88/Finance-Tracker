"""Conservative matching shared by file adapters and future ingestion sources."""

from datetime import date
from decimal import Decimal

from sqlalchemy import or_, select

from app import schedules
from app.config import get_settings
from app.models import Schedule, ScheduleCompletion, SourceRecord, Transaction


def compatible(row, candidate, account_id):
    return (
        row.deleted_at is None
        and row.account_id == account_id
        and row.currency == candidate.currency
        and row.amount == candidate.amount
        and row.transaction_date == candidate.transaction_date
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
        original = claims[0].normalized_data
        changed = (
            any(
                original.get(key) != source.normalized_data.get(key)
                for key in ("transaction_date", "currency", "transaction_type")
            )
            or Decimal(original["amount"]) != candidate.amount
        )
        if changed or len(transactions) != 1:
            return (
                "INVALID",
                [],
                "Source identity conflicts with financial values; inspect instead of reposting",
            )
        return (
            "EXACT_DUPLICATE",
            [str(claims[0].transaction_id)],
            "This file row or account-scoped source identifier was already recorded",
        )
    rows = session.scalars(
        select(Transaction).where(
            Transaction.account_id == account_id,
            Transaction.currency == candidate.currency,
            Transaction.amount == candidate.amount,
            Transaction.transaction_date == candidate.transaction_date,
            Transaction.deleted_at.is_(None),
        )
    )
    matches = [str(row.id) for row in rows if compatible(row, candidate, account_id)]
    # Same amount/date/account/direction is a conservative candidate, never proof.
    return (
        "POSSIBLE_DUPLICATE" if matches else "NEW",
        matches,
        "Same account, currency, amount, date and direction; inspect before linking"
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
