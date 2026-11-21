"""Read-only, exact projections for the source-adapted Holdings interface.

This module never posts, values independently, changes cost basis or fetches prices.
Ratios are decimal strings; weights are within each original-currency portfolio.
"""

from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal, localcontext

from sqlalchemy import select

from app import investments
from app.fixed_income_models import FixedIncomeContract
from app.market_valuation import PriceBook
from app.models import FinancialAccount

ZERO = Decimal(0)


def ratio(amount, basis):
    if amount is None or basis is None or basis <= ZERO:
        return None
    return amount / basis


def pair(value):
    # No implicit reporting-currency conversion. Both presentation slots retain
    # the row's original currency; the reporting-currency toggle is not exposed.
    return {"local": value, "base": value}


def holdings(session, account_id=None, as_of=None):
    day = as_of or date.today()
    report = investments.portfolio(session, account_id=account_id, as_of=day, serialize=False)
    rows = investments.activities(session, account_id=account_id, as_of=day)
    prior = investments.reconstruct([r for r in rows if r.activity_date < day])
    accounts = {a.id: a for a in session.scalars(select(FinancialAccount))}
    contracts = {c.asset_id: c for c in session.scalars(select(FixedIncomeContract))}
    prices = PriceBook(session, day)
    buys, sales, costs = (defaultdict(lambda: ZERO) for _ in range(3))
    account_ids = defaultdict(set)
    traded_today = set()
    with localcontext() as ctx:
        ctx.prec = 60
        for activity in rows:
            if activity.asset_id is None:
                continue
            security = activity.asset_id
            if activity.activity_date == day and activity.activity_type in {"BUY", "SELL"}:
                traded_today.add(security)
            account_ids[security].add(activity.account_id)
            if activity.activity_type == "BUY":
                buys[security] += activity.cash_amount
            elif activity.activity_type == "SELL":
                sales[security] += activity.cash_amount
            elif activity.activity_type in {"FEE", "TAX"}:
                costs[security] += activity.cash_amount
    totals = {t["currency"]: t for t in report["totals"]}
    result = []
    with localcontext() as ctx:
        ctx.prec = 60
        # The established API names its consolidated security rows "holdings";
        # "positions" contains one row per account/security pair.
        for item in report["holdings"]:
            sid = item["asset_id"]
            contract = contracts.get(sid)
            current = prices.select(sid, day, historical=True)
            previous = prices.select(sid, day - timedelta(days=1), historical=True)
            prior_quantity = sum(
                (v["quantity"] for (aid, security, _), v in prior.items() if security == sid), ZERO
            )
            # Intraday attribution is unsupported: a changed quantity makes this
            # optional comparison unavailable, rather than counting trades as gains.
            daily = (
                item["quantity"] * (current.price - previous.price)
                if current
                and previous
                and prior_quantity == item["quantity"]
                and sid not in traded_today
                else None
            )
            daily_ratio = (
                ratio(current.price - previous.price, previous.price) if daily is not None else None
            )
            gain = (
                item["unrealized"] + item["realized"] - costs[sid]
                if item["unrealized"] is not None
                else None
            )
            total_return = gain + item["income"] if gain is not None else None
            disposed_basis = buys[sid] - item["cost_basis"]
            total = totals[item["currency"]]
            ids = sorted(account_ids[sid], key=str)
            fixed = contract is not None and contract.instrument_type != "TESOURO_SELIC"
            result.append(
                {
                    "id": str(sid),
                    "holdingType": "SECURITY",
                    "isClosed": item["quantity"] == ZERO,
                    "quantity": item["quantity"],
                    "averagePrice": None if fixed else item["average_cost"],
                    "price": None if fixed else item["last_price"],
                    "priceDate": item["price_date"],
                    "priceSource": item["price_source"],
                    "localCurrency": item["currency"],
                    "baseCurrency": item["currency"],
                    "accountIds": ids,
                    "accountNames": [accounts[aid].name for aid in ids],
                    "instrument": {
                        "id": str(sid),
                        "symbol": item["symbol"],
                        "name": item["name"],
                        "currency": item["currency"],
                        "exchangeMic": item["exchange"],
                        "instrumentType": "FIXED_INCOME" if contract else item["asset_type"],
                        "quoteMode": "CONTRACT"
                        if contract
                        else item["price_source"] or "UNAVAILABLE",
                        "classifications": {
                            "assetType": {
                                "key": contract.instrument_type if contract else item["asset_type"],
                                "name": contract.instrument_type
                                if contract
                                else item["asset_type"],
                            }
                        },
                    },
                    "marketValue": pair(item["market_value"]),
                    "costBasis": pair(item["cost_basis"]),
                    "realizedGain": pair(item["realized"]),
                    "unrealizedGain": pair(item["unrealized"]),
                    "totalGain": pair(gain),
                    "totalReturn": pair(total_return),
                    "returnBasis": pair(buys[sid]),
                    "income": pair(item["income"]),
                    "dayChange": pair(daily),
                    "dayChangePct": daily_ratio,
                    "weight": ratio(item["market_value"], total["total_value"]),
                    "realizedGainPct": ratio(item["realized"], disposed_basis),
                    "unrealizedGainPct": ratio(item["unrealized"], item["cost_basis"]),
                    "totalGainPct": ratio(gain, buys[sid]),
                    "totalReturnPct": ratio(total_return, buys[sid]),
                    "contractMultiplier": Decimal(1),
                    "contract": None
                    if contract is None
                    else {
                        key: getattr(contract, key)
                        for key in (
                            "instrument_type",
                            "maturity_date",
                            "liquidity",
                            "cdi_percent",
                            "annual_rate",
                        )
                    },
                    "saleProceeds": sales[sid],
                }
            )
        for currency, total in totals.items():
            selected = [a for a in report["accounts"] if a["currency"] == currency]
            result.append(
                {
                    "id": f"cash:{currency}",
                    "holdingType": "CASH",
                    "isClosed": False,
                    "quantity": ZERO,
                    "averagePrice": None,
                    "price": None,
                    "priceDate": None,
                    "priceSource": None,
                    "localCurrency": currency,
                    "baseCurrency": currency,
                    "accountIds": [a["id"] for a in selected],
                    "accountNames": [a["name"] for a in selected],
                    "instrument": None,
                    **{
                        key: pair(ZERO)
                        for key in (
                            "costBasis",
                            "realizedGain",
                            "unrealizedGain",
                            "totalGain",
                            "totalReturn",
                            "returnBasis",
                            "income",
                            "dayChange",
                        )
                    },
                    "marketValue": pair(total["cash"]),
                    "weight": ratio(total["cash"], total["total_value"]),
                    **{
                        key: None
                        for key in (
                            "dayChangePct",
                            "realizedGainPct",
                            "unrealizedGainPct",
                            "totalGainPct",
                            "totalReturnPct",
                        )
                    },
                    "contractMultiplier": Decimal(1),
                    "contract": None,
                    "saleProceeds": ZERO,
                }
            )
    return investments.wire(
        {
            "as_of": day,
            "rows": result,
            "weight_scope": "ORIGINAL_CURRENCY_INCLUDING_CASH",
            "totals": report["totals"],
        }
    )


