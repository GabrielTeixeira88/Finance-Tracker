"""Exact investment posting, cash-ledger extension and weighted-average reconstruction."""

from collections import defaultdict
from datetime import UTC, date, datetime
from decimal import Decimal, localcontext
from types import SimpleNamespace
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select

from app import ledger
from app.investment_schemas import settled
from app.models import Asset, FinancialAccount, InvestmentActivity, PriceObservation, Transaction

ZERO = Decimal("0")


def wire(value):
    if isinstance(value, Decimal):
        return format(settled(value), "f")
    if isinstance(value, (date, datetime, UUID)):
        return str(value)
    if isinstance(value, dict):
        return {key: wire(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [wire(item) for item in value]
    if hasattr(value, "__table__"):
        return wire({c.name: getattr(value, c.name) for c in value.__table__.columns})
    return value


def activities(session, account_id=None, as_of=None, include_voided=False):
    query = select(InvestmentActivity)
    if not include_voided:
        query = query.where(InvestmentActivity.voided_at.is_(None))
    if account_id:
        query = query.where(InvestmentActivity.account_id == account_id)
    if as_of:
        query = query.where(InvestmentActivity.activity_date <= as_of)
    return list(
        session.scalars(
            query.order_by(InvestmentActivity.activity_date, InvestmentActivity.sequence)
        )
    )


def cash_entries(session, as_of=None):
    return [
        SimpleNamespace(
            id=row.id,
            account_id=row.account_id,
            currency=row.currency,
            transaction_date=row.activity_date,
            transaction_type="INVESTMENT",
            amount=row.cash_amount,
            direction=row.direction,
            category_id=None,
        )
        for row in activities(session, as_of=as_of)
    ]


def reconstruct(rows):
    positions = {}
    with localcontext() as ctx:
        ctx.prec = 60
        for row in sorted(rows, key=lambda r: (r.activity_date, r.sequence)):
            if row.voided_at is not None:
                continue
            key = (row.account_id, row.asset_id, row.currency)
            position = positions.setdefault(
                key, dict(quantity=ZERO, cost_basis=ZERO, realized=ZERO, income=ZERO)
            )
            if row.activity_type == "BUY":
                position["quantity"] += row.quantity
                position["cost_basis"] += row.cash_amount
            elif row.activity_type == "SELL":
                if row.quantity > position["quantity"]:
                    raise HTTPException(
                        422, "Sale would create a short position, including later activities"
                    )
                basis = (
                    position["cost_basis"]
                    if row.quantity == position["quantity"]
                    else position["cost_basis"] * row.quantity / position["quantity"]
                )
                position["quantity"] -= row.quantity
                position["cost_basis"] -= basis
                position["realized"] += row.cash_amount - basis
            elif row.activity_type in {"DIVIDEND", "INTEREST"}:
                position["income"] += row.cash_amount
    return positions


def validate_cash(session, account_id):
    movements = [
        (t.transaction_date, 0, t.amount if t.direction == "IN" else -t.amount, False)
        for t in session.scalars(
            select(Transaction).where(
                Transaction.account_id == account_id, Transaction.deleted_at.is_(None)
            )
        )
    ]
    movements += [
        (
            r.activity_date,
            r.sequence,
            r.cash_amount if r.direction == "IN" else -r.cash_amount,
            True,
        )
        for r in activities(session, account_id)
    ]
    with localcontext() as ctx:
        ctx.prec = 60
        cash = ZERO
        for _, _, amount, investment in sorted(movements):
            cash += amount
            if investment and cash < 0:
                raise HTTPException(
                    422,
                    "Insufficient investment cash at this or a later activity; "
                    "margin is unsupported",
                )


def post(session, data):
    existing = session.scalar(
        select(InvestmentActivity).where(InvestmentActivity.request_id == data.request_id)
    )
    if existing:
        if any(getattr(existing, key) != value for key, value in data.model_dump().items()):
            raise HTTPException(
                409, "Request identifier already belongs to different activity data"
            )
        return existing
    account = ledger.posting_account(session, data.account_id)
    if account.type != "INVESTMENT" or account.currency != data.currency:
        raise HTTPException(422, "Choose an investment account in the activity currency")
    if data.asset_id:
        asset = ledger.require(session, Asset, data.asset_id)
        if asset.currency != data.currency:
            raise HTTPException(422, "Cross-currency investment activities are unsupported")
    row = InvestmentActivity(
        **data.model_dump(),
        sequence=(session.scalar(select(func.max(InvestmentActivity.sequence))) or 0) + 1,
        cash_amount=data.cash_amount,
        direction="OUT" if data.activity_type in {"BUY", "FEE", "TAX"} else "IN",
    )
    session.add(row)
    session.flush()
    reconstruct(activities(session, account.id))
    validate_cash(session, account.id)
    return row


def void(session, activity_id):
    row = ledger.require(session, InvestmentActivity, activity_id)
    if row.voided_at is None:
        row.voided_at = datetime.now(UTC)
        session.flush()
        reconstruct(activities(session, row.account_id))
        validate_cash(session, row.account_id)
    return row


def portfolio(session, account_id=None, asset_id=None, as_of=None):
    as_of = as_of or date.today()
    accounts = list(
        session.scalars(
            select(FinancialAccount)
            .where(FinancialAccount.type == "INVESTMENT")
            .order_by(FinancialAccount.name, FinancialAccount.id)
        )
    )
    if account_id:
        accounts = [a for a in accounts if a.id == account_id]
        if not accounts:
            raise HTTPException(404, "Investment account not found")
    rows = activities(session, account_id, as_of)
    positions = reconstruct(rows)
    assets = {a.id: a for a in session.scalars(select(Asset))}
    prices = {}
    for p in session.scalars(
        select(PriceObservation)
        .where(PriceObservation.price_date <= as_of)
        .order_by(PriceObservation.price_date, PriceObservation.id)
    ):
        prices[p.asset_id] = p
    with localcontext() as ctx:
        ctx.prec = 60
        holdings = []
        consolidated = {}
        for (aid, security, currency), values in positions.items():
            if security is None or (asset_id and security != asset_id):
                continue
            asset = assets[security]
            p = prices.get(security)
            value = values["quantity"] * p.price if p else ZERO if not values["quantity"] else None
            item = {
                **values,
                "account_id": aid,
                "asset_id": security,
                "symbol": asset.symbol,
                "name": asset.name,
                "exchange": asset.exchange,
                "asset_type": asset.asset_type,
                "currency": currency,
                "average_cost": values["cost_basis"] / values["quantity"]
                if values["quantity"]
                else ZERO,
                "last_price": p.price if p else None,
                "price_date": p.price_date if p else None,
                "price_source": "MANUAL" if p else None,
                "price_stale": bool(p and p.price_date < as_of),
                "market_value": value,
                "unrealized": value - values["cost_basis"] if value is not None else None,
            }
            holdings.append(item)
            total = consolidated.setdefault(
                security, {**item, "account_id": None, **{k: ZERO for k in values}, "accounts": []}
            )
            for field in values:
                total[field] += values[field]
            total["accounts"].append(aid)
        for total in consolidated.values():
            total["average_cost"] = (
                total["cost_basis"] / total["quantity"] if total["quantity"] else ZERO
            )
            total["market_value"] = (
                total["quantity"] * total["last_price"]
                if total["last_price"] is not None
                else ZERO
                if not total["quantity"]
                else None
            )
            total["unrealized"] = (
                total["market_value"] - total["cost_basis"]
                if total["market_value"] is not None
                else None
            )
        cash = defaultdict(lambda: ZERO)
        for t in session.scalars(
            select(Transaction).where(
                Transaction.deleted_at.is_(None), Transaction.transaction_date <= as_of
            )
        ):
            cash[t.account_id] += t.amount if t.direction == "IN" else -t.amount
        for r in rows:
            cash[r.account_id] += r.cash_amount if r.direction == "IN" else -r.cash_amount
        account_reports = []
        totals = {}
        for a in accounts:
            held = [h for h in holdings if h["account_id"] == a.id]
            missing = sum(h["market_value"] is None for h in held)
            known = sum((h["market_value"] or ZERO for h in held), ZERO)
            report = {
                "id": a.id,
                "name": a.name,
                "currency": a.currency,
                "active": a.active,
                "cash": cash[a.id],
                "known_holdings_value": known,
                "missing_prices": missing,
                "market_value": None if missing else known,
                "total_value": None if missing else cash[a.id] + known,
                "cost_basis": sum((h["cost_basis"] for h in held), ZERO),
                "realized": sum(
                    (v["realized"] for (aid, _, _), v in positions.items() if aid == a.id), ZERO
                ),
                "income": sum(
                    (v["income"] for (aid, _, _), v in positions.items() if aid == a.id), ZERO
                ),
            }
            account_reports.append(report)
            total = totals.setdefault(
                a.currency,
                {
                    "currency": a.currency,
                    "cash": ZERO,
                    "known_holdings_value": ZERO,
                    "cost_basis": ZERO,
                    "realized": ZERO,
                    "income": ZERO,
                    "missing_prices": 0,
                },
            )
            for field in (
                "cash",
                "known_holdings_value",
                "cost_basis",
                "realized",
                "income",
                "missing_prices",
            ):
                total[field] += report[field]
        for total in totals.values():
            total["total_value"] = (
                None if total["missing_prices"] else total["cash"] + total["known_holdings_value"]
            )
        return wire(
            {
                "as_of": as_of,
                "method": "WEIGHTED_AVERAGE",
                "accounts": account_reports,
                "totals": list(totals.values()),
                "holdings": sorted(
                    consolidated.values(), key=lambda h: (h["symbol"], h["exchange"], h["currency"])
                ),
                "positions": holdings,
            }
        )
