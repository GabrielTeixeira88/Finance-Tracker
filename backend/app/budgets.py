"""Effective monthly targets; carryover is reconstructed, never a ledger movement."""

from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal, localcontext

from fastapi import HTTPException
from sqlalchemy import select

from app import ledger, spending
from app.models import (
    BudgetGroup,
    BudgetMonthOverride,
    BudgetTarget,
    BudgetVersion,
    Category,
    Payee,
)
from app.spending import ZERO, money, month_start, ratio, shift

FIELDS = ("amount", "active", "rollover_enabled", "group_id", "sort_order")
APPROACHING_PERCENT = Decimal("80")


def settings(row):
    return {key: getattr(row, key) for key in FIELDS}


def save_target(session, data):
    ledger.require(session, Category, data.category_id)
    if data.group_id:
        ledger.require(session, BudgetGroup, data.group_id)
    target = session.scalar(
        select(BudgetTarget).where(
            BudgetTarget.category_id == data.category_id,
            BudgetTarget.currency == data.currency,
        )
    )
    if target is None:
        target = BudgetTarget(category_id=data.category_id, currency=data.currency)
        session.add(target)
        session.flush()
    model = BudgetVersion if data.scope == "default" else BudgetMonthOverride
    month = month_start(data.month)
    row = session.scalar(select(model).where(model.target_id == target.id, model.month == month))
    if row is None:
        row = model(target_id=target.id, month=month)
        session.add(row)
    for field in FIELDS:
        setattr(row, field, getattr(data, field))
    session.flush()
    return {"target_id": str(target.id), "configuration_id": str(row.id)}


def configurations(session, currency, end):
    targets = list(session.scalars(select(BudgetTarget).where(BudgetTarget.currency == currency)))
    versions, overrides = defaultdict(list), {}
    for row in session.scalars(
        select(BudgetVersion)
        .join(BudgetTarget)
        .where(
            BudgetTarget.currency == currency,
            BudgetVersion.month <= end,
        )
        .order_by(BudgetVersion.month)
    ):
        versions[row.target_id].append(row)
    for row in session.scalars(
        select(BudgetMonthOverride)
        .join(BudgetTarget)
        .where(
            BudgetTarget.currency == currency,
            BudgetMonthOverride.month <= end,
        )
    ):
        overrides[row.target_id, row.month] = row
    return targets, versions, overrides


def effective(target_id, month, versions, overrides):
    override = overrides.get((target_id, month))
    if override:
        return override
    return next((r for r in reversed(versions[target_id]) if r.month <= month), None)


def copy_month(session, data):
    destination = month_start(data.month)
    previous = shift(destination, -1)
    targets, versions, overrides = configurations(session, data.currency, destination)
    changes = []
    for target in targets:
        source = effective(target.id, previous, versions, overrides)
        if source is None:
            continue
        existing = overrides.get((target.id, destination))
        if existing and settings(existing) == settings(source):
            continue
        if existing and not data.replace_existing:
            raise HTTPException(409, "This month has overrides; confirm replacement before copying")
        changes.append((target, source, existing))
    for target, source, existing in changes:
        row = existing or BudgetMonthOverride(target_id=target.id, month=destination)
        for key, value in settings(source).items():
            setattr(row, key, value)
        session.add(row)
    session.flush()
    return {"copied": len(changes), "month": data.month}


def status(spent, available, active):
    if not active:
        return "No target"
    if spent > available:
        return "Over target"
    if spent <= 0:
        return "No spending"
    if available > 0 and spent / available * 100 >= APPROACHING_PERCENT:
        return "Approaching target"
    return "On track"


