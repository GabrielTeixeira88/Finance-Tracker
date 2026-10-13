"""Offline-only valuation. Batch reads, exact arithmetic, no provider requests."""

from bisect import bisect_right
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal, localcontext

from fastapi import HTTPException
from sqlalchemy import select

from app.market_models import AssetPricing, FXObservation, MarketSettings
from app.market_providers import ProviderError, resolve
from app.models import Asset, FinancialAccount, InvestmentActivity, PriceObservation, Transaction

ZERO = Decimal(0)
CARRY_DAYS = 7


def preferences(session):
    row = session.scalar(select(MarketSettings))
    return {
        "automatic": row.automatic if row else False,
        "reporting_currency": row.reporting_currency if row else "BRL",
        "fx_provider": row.fx_provider if row else "ECB",
    }


class PriceBook:
    def __init__(self, session, end, settings=None):
        self.synthetic = (settings or preferences(session))["fx_provider"] == "SYNTHETIC"
        self.assets = {a.id: a for a in session.scalars(select(Asset))}
        self.config = {p.asset_id: p for p in session.scalars(select(AssetPricing))}
        self.series = defaultdict(list)
        for row in session.scalars(
            select(PriceObservation)
            .where(PriceObservation.price_date <= end)
            .order_by(PriceObservation.price_date, PriceObservation.price_type.desc())
        ):
            if row.price_type != "ADJUSTED":
                self.series[(row.asset_id, row.source, False)].append(row)
                if row.price_type == "RAW_CLOSE":
                    self.series[(row.asset_id, row.source, True)].append(row)
        self.dates = {key: [r.price_date for r in rows] for key, rows in self.series.items()}

    def select(self, asset_id, day, historical=False):
        config = self.config.get(asset_id)
        if (
            config
            and config.blocked_from
            and day >= config.blocked_from
            and (not config.blocked_to or day <= config.blocked_to)
        ):
            return None
        if config and config.mode == "MANUAL":
            sources = ["MANUAL"]
        else:
            try:
                provider, _ = resolve(
                    self.assets[asset_id],
                    config.provider if config else None,
                    config.symbol_override if config else None,
                )
                # A demo cache must never silently combine synthetic quotes with live FX,
                # or live quotes with synthetic FX. Manual observations remain explicit.
                sources = (
                    [provider, "MANUAL"]
                    if (provider == "SYNTHETIC") == self.synthetic
                    else ["MANUAL"]
                )
            except ProviderError:
                sources = ["MANUAL"]
        for source in sources:
            key = asset_id, source, historical
            offset = bisect_right(self.dates.get(key, []), day) - 1
            if offset >= 0:
                row = self.series[key][offset]
                if not historical or (day - row.price_date).days <= CARRY_DAYS:
                    return row
        return None


class FXBook:
    def __init__(self, session, end, provider="ECB"):
        self.provider = provider
        self.rates = defaultdict(dict)
        for row in session.scalars(
            select(FXObservation).where(
                FXObservation.rate_date <= end, FXObservation.provider == provider
            )
        ):
            self.rates[row.rate_date][row.quote_currency] = row.rate
        self.dates = sorted(self.rates)

    def convert(self, amount, source, target, day):
        if source == target:
            return amount, {"date": day.isoformat(), "rate": "1", "provider": "IDENTITY"}
        with localcontext() as ctx:
            ctx.prec = 60
            for candidate in reversed(self.dates[: bisect_right(self.dates, day)]):
                if (day - candidate).days > CARRY_DAYS:
                    break
                rates = {"EUR": Decimal(1), **self.rates[candidate]}
                if source in rates and target in rates:
                    rate = rates[target] / rates[source]
                    return amount * rate, {
                        "date": candidate.isoformat(),
                        "rate": format(rate, "f"),
                        "provider": self.provider,
                    }
        return None, None


def convert_totals(totals, fx, target, day):
    known = ZERO
    missing = []
    conversions = []
    with localcontext() as ctx:
        ctx.prec = 60
        for currency, value in totals.items():
            if value == ZERO:
                continue
            converted, info = fx.convert(value, currency, target, day)
            if converted is None:
                missing.append(currency)
            else:
                known += converted
                conversions.append({"from_currency": currency, **info})
    return known, missing, conversions


