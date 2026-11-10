"""Exact, read-only projections for the source-adapted Spending screens.

This is not another classification engine: personal cash flow comes from spending.flow.
Owned-account transfers are shown separately as saving, never as income or consumption.
"""

from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal, localcontext

from fastapi import HTTPException
from sqlalchemy import select

from app import spending
from app.investments import wire
from app.models import Category, FinancialAccount, Transaction, Transfer

ZERO = Decimal(0)
SPENDING_TYPES = {"CHECKING", "CASH", "CREDIT_CARD"}
SAVING_TYPES = {"SAVINGS", "INVESTMENT"}


def prior_range(start, end, as_of):
    """Match the established dashboard's same-elapsed-month/equal-length convention."""
    if (
        start.day == 1
        and start.replace(day=1) == as_of.replace(day=1)
        and end == as_of + timedelta(days=1)
    ):
        previous = spending.shift(start, -1)
        return previous, min(start, previous + (end - start))
    return start - (end - start), start


def bucket(session, start, end, currency):
    data = spending.calculate(session, start, end, currency)[currency]
    return {key: data[key] for key in ("income", "expenses", "gross_expenses", "refunds", "count")}


def workspace(session, start, end, currency, as_of):
    if not (date(1900, 1, 1) <= start < end <= date(2200, 1, 1)) or (end - start).days > 3660:
        raise HTTPException(422, "Choose an ordered period of at most ten years")
    if not date(1900, 1, 1) <= as_of < date(2200, 1, 1) or end > as_of + timedelta(days=1):
        raise HTTPException(422, "Historical spending cannot include future observations")
    previous_start, previous_end = prior_range(start, end, as_of)
    history_start = min(previous_start, spending.shift(start.replace(day=1), -11))
    with localcontext() as context:
        context.prec = 60
        current = bucket(session, start, end, currency)
        previous = bucket(session, previous_start, previous_end, currency)
        category_names = dict(session.execute(select(Category.id, Category.name)).all())
        categories = defaultdict(
            lambda: {
                "current": ZERO,
                "previous": ZERO,
                "history": defaultdict(lambda: ZERO),
                "daily": defaultdict(lambda: ZERO),
            }
        )
        days = defaultdict(
            lambda: {"income": ZERO, "spending": ZERO, "to_savings": ZERO, "from_savings": ZERO}
        )
        income_sources = defaultdict(lambda: ZERO)
        other_currencies = set()
        for row in session.execute(spending.report_query(history_start, end)).yield_per(500):
            if row.currency != currency:
                if row.transaction_date >= start:
                    other_currencies.add(row.currency)
                continue
            income, expense = spending.flow(
                row.transaction_type, row.amount, row.refund_link_id is not None
            )
            if row.transaction_type == "EXPENSE" or row.refund_link_id:
                category = categories[row.category_id]
                category["history"][row.transaction_date.replace(day=1)] += expense
                if previous_start <= row.transaction_date < previous_end:
                    category["previous"] += expense
                if start <= row.transaction_date < end:
                    category["current"] += expense
                    category["daily"][row.transaction_date] += expense
            if start <= row.transaction_date < end:
                days[row.transaction_date]["income"] += income
                days[row.transaction_date]["spending"] += expense
                if income:
                    income_sources[row.category_id] += income
        account_types = dict(
            session.execute(select(FinancialAccount.id, FinancialAccount.type)).all()
        )
        saving_destinations = defaultdict(lambda: ZERO)
        # A Transfer is the relationship, not two unrelated transaction-side amounts.
        for transfer in session.scalars(
            select(Transfer)
            .join(Transaction, Transaction.id == Transfer.source_entry_id)
            .where(
                Transfer.currency == currency,
                Transfer.transaction_date >= start,
                Transfer.transaction_date < end,
                Transaction.deleted_at.is_(None),
            )
        ):
            source = account_types[transfer.source_account_id]
            destination = account_types[transfer.destination_account_id]
            if source in SPENDING_TYPES and destination in SAVING_TYPES:
                days[transfer.transaction_date]["to_savings"] += transfer.amount
                saving_destinations[transfer.destination_account_id] += transfer.amount
            elif source in SAVING_TYPES and destination in SPENDING_TYPES:
                days[transfer.transaction_date]["from_savings"] += transfer.amount
        daily = []
        weekday = [ZERO] * 7
        cursor = start
        while cursor < end:
            values = days[cursor]
            flow = values["income"] - values["spending"]
            daily.append(
                dict(
                    date=cursor,
                    **values,
                    net_flow=flow,
                    after_savings=flow - values["to_savings"] + values["from_savings"],
                )
            )
            weekday[cursor.weekday()] += values["spending"]
            cursor += timedelta(days=1)
        current["to_savings"] = sum((row["to_savings"] for row in daily), ZERO)
        current["from_savings"] = sum((row["from_savings"] for row in daily), ZERO)
        current["net_saved"] = current["to_savings"] - current["from_savings"]
        current["net_flow"] = current["income"] - current["expenses"]
        current["after_savings"] = current["net_flow"] - current["net_saved"]
        for record in (current, previous):
            record["average_transaction"] = (
                record["expenses"] / record["count"] if record["count"] else None
            )
        current["change"] = current["expenses"] - previous["expenses"]
        current["change_percent"] = spending.ratio(current["change"], previous["expenses"])
        account_names = dict(
            session.execute(select(FinancialAccount.id, FinancialAccount.name)).all()
        )
        result_categories = []
        for cid, values in categories.items():
            if not values["current"] and not values["previous"]:
                continue
            history = []
            month = history_start.replace(day=1)
            while month < end:
                history.append(dict(month=month.strftime("%Y-%m"), amount=values["history"][month]))
                month = spending.shift(month, 1)
            change = values["current"] - values["previous"]
            result_categories.append(
                dict(
                    category_id=cid,
                    name=category_names.get(cid, "Uncategorized"),
                    current=values["current"],
                    previous=values["previous"],
                    change=change,
                    change_percent=spending.ratio(change, values["previous"]),
                    history=history,
                    daily_history=[
                        dict(date=day, amount=value)
                        for day, value in sorted(values["daily"].items())
                    ],
                )
            )
        result_categories.sort(
            key=lambda row: (-row["current"], row["name"], str(row["category_id"]))
        )
        recent = sum((row["spending"] for row in daily[-7:]), ZERO) / min(7, len(daily))
        return wire(
            dict(
                currency=currency,
                start=start,
                end_exclusive=end,
                as_of=as_of,
                previous_start=previous_start,
                previous_end_exclusive=previous_end,
                current=current,
                previous=previous,
                categories=result_categories,
                daily=daily,
                weekdays=[dict(weekday=index, amount=value) for index, value in enumerate(weekday)],
                recent_daily=recent,
                other_currencies=sorted(other_currencies),
                income_sources=[
                    dict(
                        category_id=cid, name=category_names.get(cid, "Other income"), amount=value
                    )
                    for cid, value in income_sources.items()
                ],
                saving_destinations=[
                    dict(account_id=aid, name=account_names[aid], amount=value)
                    for aid, value in saving_destinations.items()
                ],
            )
        )
