"""Single-acquisition contracts, gross accrual and explicit net redemptions.

All arithmetic is Decimal. Contractual accrual never posts cash. Each subscription
or redemption uses exactly one existing activity. No tax-lot inference is made.
"""

from datetime import date, timedelta
from decimal import Decimal, localcontext
from types import SimpleNamespace
from uuid import uuid5

from fastapi import HTTPException
from sqlalchemy import select

from app import investments, ledger
from app.fixed_income_calendar import business_day, days
from app.fixed_income_models import FixedIncomeContract, FixedIncomeIndex
from app.investment_schemas import ActivityInput, settled
from app.models import Asset, PriceObservation

ZERO, ONE = Decimal(0), Decimal(1)
IOF = (
    100,
    96,
    93,
    90,
    86,
    83,
    80,
    76,
    73,
    70,
    66,
    63,
    60,
    56,
    53,
    50,
    46,
    43,
    40,
    36,
    33,
    30,
    26,
    23,
    20,
    16,
    13,
    10,
    6,
    3,
)


def daily_factor(annual_percent):
    with localcontext() as ctx:
        ctx.prec = 60
        return (ONE + annual_percent / 100) ** (ONE / 252)


def tax_estimate(principal, gross, held_days):
    """Resident individual estimate: IOF on positive gain, then IR on gain less IOF.

    Calendar holding days, no daily tax deduction. Excludes custody/agent fees and
    special taxpayer regimes. Settlement rounds to six digits, not broker cent rules.
    """
    with localcontext() as ctx:
        ctx.prec = 60
        gain = max(ZERO, gross - principal)
        iof = settled(gain * Decimal(IOF[max(0, held_days)]) / 100) if held_days < 30 else ZERO
        rate = Decimal(
            "22.5"
            if held_days <= 180
            else "20"
            if held_days <= 360
            else "17.5"
            if held_days <= 720
            else "15"
        )
        income_tax = settled((gain - iof) * rate / 100)
        return dict(
            gross_interest=gross - principal,
            income_tax=income_tax,
            iof=iof,
            tax_rate=rate,
            estimated_net=gross - iof - income_tax,
        )


class AccrualBook:
    def __init__(self, session, end, synthetic, enabled=True):
        end = min(end, date.today())
        self.contracts = (
            {r.asset_id: r for r in session.scalars(select(FixedIncomeContract))} if enabled else {}
        )
        self.indices = (
            {
                (r.index_name, r.source, r.observation_date): r.factor
                for r in session.scalars(
                    select(FixedIncomeIndex).where(FixedIncomeIndex.observation_date <= end)
                )
            }
            if self.contracts
            else {}
        )
        self.synthetic = synthetic
        self.series = {}
        for asset, contract in self.contracts.items():
            if contract.instrument_type == "TESOURO_SELIC":
                continue
            values = {}
            day = contract.settlement_date
            price = contract.acquisition_price
            with localcontext() as ctx:
                ctx.prec = 60
                fixed = daily_factor(contract.annual_rate)
                while day <= min(end, contract.maturity_date):
                    values[day] = settled(price) if price is not None else None
                    if business_day(day) and day < contract.maturity_date and price is not None:
                        if contract.instrument_type == "CDB_FIXED":
                            price *= fixed
                        else:
                            factor = self.indices.get(("CDI", contract.index_source, day))
                            price = (
                                price * (ONE + (factor - ONE) * contract.cdi_percent / 100)
                                if factor is not None
                                else None
                            )
                    day += timedelta(days=1)
            self.series[asset] = values

    def price(self, asset, day):
        contract = self.contracts[asset]
        if day > date.today():
            return None
        if contract.index_source == "SYNTHETIC" and not self.synthetic:
            return None
        if day < contract.settlement_date:
            return None
        effective = min(day, contract.maturity_date)
        value = self.series.get(asset, {}).get(effective)
        if value is None:
            return None
        return SimpleNamespace(
            price=value,
            price_date=effective,
            source=contract.index_source,
            price_type="ACCRUAL",
            fetched_at=None,
        )


