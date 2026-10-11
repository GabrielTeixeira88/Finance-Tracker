"""Exact, bounded ledger reporting shared by budgets, dashboard and history."""

from collections import defaultdict
from datetime import date
from decimal import Decimal, localcontext

from fastapi import HTTPException
from sqlalchemy import case, select
from sqlalchemy.orm import aliased

from app import ledger, schemas
from app.models import RefundLink, Transaction

ZERO = Decimal(0)


def month_start(value):
    return date.fromisoformat(value + "-01")


def shift(month, delta):
    year, index = divmod(month.year * 12 + month.month - 1 + delta, 12)
    return date(year, index + 1, 1)


def money(value):
    return format(value, "f")


def ratio(value, total):
    return money((value / total * 100).quantize(Decimal("0.01"))) if total > 0 else None


def flow(kind, amount, refund=False):
    if refund:
        return ZERO, -amount
    return (amount, ZERO) if kind == "INCOME" else (ZERO, amount if kind == "EXPENSE" else ZERO)


def refund_map(session):
    return dict(session.execute(select(RefundLink.refund_id, RefundLink.purchase_id)).all())


def annotate_refunds(session, rows):
    """Add reporting context without overwriting the stored credit metadata."""
    if not rows:
        return rows
    purchase = aliased(Transaction)
    links = {
        rid: (pid, category)
        for rid, pid, category in session.execute(
            select(RefundLink.refund_id, RefundLink.purchase_id, purchase.category_id)
            .join(purchase, purchase.id == RefundLink.purchase_id)
            .where(RefundLink.refund_id.in_([row.id for row in rows]))
        )
    }
    for row in rows:
        row.refund_purchase_id, row.spending_category_id = links.get(row.id, (None, None))
    return rows


def report_query(start, end, currency=None, account_id=None):
    purchase = aliased(Transaction)
    category = case(
        (RefundLink.id.is_not(None), purchase.category_id), else_=Transaction.category_id
    )
    payee = case((RefundLink.id.is_not(None), purchase.payee_id), else_=Transaction.payee_id)
    query = (
        select(
            Transaction.id,
            Transaction.transaction_date,
            Transaction.currency,
            Transaction.transaction_type,
            Transaction.amount,
            category.label("category_id"),
            payee.label("payee_id"),
            RefundLink.id.label("refund_link_id"),
        )
        .outerjoin(RefundLink, RefundLink.refund_id == Transaction.id)
        .outerjoin(purchase, purchase.id == RefundLink.purchase_id)
        .where(
            Transaction.deleted_at.is_(None),
            Transaction.transaction_type.in_(["INCOME", "EXPENSE"]),
            Transaction.transaction_date >= start,
            Transaction.transaction_date < end,
        )
    )
    if currency:
        query = query.where(Transaction.currency == currency)
    if account_id:
        query = query.where(Transaction.account_id == account_id)
    return query


def calculate(session, start, end, currency=None, account_id=None, *, allow_empty=False):
    """Half-open date range; SQL filters, streamed exact Decimal aggregation (no SQL SUM)."""
    if start >= end and not allow_empty:
        raise HTTPException(422, "Start date must precede exclusive end date")
    result = defaultdict(
        lambda: {
            "income": ZERO,
            "expenses": ZERO,
            "gross_expenses": ZERO,
            "refunds": ZERO,
            "categories": defaultdict(lambda: ZERO),
            "payees": defaultdict(lambda: ZERO),
            "daily": defaultdict(lambda: ZERO),
            "monthly": defaultdict(lambda: [ZERO, ZERO]),
            "count": 0,
        }
    )
    with localcontext() as ctx:
        ctx.prec = 60
        for row in session.execute(report_query(start, end, currency, account_id)).yield_per(500):
            bucket = result[row.currency]
            income, expense = flow(row.transaction_type, row.amount, row.refund_link_id is not None)
            bucket["income"] += income
            bucket["expenses"] += expense
            bucket["monthly"][row.transaction_date.replace(day=1)][0] += income
            bucket["monthly"][row.transaction_date.replace(day=1)][1] += expense
            if row.transaction_type == "EXPENSE" or row.refund_link_id:
                bucket["count"] += 1
                bucket["gross_expenses" if expense > 0 else "refunds"] += abs(expense)
                bucket["categories"][row.category_id] += expense
                bucket["payees"][row.payee_id] += expense
                bucket["daily"][row.transaction_date] += expense
    return result


def associate_refund(session, purchase_id, refund_id):
    purchase = ledger.require(session, Transaction, purchase_id)
    refund = ledger.require(session, Transaction, refund_id)
    if (
        purchase.deleted_at
        or refund.deleted_at
        or purchase.transaction_type != "EXPENSE"
        or refund.transaction_type != "INCOME"
        or purchase.currency != refund.currency
        or refund.transaction_date < purchase.transaction_date
    ):
        raise HTTPException(422, "Link a same-currency income refund dated on/after its expense")
    existing = session.scalar(select(RefundLink).where(RefundLink.refund_id == refund_id))
    if existing:
        if existing.purchase_id == purchase_id:
            return existing
        raise HTTPException(409, "This income is already linked to a purchase")
    amounts = session.scalars(
        select(Transaction.amount)
        .join(RefundLink, RefundLink.refund_id == Transaction.id)
        .where(RefundLink.purchase_id == purchase_id)
    )
    with localcontext() as ctx:
        ctx.prec = 60
        if sum(amounts, ZERO) + refund.amount > purchase.amount:
            raise HTTPException(422, "Combined refunds cannot exceed the original purchase")
    link = RefundLink(purchase_id=purchase_id, refund_id=refund_id)
    session.add(link)
    session.flush()
    return link


def create_refund(session, data):
    purchase = ledger.require(session, Transaction, data.purchase_id)
    row = ledger.create_transaction(
        session,
        schemas.TransactionCreate(
            account_id=data.account_id,
            currency=purchase.currency,
            transaction_type="INCOME",
            amount=data.amount,
            transaction_date=data.transaction_date,
            description=data.description,
            category_id=purchase.category_id,
            payee_id=purchase.payee_id,
        ),
    )
    return associate_refund(session, purchase.id, row.id)


def pace(start, as_of, spending):
    end = shift(start, 1)
    days = (end - start).days
    elapsed = max(0, min(days, (as_of - start).days + 1))
    current = start <= as_of < end
    with localcontext() as ctx:
        ctx.prec = 60
        projection = (
            (spending * days / elapsed).quantize(Decimal("0.000001"))
            if (current and elapsed >= 3 and spending > 0)
            else None
        )
        return {
            "elapsed_days": elapsed,
            "days_in_month": days,
            "elapsed_percent": ratio(Decimal(elapsed), Decimal(days)),
            "projection": money(projection) if projection is not None else None,
            "status": "current" if current else "closed" if as_of >= end else "future",
        }
