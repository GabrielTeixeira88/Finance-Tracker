"""Native account detail view, derived solely from existing cash/valuation services."""

from datetime import date, timedelta
from decimal import Decimal

from fastapi import HTTPException

from app import investments, ledger, market_valuation
from app.models import FinancialAccount


def workspace(session, account_id, start, end):
    account = ledger.require(session, FinancialAccount, account_id)
    if start > end or (end - start).days > 3660 or start.year < 2 or end > date.today():
        raise HTTPException(422, "Select an ordered historical range of at most ten years")
    days = [start + timedelta(days=n) for n in range((end - start).days + 1)]
    cash = ledger.balance_series(session, days)
    if account.type == "INVESTMENT":
        history = market_valuation.history(
            session, start, end, account.id, account.currency, serialize=False
        )
        points = history["points"]
        portfolio = investments.portfolio(
            session, account_id=account.id, as_of=end, serialize=False
        )
        summary = portfolio["accounts"][0]
    else:
        points = [
            dict(
                date=day,
                value=cash[day].get(account.id, Decimal(0)),
                known_value=cash[day].get(account.id, Decimal(0)),
                missing_assets=[],
                missing_fx=[],
            )
            for day in days
        ]
        summary = None
    return dict(
        account_id=account.id,
        currency=account.currency,
        start=start,
        end=end,
        cash=cash[end].get(account.id, Decimal(0)),
        value=points[-1]["value"],
        summary=summary,
        history=dict(
            currency=account.currency,
            points=points,
            warning="Ledger cash plus eligible historical investments, counted once.",
            fx_provider="NONE",
        ),
    )