def subscribe(session, data, *, record_acquisition_quote=True):
    from app.market_models import AssetPricing

    aid = uuid5(data.request_id, "fixed-income-asset")
    fields = {
        k: v for k, v in data.model_dump().items() if k not in {"request_id", "name", "quantity"}
    }
    fields.update(
        asset_id=aid,
        currency="BRL",
        index_name={
            "CDB_CDI": "CDI",
            "RDB_CDI": "CDI",
            "CDB_FIXED": None,
            "TESOURO_SELIC": "SELIC_OVER",
        }[data.instrument_type],
    )
    existing = session.scalar(
        select(FixedIncomeContract).where(FixedIncomeContract.asset_id == aid)
    )
    activity = ActivityInput(
        request_id=data.request_id,
        account_id=data.account_id,
        asset_id=aid,
        activity_type="BUY",
        activity_date=data.settlement_date,
        quantity=data.quantity,
        unit_price=data.acquisition_price,
        currency="BRL",
        notes="Fixed-income subscription",
    )
    if existing:
        if (
            any(getattr(existing, k) != v for k, v in fields.items())
            or session.get(Asset, aid).name != data.name
        ):
            raise HTTPException(409, "Subscription identity already has different terms")
        investments.post(session, activity, fixed_income=True)
        return existing
    account = ledger.posting_account(session, data.account_id)
    if account.currency != "BRL" or account.type != "INVESTMENT":
        raise HTTPException(422, "Fixed income requires a BRL investment account")
    session.add(
        Asset(
            id=aid,
            name=data.name,
            symbol="FI-" + aid.hex[:12].upper(),
            exchange="CONTRACT",
            asset_type="BOND",
            currency="BRL",
        )
    )
    session.flush()
    contract = FixedIncomeContract(id=uuid5(data.request_id, "fixed-income-contract"), **fields)
    session.add(contract)
    session.add(
        AssetPricing(
            asset_id=aid,
            mode="AUTOMATIC" if data.index_source == "SYNTHETIC" else "MANUAL",
            provider="SYNTHETIC" if data.index_source == "SYNTHETIC" else None,
        )
    )
    session.flush()
    investments.post(session, activity, fixed_income=True)
    if data.instrument_type == "TESOURO_SELIC" and record_acquisition_quote:
        session.add(
            PriceObservation(
                asset_id=aid,
                currency="BRL",
                price_date=data.settlement_date,
                price=data.acquisition_price,
                source=data.index_source,
                price_type="RAW_CLOSE",
            )
        )
        session.flush()
    return contract


def position_rows(session, contract, as_of):
    return [
        a
        for a in investments.activities(session, contract.account_id, as_of)
        if a.asset_id == contract.asset_id
    ]


def redemption_data(session, contract, data):
    if (
        data.settlement_date > date.today()
        or data.settlement_date < contract.redemption_from
        or not business_day(data.settlement_date)
    ):
        raise HTTPException(
            422, "Redemption requires an available historical business-day settlement"
        )
    rows = position_rows(session, contract, data.settlement_date)
    existing = next((r for r in rows if r.request_id == data.request_id), None)
    if existing:
        # Replay exclusion makes retries derive the same basis without another posting.
        rows = [r for r in rows if r.sequence < existing.sequence]
    key = contract.account_id, contract.asset_id, "BRL"
    p = investments.reconstruct(rows).get(key)
    if not p or data.quantity > p["quantity"]:
        raise HTTPException(422, "Redemption exceeds available quantity")
    if contract.instrument_type == "TESOURO_SELIC":
        # Require the actual executed unit price. Cached mark is not an executable quote.
        if data.unit_price is None:
            raise HTTPException(
                422, "Enter the executed Tesouro sale price, including market effects"
            )
        price = data.unit_price
    else:
        from app.market_valuation import PriceBook

        quote = PriceBook(session, data.settlement_date).select(
            contract.asset_id, data.settlement_date
        )
        if not quote:
            raise HTTPException(422, "Required dated CDI observations are missing")
        price = quote.price
        if data.unit_price is not None and data.unit_price != price:
            raise HTTPException(422, "CDB redemption must use the contractual accrued price")
    with localcontext() as ctx:
        ctx.prec = 60
        principal = p["cost_basis"] * data.quantity / p["quantity"]
        gross = settled(data.quantity * price)
        taxes = tax_estimate(
            principal, gross, (data.settlement_date - contract.settlement_date).days
        )
    activity = ActivityInput(
        request_id=data.request_id,
        account_id=contract.account_id,
        asset_id=contract.asset_id,
        activity_type="SELL",
        activity_date=data.settlement_date,
        quantity=data.quantity,
        unit_price=price,
        fees=data.fees,
        taxes=taxes["iof"] + taxes["income_tax"],
        currency="BRL",
        notes="Fixed-income redemption / estimated resident-individual taxes",
    )
    return activity, {
        "principal": principal,
        "gross_value": gross,
        **taxes,
        "fees": data.fees,
        "cash_proceeds": activity.cash_amount,
    }