def monthly(session, month, currency, as_of=None):
    as_of = as_of or date.today()
    selected = month_start(month)
    end = shift(selected, 1)
    targets, versions, overrides = configurations(session, currency, selected)
    starts = [r.month for values in versions.values() for r in values]
    starts += [r.month for r in overrides.values()]
    earliest = min([shift(selected, -11), *starts])
    cutoff = end if as_of >= end else as_of + timedelta(days=1)
    # One bounded SQL scan for trend + rollover, selecting only exact reporting columns.
    report = spending.calculate(session, earliest, cutoff, allow_empty=True)
    bucket = report[currency]
    # Category/month accumulation uses the same classification as the common report.
    amounts = defaultdict(lambda: ZERO)
    current_categories, prior_categories, payees, daily = (
        defaultdict(lambda: ZERO) for _ in range(4)
    )
    with localcontext() as ctx:
        ctx.prec = 60
        for row in session.execute(spending.report_query(earliest, cutoff, currency)).yield_per(
            500
        ):
            _, expense = spending.flow(
                row.transaction_type, row.amount, row.refund_link_id is not None
            )
            if row.transaction_type != "EXPENSE" and not row.refund_link_id:
                continue
            row_month = row.transaction_date.replace(day=1)
            amounts[row_month, row.category_id] += expense
            if row_month == selected:
                current_categories[row.category_id] += expense
                payees[row.payee_id] += expense
                daily[row.transaction_date] += expense
            elif row_month == shift(selected, -1):
                prior_categories[row.category_id] += expense
        names = dict(session.execute(select(Category.id, Category.name)).all())
        payee_names = dict(session.execute(select(Payee.id, Payee.name)).all())
        by_category = {t.category_id: t for t in targets}
        rows = []
        for category_id in sorted(
            set(names) | set(current_categories) | set(prior_categories), key=str
        ):
            target = by_category.get(category_id)
            config = effective(target.id, selected, versions, overrides) if target else None
            carry = ZERO
            if (
                target
                and config
                and config.active
                and config.rollover_enabled
                and selected <= as_of.replace(day=1)
            ):
                relevant = [r.month for r in versions[target.id]]
                relevant += [m for (tid, m) in overrides if tid == target.id]
                cursor = min(relevant)
                while cursor < selected:
                    current = effective(target.id, cursor, versions, overrides)
                    if current and current.active and current.rollover_enabled:
                        carry += current.amount - amounts[cursor, category_id]
                    else:
                        carry = ZERO
                    cursor = shift(cursor, 1)
            active = bool(config and config.active)
            base = config.amount if active else ZERO
            available = base + carry
            spent = current_categories[category_id]
            previous = prior_categories[category_id]
            rows.append(
                {
                    "category_id": str(category_id) if category_id else None,
                    "name": names.get(category_id, "Uncategorized"),
                    "target_id": str(target.id) if target else None,
                    "group_id": str(config.group_id) if config and config.group_id else None,
                    "sort_order": config.sort_order if config else 0,
                    "active": active,
                    "rollover_enabled": bool(config and config.rollover_enabled),
                    "override": bool(target and (target.id, selected) in overrides),
                    "target": money(base),
                    "carryover": money(carry),
                    "available": money(available),
                    "spent": money(spent),
                    "remaining": money(available - spent),
                    "percent": ratio(spent, available) if active else None,
                    "status": status(spent, available, active),
                    "previous": money(previous),
                    "change": money(spent - previous),
                    "change_percent": ratio(spent - previous, previous),
                }
            )
        rows.sort(key=lambda r: (r["sort_order"], r["name"], r["category_id"] or ""))
        groups = []
        group_rows = list(
            session.scalars(
                select(BudgetGroup).order_by(
                    BudgetGroup.sort_order, BudgetGroup.name, BudgetGroup.id
                )
            )
        )
        for group in [*group_rows, None]:
            gid = str(group.id) if group else None
            children = [r for r in rows if r["group_id"] == gid]
            sums = {
                field: sum((Decimal(r[field]) for r in children), ZERO)
                for field in ("target", "carryover", "available", "spent", "remaining")
            }
            groups.append(
                {
                    "id": gid,
                    "name": group.name if group else "Ungrouped",
                    "sort_order": group.sort_order if group else 100001,
                    **{k: money(v) for k, v in sums.items()},
                    "percent": ratio(sums["spent"], sums["available"]),
                }
            )
        target_total = sum((Decimal(r["target"]) for r in rows), ZERO)
        carry_total = sum((Decimal(r["carryover"]) for r in rows), ZERO)
        budgeted = sum((Decimal(r["spent"]) for r in rows if r["active"]), ZERO)
        income, expenses = bucket["monthly"][selected]
        previous = bucket["monthly"][shift(selected, -1)][1]
        trend = []
        for index in range(12):
            cursor = shift(selected, index - 11)
            inc, exp = bucket["monthly"][cursor]
            trend.append(
                {
                    "month": cursor.strftime("%Y-%m"),
                    "income": money(inc),
                    "expenses": money(exp),
                    "net_flow": money(inc - exp),
                }
            )
        summary = {
            "target": money(target_total),
            "carryover": money(carry_total),
            "available": money(target_total + carry_total),
            "income": money(income),
            "expenses": money(expenses),
            "net_flow": money(income - expenses),
            "budgeted_spending": money(budgeted),
            "unbudgeted_spending": money(expenses - budgeted),
            "remaining": money(target_total + carry_total - expenses),
            "percent": ratio(expenses, target_total + carry_total),
            "over_count": sum(r["status"] == "Over target" for r in rows),
            "previous": money(previous),
            "change": money(expenses - previous),
            "change_percent": ratio(expenses - previous, previous),
        }
        days = (end - selected).days
        return {
            "month": month,
            "currency": currency,
            "as_of": as_of.isoformat(),
            "date_from": selected.isoformat(),
            "date_to": (end - timedelta(days=1)).isoformat(),
            "other_currencies": sorted(c for c in report if c != currency),
            "summary": summary,
            "categories": rows,
            "groups": groups,
            "trend": trend,
            "pace": spending.pace(selected, as_of, expenses),
            "daily": [
                {
                    "date": (selected + timedelta(days=i)).isoformat(),
                    "amount": money(daily[selected + timedelta(days=i)]),
                }
                for i in range(days)
            ],
            "payees": [
                {
                    "id": str(k) if k else None,
                    "name": payee_names.get(k, "No payee"),
                    "spent": money(v),
                }
                for k, v in sorted(payees.items(), key=lambda x: (-x[1], str(x[0])))[:10]
            ],
        }