def manual_holdings(session, as_of=None):
    """Reuse dated manual observations; do not infer loan repayments or accrual."""
    from app.wealth import position_values
    from app.wealth_models import ManualPosition

    day = as_of or date.today()
    result = []
    with localcontext() as ctx:
        ctx.prec = 60
        for position in session.scalars(select(ManualPosition).order_by(ManualPosition.name)):
            if position.start_date > day or (position.end_date and position.end_date <= day):
                continue
            observations = [
                row
                for row in position_values(session, position)
                if row.voided_at is None and row.effective_date <= day
            ]
            latest = observations[-1] if observations else None
            value = latest.amount if latest else None
            gain = (
                value - position.acquisition_cost
                if value is not None and position.acquisition_cost is not None
                else None
            )
            result.append(
                {
                    "id": position.id,
                    "name": position.name,
                    "kind": "liability"
                    if position.kind == "LIABILITY"
                    else {
                        "REAL_ESTATE": "property",
                        "VEHICLE": "vehicle",
                        "COLLECTIBLE": "collectible",
                        "PRECIOUS_METALS": "precious_metal",
                    }.get(position.category, "other"),
                    "currency": position.currency,
                    "marketValue": value,
                    "unrealizedGain": gain,
                    "unrealizedGainPct": ratio(gain, position.acquisition_cost),
                    "valuationDate": latest.effective_date if latest else None,
                    "position": investments.wire(position),
                    "observations": investments.wire(observations),
                    "linkedAssetId": position.associated_asset_id,
                    "recordedStartingBalance": observations[0].amount if observations else None,
                    "recordedReduction": max(ZERO, observations[0].amount - value)
                    if observations and value is not None
                    else None,
                    "paidShare": ratio(
                        max(ZERO, observations[0].amount - value), observations[0].amount
                    )
                    if observations and value is not None
                    else None,
                }
            )
        for item in result:
            linked = [row for row in result if row["linkedAssetId"] == item["id"]]
            item["netEquity"] = (
                item["marketValue"] - sum((row["marketValue"] for row in linked), ZERO)
                if item["kind"] != "liability"
                and item["marketValue"] is not None
                and all(
                    row["currency"] == item["currency"] and row["marketValue"] is not None
                    for row in linked
                )
                else None
            )
    return investments.wire({"as_of": day, "rows": result})