def history(
    session,
    start,
    end,
    account_id=None,
    reporting_currency=None,
    *,
    account_ids=None,
    serialize=True,
):
    from app.investments import wire

    if start > end or (end - start).days > 3660 or end > date.today():
        raise HTTPException(422, "Select an ordered historical range of at most ten years")
    settings = preferences(session)
    target = reporting_currency or settings["reporting_currency"]
    accounts = list(
        session.scalars(select(FinancialAccount).where(FinancialAccount.type == "INVESTMENT"))
    )
    if account_id:
        accounts = [a for a in accounts if a.id == account_id]
        if not accounts:
            raise HTTPException(404, "Investment account not found")
    if account_ids is not None:
        requested = set(account_ids)
        accounts = [a for a in accounts if a.id in requested]
        if {a.id for a in accounts} != requested:
            raise HTTPException(404, "Investment account not found")
    ids = {a.id for a in accounts}
    book = PriceBook(session, end, settings)
    fx = FXBook(session, end, settings["fx_provider"])
    events = []
    for t in session.scalars(
        select(Transaction).where(
            Transaction.account_id.in_(ids),
            Transaction.deleted_at.is_(None),
            Transaction.transaction_date <= end,
        )
    ):
        events.append(
            (
                t.transaction_date,
                0,
                t.account_id,
                None,
                ZERO,
                t.amount if t.direction == "IN" else -t.amount,
            )
        )
    for a in session.scalars(
        select(InvestmentActivity).where(
            InvestmentActivity.account_id.in_(ids),
            InvestmentActivity.voided_at.is_(None),
            InvestmentActivity.activity_date <= end,
        )
    ):
        quantity = (
            a.quantity
            if a.activity_type == "BUY"
            else -a.quantity
            if a.activity_type == "SELL"
            else ZERO
        )
        events.append(
            (
                a.activity_date,
                a.sequence,
                a.account_id,
                a.asset_id,
                quantity,
                a.cash_amount if a.direction == "IN" else -a.cash_amount,
            )
        )
    events.sort(key=lambda e: (e[0], e[1]))
    cash = defaultdict(lambda: ZERO)
    positions = defaultdict(lambda: ZERO)
    points = []
    offset = 0
    day = start
    with localcontext() as ctx:
        ctx.prec = 60
        while day <= end:
            while offset < len(events) and events[offset][0] <= day:
                _, _, aid, security, quantity, money = events[offset]
                cash[aid] += money
                if security:
                    positions[(aid, security)] += quantity
                offset += 1
            totals = defaultdict(lambda: ZERO)
            for account in accounts:
                totals[account.currency] += cash[account.id]
            missing = []
            carried = []
            for (_aid, security), quantity in positions.items():
                if not quantity:
                    continue
                asset = book.assets[security]
                p = book.select(security, day, historical=True)
                if p is None:
                    missing.append(str(security))
                else:
                    totals[asset.currency] += quantity * p.price
                    if p.price_date < day:
                        carried.append(str(security))
            known, missing_fx, conversions = convert_totals(totals, fx, target, day)
            points.append(
                {
                    "date": day,
                    "value": None if missing or missing_fx else known,
                    "known_value": known,
                    "missing_assets": sorted(set(missing)),
                    "missing_fx": missing_fx,
                    "carried_assets": sorted(set(carried)),
                    "fx": conversions,
                }
            )
            day += timedelta(days=1)
    result = {
        "start": start,
        "end": end,
        "currency": target,
        "fx_provider": fx.provider,
        "method": "HISTORICAL_LEDGER_VALUE",
        "carry_days": CARRY_DAYS,
        "points": points,
        "warning": "Portfolio value includes contributions and withdrawals; not investment "
        "performance. Corporate actions require ledger correction "
        "and explicit coverage review.",
    }
    return wire(result) if serialize else result


def reporting(session, portfolio, target=None):
    from app.investments import wire

    settings = preferences(session)
    target = target or settings["reporting_currency"]
    day = portfolio["as_of"]
    if isinstance(day, str):
        day = date.fromisoformat(day)
    fx = FXBook(session, day, settings["fx_provider"])
    totals = {}
    missing_prices = 0
    with localcontext() as ctx:
        ctx.prec = 60
        for total in portfolio["totals"]:
            totals[total["currency"]] = Decimal(total["cash"]) + Decimal(
                total["known_holdings_value"]
            )
            missing_prices += total["missing_prices"]
        known, missing_fx, conversions = convert_totals(totals, fx, target, day)
    return wire(
        {
            "currency": target,
            "known_value": known,
            "total_value": None if missing_prices or missing_fx else known,
            "missing_prices": missing_prices,
            "missing_fx": missing_fx,
            "fx": conversions,
        }
    )
