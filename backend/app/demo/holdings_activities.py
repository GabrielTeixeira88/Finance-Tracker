"""Additive, versioned coverage for supported Holdings/Activities demo workflows.

Only called for a validated owned unified-demo generation, never a normal database.
Debt values are fictional recorded observations, not calculated loan schedules.
"""

from datetime import date, timedelta
from decimal import Decimal
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy import select

from app import investments, wealth
from app.demo import etf_showcase
from app.investment_schemas import ActivityInput
from app.market_models import AssetPricing
from app.models import Asset, DemoFixture, FinancialAccount, InvestmentActivity, PriceObservation
from app.wealth_models import ManualPosition
from app.wealth_routes import ObservationInput

CONTENT_VERSION = 1
MARKER = "holdings_activities_content"


def identity(value):
    return uuid5(NAMESPACE_URL, "finance-tracker/unified-holdings-1/" + value)


def extend(session):
    from app.demo.unified import VERSION

    fixture = session.get(DemoFixture, VERSION)
    if fixture is None:
        raise ValueError("Holdings coverage requires an owned unified demo")
    if fixture.payload.get(MARKER) == CONTENT_VERSION:
        return False
    source_account = session.scalar(
        select(InvestmentActivity.account_id)
        .where(
            InvestmentActivity.asset_id == etf_showcase.identity("SIM-GLOBAL-ETF"),
            InvestmentActivity.activity_type == "BUY",
        )
        .order_by(InvestmentActivity.sequence)
        .limit(1)
    )
    brokerage = session.get(FinancialAccount, source_account) if source_account else None
    if brokerage is None:
        raise ValueError("Unified demo brokerage identity is unavailable")
    assets = list(session.scalars(select(ManualPosition).where(ManualPosition.kind == "ASSET")))
    house = next((p for p in assets if p.category == "REAL_ESTATE"), None)
    car = next((p for p in assets if p.category == "VEHICLE"), None)
    dates = (date(2024, 10, 1), date(2025, 1, 1), date(2026, 1, 1), date(2026, 9, 30))
    for name, category, linked, values, rate, payoff in (
        (
            "Home mortgage",
            "MORTGAGE",
            house,
            ("180000", "177000", "165000", "154000"),
            "8.5",
            date(2040, 10, 1),
        ),
        (
            "Vehicle loan",
            "VEHICLE_LOAN",
            car,
            ("25000", "23500", "17000", "10000"),
            "14",
            date(2028, 10, 1),
        ),
    ):
        row = ManualPosition(
            id=identity(name),
            name=name,
            kind="LIABILITY",
            category=category,
            currency="BRL",
            liquidity="ILLIQUID",
            start_date=dates[0],
            associated_asset_id=linked.id if linked else None,
            interest_rate=Decimal(rate),
            expected_payoff_date=payoff,
            terms=(
                "Illustrative fictional terms. Dated balances are recorded, "
                "not an amortization model."
            ),
            notes=(
                "Fictional debt already outstanding before replay; "
                "no new cash posting or inferred payment."
            ),
        )
        wealth.check_position(session, row)
        session.add(row)
        session.flush()
        for day, value in zip(dates, values, strict=True):
            wealth.add_observation(
                session,
                row,
                ObservationInput(
                    effective_date=day,
                    amount=value,
                    notes="Fictional recorded debt balance; no inferred principal/interest split.",
                ),
            )
    camera = ManualPosition(
        id=identity("camera"),
        name="Camera equipment",
        kind="ASSET",
        category="OTHER",
        currency="BRL",
        liquidity="ILLIQUID",
        start_date=dates[0],
        acquisition_cost=Decimal("8000"),
        notes="Fictional equipment owned before replay, valued manually; not an exchange quote.",
    )
    wealth.check_position(session, camera)
    session.add(camera)
    session.flush()
    for day, value in zip(dates, ("8000", "7600", "6500", "5900"), strict=True):
        wealth.add_observation(
            session,
            camera,
            ObservationInput(
                effective_date=day,
                amount=value,
                notes="Fictional manual valuation; no ledger movement.",
            ),
        )

    # Two complete round trips expose closed gains/losses without fabricating tax lots.
    # Small trades use existing funded brokerage cash; no new personal-income posting.
    for symbol, name, buy, sell in (
        ("SIM-CLOSED-GAIN", "Fictional completed growth holding", "50", "62"),
        ("SIM-CLOSED-LOSS", "Fictional completed value holding", "80", "65"),
    ):
        asset = Asset(
            id=identity(symbol),
            symbol=symbol,
            name=name,
            asset_type="ETF",
            currency="BRL",
            exchange="SYNTHETIC",
        )
        session.add(asset)
        session.flush()
        session.add(AssetPricing(asset_id=asset.id, mode="AUTOMATIC", provider="SYNTHETIC"))
        first, last = date(2025, 6, 3), date(2026, 7, 7)
        day, state = first, 8191 if symbol.endswith("GAIN") else 7123
        while day <= last:
            if day.weekday() < 5:
                state = (1664525 * state + 1013904223) % (2**32)
                progress = Decimal((day - first).days) / Decimal((last - first).days)
                trend = Decimal(buy) + (Decimal(sell) - Decimal(buy)) * progress
                noise = Decimal(state % 401 - 200) / Decimal(10000)
                price = trend if day in (first, last) else trend * (1 + noise)
                session.add(
                    PriceObservation(
                        asset_id=asset.id,
                        price_date=day,
                        price=price.quantize(Decimal("0.000001")),
                        currency="BRL",
                        source="SYNTHETIC",
                        price_type="RAW_CLOSE",
                        fetched_at=etf_showcase.STAMP,
                    )
                )
            day += timedelta(days=1)
        session.flush()
        for kind, day, price in (("BUY", date(2025, 6, 3), buy), ("SELL", date(2026, 7, 7), sell)):
            investments.post(
                session,
                ActivityInput(
                    request_id=identity(symbol + "/" + kind),
                    account_id=brokerage.id,
                    asset_id=asset.id,
                    activity_type=kind,
                    activity_date=day,
                    quantity="10",
                    unit_price=price,
                    fees="2",
                    taxes="0",
                    currency="BRL",
                    notes=(
                        "Fictional closed-position example; prices are simulated, "
                        "not real market observations."
                    ),
                ),
            )
    fixture.payload = {**fixture.payload, MARKER: CONTENT_VERSION}
    session.flush()
    return True
