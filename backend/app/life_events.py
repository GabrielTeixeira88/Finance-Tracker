"""Exact event costs reuse spending/refund classification and dated FX.

Each purchase has at most one event. Refunds inherit the purchase association and
reduce cost on their credit date, even after the event window. Nothing posts cash.
"""

from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal, localcontext
from typing import Literal
from uuid import UUID

from fastapi import HTTPException
from pydantic import Field, model_validator
from sqlalchemy import delete, or_, select

from app import spending
from app.investments import wire
from app.life_event_models import LifeEvent, LifeEventLink
from app.market_valuation import FXBook, preferences
from app.models import Category, RefundLink, Transaction
from app.schemas import Currency, Input, Name, OpeningMoney

ZERO = Decimal(0)


class EventInput(Input):
    name: Name
    description: str = Field(default="", max_length=1000)
    event_type: Literal[
        "TRAVEL", "HOME", "WEDDING", "VEHICLE", "FESTIVAL", "MEDICAL", "EDUCATION", "OTHER"
    ] = "OTHER"
    start_date: date
    end_date: date
    currency: Currency
    color: Literal["primary", "blue", "amber", "purple", "green"] = "primary"
    icon: Literal["calendar", "plane", "home", "heart", "car", "music", "book"] = "calendar"
    planned_budget: OpeningMoney | None = None

    @model_validator(mode="after")
    def dates(self):
        if self.start_date > self.end_date or (self.end_date - self.start_date).days > 3660:
            raise ValueError("Event dates must be ordered and span at most ten years")
        return self


class LinkInput(Input):
    transaction_ids: list[UUID] = Field(min_length=1, max_length=200)


def save(session, data, event=None):
    if event:
        links = list(
            session.scalars(
                select(LifeEventLink.transaction_id).where(LifeEventLink.event_id == event.id)
            )
        )
        if links and data.currency != event.currency:
            raise HTTPException(409, "Unlink event transactions before changing reporting currency")
        if links and session.scalar(
            select(Transaction.id)
            .where(
                Transaction.id.in_(links),
                or_(
                    Transaction.transaction_date < data.start_date,
                    Transaction.transaction_date > data.end_date,
                ),
            )
            .limit(1)
        ):
            raise HTTPException(409, "Event dates must include all linked purchase dates")
        for key, value in data.model_dump().items():
            setattr(event, key, value)
    else:
        event = LifeEvent(**data.model_dump())
        session.add(event)
    session.flush()
    return event


def link(session, event, ids):
    ids = set(ids)
    rows = list(session.scalars(select(Transaction).where(Transaction.id.in_(ids))))
    if len(rows) != len(ids):
        raise HTTPException(404, "Transaction not found")
    if any(
        r.deleted_at
        or r.transaction_type != "EXPENSE"
        or not event.start_date <= r.transaction_date <= event.end_date
        for r in rows
    ):
        raise HTTPException(
            422, "Link live expenses within the event dates; refunds follow their purchase"
        )
    existing = {
        r.transaction_id: r
        for r in session.scalars(select(LifeEventLink).where(LifeEventLink.transaction_id.in_(ids)))
    }
    if any(r.event_id != event.id for r in existing.values()):
        raise HTTPException(409, "A purchase can belong to only one Life Event")
    for tid in ids - existing.keys():
        session.add(LifeEventLink(event_id=event.id, transaction_id=tid))
    session.flush()


def remove(session, event):
    session.execute(delete(LifeEventLink).where(LifeEventLink.event_id == event.id))
    session.delete(event)
    session.flush()


def detail(session, event, as_of):
    if as_of > date.today():
        raise HTTPException(422, "Use a historical event cutoff")
    ids = set(
        session.scalars(
            select(LifeEventLink.transaction_id).where(LifeEventLink.event_id == event.id)
        )
    )
    refund_ids = set(
        session.scalars(select(RefundLink.refund_id).where(RefundLink.purchase_id.in_(ids)))
    )
    categories = {c.id: c.name for c in session.scalars(select(Category))}
    fx = FXBook(session, as_of, preferences(session)["fx_provider"])
    rows = session.execute(
        spending.report_query(date.min, as_of + timedelta(days=1)).where(
            Transaction.id.in_(ids | refund_ids)
        )
    ).all()
    transactions = {
        r.id: r
        for r in session.scalars(select(Transaction).where(Transaction.id.in_(ids | refund_ids)))
    }
    daily, groups, missing, records, native = (
        defaultdict(lambda: ZERO),
        defaultdict(lambda: ZERO),
        [],
        [],
        defaultdict(lambda: ZERO),
    )
    known = ZERO
    with localcontext() as ctx:
        ctx.prec = 60
        for r in rows:
            _, amount = spending.flow(r.transaction_type, r.amount, r.refund_link_id is not None)
            native[r.currency] += amount
            value, provenance = fx.convert(amount, r.currency, event.currency, r.transaction_date)
            if value is None:
                missing.append(str(r.id))
            else:
                known += value
                daily[r.transaction_date] += value
                groups[r.category_id] += value
            records.append(
                dict(
                    id=r.id,
                    date=r.transaction_date,
                    description=transactions[r.id].description,
                    currency=r.currency,
                    amount=amount,
                    value=value,
                    fx=provenance,
                    refund=bool(r.refund_link_id),
                    category_id=r.category_id,
                )
            )
        return wire(
            dict(
                event=event,
                as_of=as_of,
                actual_cost=None if missing else known,
                known_cost=known,
                complete=not missing,
                missing=missing,
                transaction_count=len(rows),
                linked_ids=sorted(str(i) for i in ids),
                remaining=event.planned_budget - known
                if event.planned_budget is not None and not missing
                else None,
                categories=[
                    dict(id=k, name=categories.get(k, "Uncategorized"), value=v)
                    for k, v in groups.items()
                ],
                daily=[dict(date=k, value=v) for k, v in sorted(daily.items())],
                native_totals=[dict(currency=k, value=v) for k, v in sorted(native.items())],
                transactions=sorted(records, key=lambda r: (r["date"], str(r["id"])), reverse=True),
            )
        )