def redeem(session, contract, data, preview=False):
    activity, estimate = redemption_data(session, contract, data)
    if preview:
        transaction = session.begin_nested()
        try:
            investments.post(session, activity, fixed_income=True)
        finally:
            transaction.rollback()
    else:
        investments.post(session, activity, fixed_income=True)
    return investments.wire({**estimate, "request_id": data.request_id})


def overview(session, as_of, account_id=None):
    from app.market_valuation import PriceBook

    if as_of > date.today():
        raise HTTPException(422, "Select a historical valuation date")
    book = PriceBook(session, as_of)
    result = []
    with localcontext() as ctx:
        ctx.prec = 60
        for contract in book.fixed.contracts.values():
            if account_id and contract.account_id != account_id or as_of < contract.settlement_date:
                continue
            rows = position_rows(session, contract, as_of)
            p = investments.reconstruct(rows).get((contract.account_id, contract.asset_id, "BRL"))
            if not p:
                continue
            quote = book.select(contract.asset_id, as_of, historical=True)
            gross = (
                settled(p["quantity"] * quote.price)
                if quote
                else ZERO
                if p["quantity"] == 0
                else None
            )
            tax = (
                tax_estimate(p["cost_basis"], gross, (as_of - contract.settlement_date).days)
                if gross is not None
                else dict(
                    gross_interest=None,
                    income_tax=None,
                    iof=None,
                    tax_rate=None,
                    estimated_net=None,
                )
            )
            sold = any(r.activity_type == "SELL" for r in rows)
            result.append(
                {
                    "contract": contract,
                    "name": book.assets[contract.asset_id].name,
                    "quantity": p["quantity"],
                    "principal": p["cost_basis"],
                    "gross_value": gross,
                    **tax,
                    "realized_net": p["realized"],
                    "price_date": quote.price_date if quote else None,
                    "valuation_source": quote.source if quote else None,
                    "status": "REDEEMED"
                    if not p["quantity"]
                    else "MATURED"
                    if as_of >= contract.maturity_date
                    else "PARTIALLY_REDEEMED"
                    if sold
                    else "ACTIVE",
                    "redemption_available": bool(
                        p["quantity"] and as_of >= contract.redemption_from and business_day(as_of)
                    ),
                    "quality": "COMPLETE" if gross is not None else "UNAVAILABLE",
                }
            )
    return investments.wire(
        {
            "as_of": as_of,
            "currency": "BRL",
            "positions": result,
            "tax_policy": "BR_RESIDENT_ESTIMATE",
            "calendar": "BR_NATIONAL_V1",
        }
    )


def contract_history(session, contract, start, end):
    from app.market_valuation import PriceBook

    if start > end or (end - start).days > 3660 or end > date.today():
        raise HTTPException(422, "Select an ordered historical range of at most ten years")
    book = PriceBook(session, end)
    rows = position_rows(session, contract, end)
    points, day, benchmark = [], max(start, contract.settlement_date), ONE
    with localcontext() as ctx:
        ctx.prec = 60
        # Reference CDI uses the same acquisition boundary, never today's annual rate.
        for d in days(contract.settlement_date, day):
            factor = book.fixed.indices.get(("CDI", contract.index_source, d))
            benchmark = benchmark * factor if benchmark is not None and factor else None
        while day <= end:
            p = investments.reconstruct([r for r in rows if r.activity_date <= day]).get(
                (contract.account_id, contract.asset_id, "BRL")
            )
            q = book.select(contract.asset_id, day, historical=True)
            value = (
                settled(p["quantity"] * q.price)
                if p and q
                else ZERO
                if p and not p["quantity"]
                else None
            )
            principal = p["cost_basis"] if p else ZERO
            points.append(
                {
                    "date": day,
                    "principal": principal,
                    "value": value,
                    "gross_interest": value - principal if value is not None else None,
                    "cdi_return_percent": (benchmark - ONE) * 100
                    if benchmark is not None
                    else None,
                    "contract_return_percent": (q.price / contract.acquisition_price - ONE) * 100
                    if q
                    else None,
                }
            )
            if business_day(day):
                factor = book.fixed.indices.get(("CDI", contract.index_source, day))
                benchmark = benchmark * factor if benchmark is not None and factor else None
            day += timedelta(days=1)
    return investments.wire(
        {
            "currency": "BRL",
            "source": contract.index_source,
            "fictional": contract.fictional,
            "points": points,
        }
    )
