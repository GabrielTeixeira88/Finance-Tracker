"""Read-only ledger history for the overview, not a valuation/reporting engine."""

from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal, localcontext
from itertools import groupby
from typing import Literal
from uuid import UUID

from fastapi import HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import ledger, schemas
from app.models import Category, Transaction
from app.spending import annotate_refunds, flow, refund_map

Period = Literal["1M", "3M", "YTD", "1Y", "ALL"]
ZERO = Decimal("0")


class Point(BaseModel):
    date: date
    balance: Decimal


class Spending(BaseModel):
    category_id: UUID | None
    name: str
    amount: Decimal


class Series(BaseModel):
    currency: str
    opening_balance: Decimal
    total_balance: Decimal
    income: Decimal
    expenses: Decimal
    net_flow: Decimal
    change: Decimal
    change_percent: Decimal | None
    points: list[Point]
    spending: list[Spending]


class History(BaseModel):
    date_from: date
    date_to: date
    series: list[Series]
    accounts: list[schemas.AccountOutput]
    recent_transactions: list[schemas.TransactionOutput]


def history(session: Session, period: Period, end: date) -> History:
    if end.year < 2:
        raise HTTPException(422, "History end date must be in year 0002 or later")
    entries = list(
        session.scalars(
            ledger.transaction_query(date_to=end)
            .order_by(None)
            .order_by(Transaction.transaction_date, Transaction.id)
        )
    )
    from app.investments import cash_entries

    entries.extend(cash_entries(session, end))
    entries.sort(key=lambda entry: (entry.transaction_date, entry.id))
    if period == "ALL":
        start = entries[0].transaction_date if entries else end.replace(day=1)
        if start == date.min:
            raise HTTPException(422, "History starting at year 0001 requires a bounded period")
    elif period == "YTD":
        start = date(end.year, 1, 1)
    else:
        months = {"1M": 1, "3M": 3, "1Y": 12}[period]
        year, month = divmod(end.year * 12 + end.month - months, 12)
        start = date(year, month + 1, 1)
    # ALL and calendar periods include the closing balance immediately before the range.
    account_list = ledger.accounts(session)
    category_names = dict(session.execute(select(Category.id, Category.name)).all())
    refunds = refund_map(session)
    purchases = {t.id: t for t in entries}
    series = []
    account_balances = defaultdict(lambda: ZERO)
    with localcontext() as context:
        context.prec = 60
        for currency in sorted({a.currency for a in account_list}):
            relevant = [t for t in entries if t.currency == currency]
            balance = ZERO
            for entry in relevant:
                value = entry.amount if entry.direction == "IN" else -entry.amount
                account_balances[entry.account_id] += value
                if entry.transaction_date < start:
                    balance += value
            opening = balance
            points = [Point(date=start - timedelta(days=1), balance=opening)]
            income = expenses = ZERO
            spending = defaultdict(lambda: ZERO)
            # Close each day after BOTH transfer sides; no fabricated intra-day spikes.
            for day, group in groupby(
                (t for t in relevant if t.transaction_date >= start),
                key=lambda t: t.transaction_date,
            ):
                for entry in group:
                    balance += entry.amount if entry.direction == "IN" else -entry.amount
                    refund = entry.id in refunds
                    inc, exp = flow(entry.transaction_type, entry.amount, refund)
                    income += inc
                    expenses += exp
                    if entry.transaction_type == "EXPENSE" or refund:
                        category = (
                            purchases[refunds[entry.id]].category_id
                            if refund
                            else entry.category_id
                        )
                        spending[category] += exp
                points.append(Point(date=day, balance=balance))
            if points[-1].date != end:
                points.append(Point(date=end, balance=balance))
            change = balance - opening
            series.append(
                Series(
                    currency=currency,
                    opening_balance=opening,
                    total_balance=balance,
                    income=income,
                    expenses=expenses,
                    net_flow=income - expenses,
                    change=change,
                    change_percent=(change / opening * 100).quantize(Decimal("0.01"))
                    if opening > 0
                    else None,
                    points=points,
                    spending=[
                        Spending(
                            category_id=key,
                            name=category_names.get(key, "Uncategorized"),
                            amount=value,
                        )
                        for key, value in sorted(
                            spending.items(), key=lambda item: (-item[1], str(item[0]))
                        )
                    ],
                )
            )
    for account in account_list:
        account.balance = account_balances[account.id]
    recent = list(session.scalars(ledger.transaction_query(date_from=start, date_to=end).limit(8)))
    return History(
        date_from=start,
        date_to=end,
        series=series,
        accounts=account_list,
        recent_transactions=annotate_refunds(session, recent),
    )
