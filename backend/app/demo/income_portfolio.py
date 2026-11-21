"""Rich, wholly fictional income portfolio; existing owned scenarios are untouched."""

from datetime import date, timedelta
from decimal import Decimal
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy import select

from app import investments, ledger, schemas
from app.database import Base
from app.demo import etf_showcase, income_showcase
from app.fixed_income_calendar import business_day
from app.investment_schemas import ActivityInput
from app.market_models import AssetPricing
from app.models import Asset, DemoFixture, FinancialAccount, PriceObservation

VERSION = "simulated-income-portfolio-1"
# Symbol, name, type, first fictional price, quantity, payment frequency, unit payout.
INSTRUMENTS = (
    ("SIM-REIT", "Brazil Property Income", "FII", "100", "15", "MONTHLY", "0.85"),
    ("SIM-LOG", "Logistics Income Fund", "FII", "90", "15", "MONTHLY", "0.75"),
    ("SIM-CREDIT", "Real Estate Credit Fund", "FII", "75", "15", "MONTHLY", "0.65"),
    ("SIM-INFRA", "Infrastructure Income Fund", "FUND", "50", "15", "MONTHLY", "0.40"),
    ("SIM-UTIL", "Utilities Dividend Portfolio", "ETF", "40", "20", "QUARTERLY", "1.10"),
    ("SIM-BANK", "Financial Sector Income", "ETF", "30", "20", "QUARTERLY", "0.90"),
    ("SIM-VALUE", "Brazil Value Income", "ETF", "85", "10", "QUARTERLY", "2.20"),
    ("SIM-QUALITY", "Brazil Quality Dividends", "ETF", "70", "10", "QUARTERLY", "1.70"),
)


def identity(value):
    return uuid5(NAMESPACE_URL, f"finance-tracker/{VERSION}/{value}")


def scenario_root(root):
    return root.with_name(root.name + "-income-portfolio-1")


def payments(frequency):
    if frequency == "QUARTERLY":
        return [date.fromisoformat(day) for day, _ in income_showcase.DIVIDENDS]
    dates = []
    for index in range(20):
        month = 2025 * 12 + 1 + index
        day = date(month // 12, month % 12 + 1, 18)
        while not business_day(day):
            day += timedelta(days=1)
        dates.append(day)
    return dates


def seed(session):
    if session.get(DemoFixture, VERSION):
        return False
    if any(
        session.execute(select(table).limit(1)).first() for table in Base.metadata.sorted_tables
    ):
        raise ValueError("Income portfolio requires an empty owned database")
    income_showcase.seed(session)
    # This is the first uncommitted seed transaction, never an existing saved workspace.
    fixture = session.get(DemoFixture, income_showcase.VERSION)
    fixture.id = VERSION
    fixture.payload = {**fixture.payload, "rich_income_portfolio": True}
    checking = session.scalar(select(FinancialAccount).where(FinancialAccount.type == "CHECKING"))
    brokerage = session.scalar(
        select(FinancialAccount).where(FinancialAccount.name == "Simulated Income Brokerage")
    )
    populate(session, checking, brokerage)
    session.flush()
    return True


def populate(session, checking, brokerage):
    original_income_asset = session.scalar(
        select(Asset).where(Asset.symbol == income_showcase.SYMBOL)
    )
    original_income_asset.name = "Brazil Dividend Income ETF"
    original_income_asset.symbol = "SIM-DIV"
    ledger.create_transfer(
        session,
        schemas.TransferCreate(
            source_account_id=checking.id,
            destination_account_id=brokerage.id,
            amount="10000",
            currency="BRL",
            transaction_date=date(2025, 2, 4),
            description="Internal funding of fictional dividend portfolio",
        ),
    )
    purchase = date(2025, 2, 5)
    for index, (symbol, name, kind, initial, quantity, frequency, payout) in enumerate(INSTRUMENTS):
        asset = Asset(
            id=identity(symbol),
            symbol=symbol,
            name=name,
            asset_type=kind,
            exchange="SYNTHETIC",
            currency="BRL",
        )
        session.add(asset)
        session.flush()
        session.add(AssetPricing(asset_id=asset.id, mode="AUTOMATIC", provider="SYNTHETIC"))
        quotes = dict(
            etf_showcase.prices(index % 2, instrument=(symbol, name, initial, 4109 + index * 701))
        )
        for day, price in quotes.items():
            session.add(
                PriceObservation(
                    asset_id=asset.id,
                    currency="BRL",
                    price_date=day,
                    price=price,
                    source="SYNTHETIC",
                    price_type="RAW_CLOSE",
                    fetched_at=etf_showcase.STAMP,
                )
            )
        session.flush()
        investments.post(
            session,
            ActivityInput(
                request_id=identity(symbol + "/purchase"),
                account_id=brokerage.id,
                asset_id=asset.id,
                activity_type="BUY",
                activity_date=purchase,
                quantity=quantity,
                unit_price=quotes[purchase],
                currency="BRL",
                notes=(
                    "Wholly fictional holding and execution at simulated close; "
                    "not an exchange quote."
                ),
            ),
        )
        for payment_index, day in enumerate(payments(frequency)):
            # Explicit fictional distribution variability, not inferred historical dividends.
            multiplier = (Decimal("0.90"), Decimal("1.00"), Decimal("1.05"), Decimal("1.10"))[
                (payment_index + index) % 4
            ]
            investments.post(
                session,
                ActivityInput(
                    request_id=identity(f"{symbol}/dividend/{day}"),
                    account_id=brokerage.id,
                    asset_id=asset.id,
                    activity_type="DIVIDEND",
                    activity_date=day,
                    gross_amount=Decimal(quantity) * Decimal(payout) * multiplier,
                    currency="BRL",
                    notes=(
                        "Fictional cash distribution. "
                        "No real security, tax treatment or yield claim."
                    ),
                ),
            )
    session.flush()
