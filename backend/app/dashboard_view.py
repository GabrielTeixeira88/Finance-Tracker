"""Request-local dashboard projection over the canonical valuation/performance readers.

No postings, refreshes, persisted balances or alternative return calculations.
"""

from datetime import timedelta
from decimal import Decimal, localcontext

from sqlalchemy import func, select

from app import investment_analytics as analytics
from app import investments, market_valuation
from app.models import Transaction


def investment_dashboard(session, start, end, currency, account_ids=None):
    accounts = analytics.scope_accounts(session, account_ids)
    ids = [a.id for a in accounts]
    start = analytics.performance_start(session, start, end, ids)
    history = market_valuation.history(
        session,
        start,
        end,
        reporting_currency=currency,
        account_ids=ids,
        serialize=False,
        include_accounts=True,
    )
    account_histories = history.pop("account_histories")
    performance = analytics.performance(session, start, end, currency, ids, _values=history)
    rows = []
    for account in accounts:
        scoped = {**history, "points": account_histories[account.id]}
        result = analytics.performance(session, start, end, currency, [account.id], _values=scoped)
        rows.append(
            dict(
                id=account.id,
                name=account.name,
                currency=account.currency,
                active=account.active,
                value=result["ending_value"],
                gain=result["absolute_gain"],
                twr=result["twr"],
            )
        )
    # Source's contribution overlay means cumulative external funding, not book cost
    # or the opening market value. Include funding before the selected window.
    first = session.scalar(
        select(func.min(Transaction.transaction_date)).where(
            Transaction.account_id.in_(ids),
            Transaction.deleted_at.is_(None),
            Transaction.transaction_date <= end,
        )
    )
    baseline = min(start, first - timedelta(days=1)) if first and first.year > 1 else start
    fx = market_valuation.FXBook(session, end, market_valuation.preferences(session)["fx_provider"])
    _, daily = analytics.external_flows(session, ids, baseline, end, currency, fx)
    points = []
    with localcontext() as context:
        context.prec = 60
        cumulative = Decimal(0)
        missing = False
        days = sorted(daily)
        index = 0
        for point in history["points"]:
            while index < len(days) and days[index] <= point["date"]:
                amount = daily[days[index]]
                missing = missing or amount is None
                if amount is not None:
                    cumulative += amount
                index += 1
            points.append(
                dict(
                    date=point["date"],
                    value=point["value"],
                    net_contribution=None if missing else cumulative,
                )
            )
    return investments.wire(
        dict(
            performance=performance,
            accounts=rows,
            points=points,
            contribution_method="Cumulative scope-boundary ledger funding; "
            "not cost basis or return. "
            "Missing historical flow FX keeps the overlay unavailable.",
        )
    )
