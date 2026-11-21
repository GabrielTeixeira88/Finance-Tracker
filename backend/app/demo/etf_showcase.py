"""Deterministic fictional ETF observations, isolated from official data and personal portfolios."""

from datetime import UTC, date, datetime, timedelta
from decimal import Decimal, localcontext
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy import select

from app import investments, ledger, schemas
from app.database import Base
from app.demo.real_market_snapshot import END, START
from app.investment_schemas import ActivityInput, settled
from app.market_models import AssetPricing, MarketSettings
from app.models import Asset, DemoFixture, PriceObservation

VERSION = "simulated-etf-showcase-1"
STAMP = datetime(2026, 9, 30, tzinfo=UTC)
INSTRUMENTS = (
    ("SIM-GLOBAL-ETF", "Fictional Global Equity ETF", "100", 811),
    ("SIM-SP500-ETF", "Fictional S&P 500-style ETF", "240", 2027),
)
TRADES = (
    ("2024-11-05", 0, "BUY", "100"),
    ("2025-02-05", 1, "BUY", "45"),
    ("2025-07-07", 0, "BUY", "80"),
    ("2025-11-05", 1, "BUY", "35"),
    ("2026-04-06", 0, "BUY", "90"),
    ("2026-06-05", 0, "SELL", "40"),
    ("2026-08-05", 1, "BUY", "30"),
)


def identity(value):
    return uuid5(NAMESPACE_URL, f"finance-tracker/{VERSION}/{value}")


def prices(index, *, instrument=None):
    """Integer PRNG + explicit fictional regimes, Decimal prices; no fetched market inputs."""
    _, _, initial, state = instrument or INSTRUMENTS[index]
    price = Decimal(initial)
    day = START
    with localcontext() as context:
        context.prec = 60
        while day <= END:
            if day.weekday() < 5:
                state = (1664525 * state + 1013904223) % (2**32)
                noise = state % 161 - 80
                if date(2025, 2, 1) <= day <= date(2025, 4, 30):
                    drift = -17 - index * 3
                elif date(2026, 2, 1) <= day <= date(2026, 3, 31):
                    drift = -22 + index * 2
                else:
                    drift = 12 + index * 2
                price = settled(price * (Decimal(10000 + drift + noise) / 10000))
                yield day, price
            day += timedelta(days=1)


def scenario_root(root):
    return root.with_name(root.name + "-etf-showcase-" + VERSION.rsplit("-", 1)[-1])


def seed(session):
    if session.get(DemoFixture, VERSION):
        return False
    if any(
        session.execute(select(table).limit(1)).first() for table in Base.metadata.sorted_tables
    ):
        raise ValueError("ETF showcase requires an empty owned database")
    session.add(MarketSettings(automatic=False, reporting_currency="BRL", fx_provider="SYNTHETIC"))
    checking = ledger.create_account(
        session,
        schemas.AccountCreate(
            name="Showcase Checking",
            type="CHECKING",
            currency="BRL",
            institution="Fictional portfolio showcase",
            opening_balance="100000",
            opening_date=START,
        ),
    )
    populate(session, checking)
    session.add(
        DemoFixture(
            id=VERSION,
            start_date=START,
            end_date=END,
            payload={
                "currency": "BRL",
                "budgets": [],
                "holdings": [],
                "performance": [],
                "activity": [],
                "simulated": True,
            },
        )
    )
    session.flush()
    return True


def populate(session, checking):
    brokerage = ledger.create_account(
        session,
        schemas.AccountCreate(
            name="Simulated ETF Brokerage",
            type="INVESTMENT",
            currency="BRL",
            institution="Fictional portfolio showcase",
            opening_balance="0",
            opening_date=START,
        ),
    )
    ledger.create_transfer(
        session,
        schemas.TransferCreate(
            source_account_id=checking.id,
            destination_account_id=brokerage.id,
            amount="75000",
            currency="BRL",
            transaction_date=date(2024, 10, 2),
            description="Fictional portfolio funding; internal transfer, not income or spending",
        ),
    )
    assets, history = [], []
    for index, (symbol, name, _initial, _seed) in enumerate(INSTRUMENTS):
        asset = Asset(
            id=identity(symbol),
            symbol=symbol,
            name=name,
            asset_type="ETF",
            exchange="SYNTHETIC",
            currency="BRL",
        )
        session.add(asset)
        session.flush()
        session.add(AssetPricing(asset_id=asset.id, mode="AUTOMATIC", provider="SYNTHETIC"))
        observations = dict(prices(index))
        for day, price in observations.items():
            session.add(
                PriceObservation(
                    asset_id=asset.id,
                    currency="BRL",
                    price_date=day,
                    price=price,
                    source="SYNTHETIC",
                    price_type="RAW_CLOSE",
                    fetched_at=STAMP,
                )
            )
        assets.append(asset)
        history.append(observations)
    session.flush()
    for day, index, kind, quantity in TRADES:
        activity_day = date.fromisoformat(day)
        investments.post(
            session,
            ActivityInput(
                request_id=identity(f"{day}/{index}/{kind}"),
                account_id=brokerage.id,
                asset_id=assets[index].id,
                activity_type=kind,
                activity_date=activity_day,
                quantity=quantity,
                unit_price=history[index][activity_day],
                currency="BRL",
                notes=(
                    "Fictional execution at deterministic simulated close. "
                    "Not a real exchange quote."
                ),
            ),
        )
    return brokerage
