"""Versioned fictional income portfolio. Original ETF and official Brazil workspaces stay intact."""

from datetime import date, timedelta
from decimal import Decimal
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy import select

from app import investments, ledger, schemas
from app.database import Base
from app.demo import etf_showcase as base
from app.fixed_income_calendar import business_day
from app.investment_schemas import ActivityInput
from app.market_models import AssetPricing
from app.models import Asset, DemoFixture, FinancialAccount, PriceObservation

VERSION = "simulated-income-showcase-2"
SYMBOL = "SIM-DIVIDEND-ETF"
INSTRUMENT = (SYMBOL, "Fictional Dividend-Paying Equity ETF", "80", 3907)
QUANTITY = Decimal("75")
DIVIDENDS = (
    ("2025-03-31", "1.20"),
    ("2025-06-30", "1.30"),
    ("2025-09-30", "1.10"),
    ("2025-12-30", "1.40"),
    ("2026-03-31", "1.35"),
    ("2026-06-30", "1.45"),
    ("2026-09-30", "1.50"),
)


def identity(value):
    return uuid5(NAMESPACE_URL, f"finance-tracker/{VERSION}/{value}")


def scenario_root(root):
    return root.with_name(root.name + "-income-showcase-2")


def seed(session):
    if session.get(DemoFixture, VERSION):
        return False
    if any(
        session.execute(select(table).limit(1)).first() for table in Base.metadata.sorted_tables
    ):
        raise ValueError("Income showcase requires an empty owned database")
    base.seed(session)
    # This row is still in the initial, uncommitted empty-database seed transaction.
    # Financial postings and original price series are not rewritten.
    fixture = session.get(DemoFixture, base.VERSION)
    fixture.id = VERSION
    fixture.payload = {**fixture.payload, "income_showcase": True}
    checking = session.scalar(select(FinancialAccount).where(FinancialAccount.type == "CHECKING"))
    brokerage = session.scalar(
        select(FinancialAccount).where(FinancialAccount.type == "INVESTMENT")
    )
    populate(session, checking, brokerage)
    session.flush()
    return True


def populate(session, checking, brokerage):
    income_account = ledger.create_account(
        session,
        schemas.AccountCreate(
            name="Simulated Income Brokerage",
            type="INVESTMENT",
            currency="BRL",
            institution="Fictional income showcase",
            opening_balance="0",
            opening_date=base.START,
        ),
    )
    ledger.create_transfer(
        session,
        schemas.TransferCreate(
            source_account_id=checking.id,
            destination_account_id=income_account.id,
            amount="8000",
            currency="BRL",
            transaction_date=date(2025, 2, 3),
            description="Fictional internal funding of income portfolio",
        ),
    )
    asset = Asset(
        id=identity(SYMBOL),
        symbol=SYMBOL,
        name=INSTRUMENT[1],
        asset_type="ETF",
        exchange="SYNTHETIC",
        currency="BRL",
    )
    session.add(asset)
    session.flush()
    session.add(AssetPricing(asset_id=asset.id, mode="AUTOMATIC", provider="SYNTHETIC"))
    history = dict(base.prices(0, instrument=INSTRUMENT))
    for day, value in history.items():
        session.add(
            PriceObservation(
                asset_id=asset.id,
                currency="BRL",
                price_date=day,
                price=value,
                source="SYNTHETIC",
                price_type="RAW_CLOSE",
                fetched_at=base.STAMP,
            )
        )
    session.flush()
    investments.post(
        session,
        ActivityInput(
            request_id=identity("dividend-etf-purchase"),
            account_id=income_account.id,
            asset_id=asset.id,
            activity_type="BUY",
            activity_date=date(2025, 2, 4),
            quantity=QUANTITY,
            unit_price=history[date(2025, 2, 4)],
            currency="BRL",
            notes="Fictional execution at simulated raw close; no exchange quote.",
        ),
    )
    for day, per_unit in DIVIDENDS:
        investments.post(
            session,
            ActivityInput(
                request_id=identity("dividend/" + day),
                account_id=income_account.id,
                asset_id=asset.id,
                activity_type="DIVIDEND",
                activity_date=date.fromisoformat(day),
                gross_amount=QUANTITY * Decimal(per_unit),
                currency="BRL",
                notes="Fictional quarterly cash distribution; no tax-law or real ETF claim.",
            ),
        )
    for index in range(20):
        month = 2025 * 12 + 1 + index
        day = date(month // 12, month % 12 + 1, 20)
        while not business_day(day):
            day += timedelta(days=1)
        investments.post(
            session,
            ActivityInput(
                request_id=identity(f"cash-interest/{day}"),
                account_id=brokerage.id,
                activity_type="INTEREST",
                activity_date=day,
                gross_amount=Decimal("18") + Decimal(index) * Decimal("0.75"),
                currency="BRL",
                notes=(
                    "Fictional monthly brokerage cash-interest credit, "
                    "not CDB/RDB accrual or a quoted rate."
                ),
            ),
        )
    return income_account
