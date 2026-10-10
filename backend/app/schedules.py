"""Expected events are projections. Only explicit posting creates a ledger transaction."""

from calendar import monthrange
from datetime import date
from decimal import Decimal, localcontext

from fastapi import HTTPException
from sqlalchemy import select

from app import ledger, schemas
from app.automation_schemas import ScheduleOutput
from app.config import get_settings
from app.models import Category, FinancialAccount, Payee, Schedule, ScheduleCompletion, Transaction
from app.rules import normalize


def dates(schedule, start, end):
    """Inclusive, anchored recurrence with no writes and no permanent February drift."""
    anchor = schedule.start_date
    end = min(end, schedule.end_date or end)
    start = max(start, anchor)
    if not schedule.enabled or start > end:
        return
    if schedule.frequency == "ONCE":
        if start <= anchor <= end:
            yield anchor
        return
    if schedule.frequency in {"WEEKLY", "BIWEEKLY"}:
        step = 7 if schedule.frequency == "WEEKLY" else 14
        offset = max(0, ((start - anchor).days + step - 1) // step)
        ordinal = anchor.toordinal() + offset * step
        while ordinal <= end.toordinal():
            yield date.fromordinal(ordinal)
            ordinal += step
        return
    step = 1 if schedule.frequency == "MONTHLY" else 12
    anchor_month = (anchor.year - 1) * 12 + anchor.month - 1
    first_month = (start.year - 1) * 12 + start.month - 1
    offset = max(0, (first_month - anchor_month) // step)
    while True:
        year_index, month_index = divmod(anchor_month + offset * step, 12)
        if year_index >= 9999:
            return
        year, month = year_index + 1, month_index + 1
        due = date(year, month, min(anchor.day, monthrange(year, month)[1]))
        if due > end:
            return
        if due >= start:
            yield due
        offset += 1


def save_schedule(session, data, schedule=None):
    account = ledger.require(session, FinancialAccount, data.account_id)
    if not account.active and data.enabled:
        raise HTTPException(422, "Enable a schedule only on an active account")
    if account.currency != data.currency:
        raise HTTPException(422, "Schedule currency must match its account")
    for field, model in (("payee_id", Payee), ("category_id", Category)):
        if getattr(data, field):
            ledger.require(session, model, getattr(data, field))
    if schedule and session.scalar(
        select(ScheduleCompletion.id).where(ScheduleCompletion.schedule_id == schedule.id).limit(1)
    ):
        if any(
            getattr(schedule, field) != getattr(data, field)
            for field in ("start_date", "frequency", "account_id", "currency", "transaction_type")
        ):
            raise HTTPException(
                409, "Unlink completions before changing recurrence or account/type"
            )
        last = session.scalar(
            select(ScheduleCompletion.due_date)
            .where(ScheduleCompletion.schedule_id == schedule.id)
            .order_by(ScheduleCompletion.due_date.desc())
            .limit(1)
        )
        if data.end_date and data.end_date < last:
            raise HTTPException(409, "End date cannot exclude confirmed completions")
    if schedule is None:
        schedule = Schedule(**data.model_dump())
        session.add(schedule)
    else:
        for key, value in data.model_dump().items():
            setattr(schedule, key, value)
    session.flush()
    return schedule


def completion_map(session, schedule):
    return {
        c.due_date: c
        for c in session.scalars(
            select(ScheduleCompletion).where(ScheduleCompletion.schedule_id == schedule.id)
        )
    }


def output(session, schedule, today):
    completed = completion_map(session, schedule)
    next_due = next(
        (d for d in dates(schedule, schedule.start_date, date.max) if d not in completed), None
    )
    return ScheduleOutput.model_validate(schedule).model_copy(update={"next_due_date": next_due})


def upcoming(session, start, end, today):
    if start > end or (end - start).days > 366:
        raise HTTPException(422, "Choose an inclusive range of at most 367 days")
    rows, totals = [], {}
    with localcontext() as context:
        context.prec = 60
        for schedule in session.scalars(select(Schedule).order_by(Schedule.name, Schedule.id)):
            completed = completion_map(session, schedule)
            visible_dates = set(dates(schedule, start, end))
            visible_dates.update(d for d in completed if start <= d <= end)
            for due in sorted(visible_dates):
                match = completed.get(due)
                expected = (
                    match.expected
                    if match
                    else {"amount": str(schedule.amount), "currency": schedule.currency}
                )
                rows.append(
                    {
                        "schedule_id": str(schedule.id),
                        "name": schedule.name,
                        "due_date": due,
                        "amount": expected["amount"],
                        "currency": expected["currency"],
                        "transaction_type": schedule.transaction_type,
                        "account_id": str(schedule.account_id),
                        "payee_id": str(schedule.payee_id) if schedule.payee_id else None,
                        "category_id": str(schedule.category_id) if schedule.category_id else None,
                        "frequency": schedule.frequency,
                        "amount_is_approximate": expected.get(
                            "approximate", schedule.amount_is_approximate
                        ),
                        "status": "COMPLETED"
                        if match
                        else "OVERDUE"
                        if due < today
                        else "DUE"
                        if due == today
                        else "UPCOMING",
                        "transaction_id": str(match.transaction_id) if match else None,
                    }
                )
                if not match:
                    total = totals.setdefault(
                        schedule.currency, {"income": Decimal(0), "expenses": Decimal(0)}
                    )
                    total["income" if schedule.transaction_type == "INCOME" else "expenses"] += (
                        schedule.amount
                    )
                if len(rows) > 5000:
                    raise HTTPException(422, "Too many occurrences; choose a shorter date range")
        return {
            "date_from": start,
            "date_to": end,
            "as_of": today,
            "occurrences": sorted(rows, key=lambda r: (r["due_date"], r["schedule_id"])),
            "totals": [
                {
                    "currency": currency,
                    "income": str(t["income"]),
                    "expenses": str(t["expenses"]),
                    "net": str(t["income"] - t["expenses"]),
                }
                for currency, t in sorted(totals.items())
            ],
        }


def require_occurrence(session, schedule, due):
    if not list(dates(schedule, due, due)):
        raise HTTPException(409, "Occurrence is not active on this date")
    if due in completion_map(session, schedule):
        raise HTTPException(409, "Occurrence is already completed")


def matches_candidate(schedule, row):
    """Shared identity/amount policy for ledger and unposted ingestion candidates."""
    identity = (
        row.payee_id == schedule.payee_id
        if schedule.payee_id
        else normalize(row.description) == normalize(schedule.description)
    )
    tolerance = schedule.amount_tolerance if schedule.amount_is_approximate else Decimal(0)
    return identity and abs(row.amount - schedule.amount) <= tolerance


def candidates(session, schedule, due):
    require_occurrence(session, schedule, due)
    days = get_settings().schedule_match_days
    start = date.fromordinal(max(date.min.toordinal(), due.toordinal() - days))
    end = date.fromordinal(min(date.max.toordinal(), due.toordinal() + days))
    query = (
        select(Transaction)
        .where(
            Transaction.deleted_at.is_(None),
            Transaction.account_id == schedule.account_id,
            Transaction.transaction_type == schedule.transaction_type,
            Transaction.currency == schedule.currency,
            Transaction.transaction_date >= start,
            Transaction.transaction_date <= end,
            ~Transaction.id.in_(select(ScheduleCompletion.transaction_id)),
        )
        .order_by(Transaction.transaction_date, Transaction.id)
    )
    matches = []
    tolerance = schedule.amount_tolerance if schedule.amount_is_approximate else Decimal(0)
    for row in session.scalars(query):
        if matches_candidate(schedule, row):
            matches.append(schemas.TransactionOutput.model_validate(row))
    return {
        "candidates": matches,
        "ambiguous": len(matches) > 1,
        "date_tolerance_days": days,
        "amount_tolerance": str(tolerance),
    }


def complete(session, schedule, due, transaction):
    require_occurrence(session, schedule, due)
    match = ScheduleCompletion(
        schedule_id=schedule.id,
        due_date=due,
        transaction_id=transaction.id,
        expected={
            "amount": str(schedule.amount),
            "currency": schedule.currency,
            "name": schedule.name,
            "approximate": schedule.amount_is_approximate,
        },
    )
    session.add(match)
    session.flush()
    return match


def confirm_match(session, schedule, due, transaction_id):
    if transaction_id not in {r.id for r in candidates(session, schedule, due)["candidates"]}:
        raise HTTPException(409, "Transaction is no longer an eligible match; preview again")
    return complete(session, schedule, due, ledger.require(session, Transaction, transaction_id))


def post_occurrence(session, schedule, due, data):
    require_occurrence(session, schedule, due)
    row = ledger.create_transaction(
        session,
        schemas.TransactionCreate(
            account_id=schedule.account_id,
            currency=schedule.currency,
            transaction_type=schedule.transaction_type,
            amount=data.amount,
            transaction_date=data.transaction_date,
            description=schedule.description,
            payee_id=schedule.payee_id,
            category_id=schedule.category_id,
        ),
    )
    complete(session, schedule, due, row)
    return row
