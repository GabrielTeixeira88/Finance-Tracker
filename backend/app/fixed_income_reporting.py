"""Paid redemption results, separate from dividend/interest cash income."""

from decimal import localcontext

from sqlalchemy import select

from app import investments
from app.fixed_income_models import FixedIncomeContract


def redemption_results(session, rows, accounts, assets, start, asset_id=None):
    with localcontext() as ctx:
        ctx.prec = 60
        return _results(session, rows, accounts, assets, start, asset_id)


def _results(session, rows, accounts, assets, start, asset_id):
    contracts = {c.asset_id for c in session.scalars(select(FixedIncomeContract))}
    history, events = [], []
    for row in sorted(rows, key=lambda r: (r.activity_date, r.sequence)):
        history.append(row)
        if (
            row.activity_type != "SELL"
            or row.asset_id not in contracts
            or row.account_id not in accounts
            or row.activity_date < start
            or (asset_id and row.asset_id != asset_id)
        ):
            continue
        key = (row.account_id, row.asset_id, row.currency)
        before = investments.reconstruct(history[:-1])[key]
        after = investments.reconstruct(history)[key]
        principal = before["cost_basis"] - after["cost_basis"]
        events.append(
            dict(
                id=row.id,
                date=row.activity_date,
                account=accounts[row.account_id].name,
                asset_id=row.asset_id,
                symbol=assets[row.asset_id].symbol,
                currency=row.currency,
                principal=principal,
                gross=row.gross_amount,
                fees=row.fees,
                taxes=row.taxes,
                net=row.cash_amount,
                realized=row.cash_amount - principal,
            )
        )
    return events
