"""Opt-in v0.7 synthetic analytics examples. Only seeds an empty database."""

from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy import event, select
from sqlalchemy.orm import Session

from app import investments, ledger, schemas
from app.analytics_models import AssetClassification
from app.database import get_engine
from app.investment_schemas import ActivityInput
from app.market_models import AssetPricing
from app.models import Asset, DemoFixture, FinancialAccount, PriceObservation, Record, Transfer
from app.seed_demo import VERSION
from app.seed_market_demo import seed_market_demo


def seed_analytics_demo(session):
    if not seed_market_demo(session):
        return False
    anchor = datetime(2026, 9, 30, tzinfo=UTC)
    counter = 0

    def stable(session, _context, _instances):
        nonlocal counter
        for row in session.new:
            if isinstance(row, Record):
                counter += 1
                row.id = row.id or uuid5(NAMESPACE_URL, f"finance-tracker/v07/{counter}")
                row.created_at = row.updated_at = anchor
                if isinstance(row, Transfer):
                    row.source_entry_id = uuid5(NAMESPACE_URL, f"v07/transfer/{counter}/out")
                    row.destination_entry_id = uuid5(NAMESPACE_URL, f"v07/transfer/{counter}/in")

    event.listen(session, "before_flush", stable)
    try:
        accounts = []
        for name in ("Synthetic Analytics Portfolio", "Synthetic Companion Brokerage"):
            accounts.append(
                ledger.create_account(
                    session,
                    schemas.AccountCreate(
                        name=name,
                        type="INVESTMENT",
                        currency="BRL",
                        institution="Fictional Analytics Securities",
                        opening_balance="20000",
                        opening_date=date(2025, 10, 1),
                    ),
                )
            )
        securities = []
        for symbol, name in [
            ("DEMOUP", "Fictional growth security"),
            ("DEMOLOSS", "Fictional closed loss"),
            ("DEMOBENCH", "Fictional benchmark price proxy"),
        ]:
            row = Asset(
                symbol=symbol, name=name, asset_type="ETF", exchange="SYNTHETIC", currency="BRL"
            )
            session.add(row)
            session.flush()
            securities.append(row)
            session.add(AssetPricing(asset_id=row.id, mode="AUTOMATIC", provider="SYNTHETIC"))
            if symbol != "DEMOLOSS":
                session.add(
                    AssetClassification(
                        asset_id=row.id,
                        sector="Synthetic diversified basket",
                        geography="Fictional demo region",
                    )
                )
            day = date(2025, 9, 24)
            while day <= date(2026, 9, 30):
                if day.weekday() < 5:
                    elapsed = (day - date(2025, 9, 24)).days
                    drift = Decimal(elapsed) * (
                        Decimal("-0.015")
                        if symbol == "DEMOLOSS"
                        else Decimal("0.025")
                        if symbol == "DEMOBENCH"
                        else Decimal("0.04")
                    )
                    wave = Decimal((elapsed % 31) - 15) / 10
                    session.add(
                        PriceObservation(
                            asset_id=row.id,
                            currency="BRL",
                            price_date=day,
                            price=Decimal(100) + drift + wave,
                            source="SYNTHETIC",
                            price_type="RAW_CLOSE",
                            fetched_at=anchor,
                        )
                    )
                day += timedelta(days=1)
        for sequence, (kind, day, security, quantity, unit_price, gross, fees, taxes) in enumerate(
            [
                ("BUY", "2025-10-02", 0, "20", "100", None, "2", "0"),
                ("BUY", "2025-10-02", 1, "10", "100", None, "1", "0"),
                ("DIVIDEND", "2026-01-15", 0, "0", "0", "100", "2", "10"),
                ("SELL", "2026-03-12", 1, "10", "90", None, "1", "0"),
                ("SELL", "2026-04-15", 0, "5", "110", None, "1", "2"),
                ("INTEREST", "2026-05-15", None, "0", "0", "30", "0", "3"),
                ("FEE", "2026-06-15", None, "0", "0", "5", "0", "0"),
                ("TAX", "2026-07-15", None, "0", "0", "2", "0", "0"),
                ("DIVIDEND", "2026-08-15", 0, "0", "0", "80", "1", "8"),
            ]
        ):
            investments.post(
                session,
                ActivityInput(
                    request_id=uuid5(NAMESPACE_URL, f"v07/activity/{sequence}"),
                    account_id=accounts[0].id,
                    asset_id=securities[security].id if security is not None else None,
                    activity_type=kind,
                    activity_date=date.fromisoformat(day),
                    quantity=quantity,
                    unit_price=unit_price,
                    gross_amount=gross,
                    fees=fees,
                    taxes=taxes,
                    currency="BRL",
                    notes="Entirely synthetic analytics demonstration",
                ),
            )
        checking = session.scalar(
            select(FinancialAccount)
            .where(FinancialAccount.type == "CHECKING")
            .order_by(FinancialAccount.name)
        )
        for source, destination, amount, day in [
            (checking, accounts[0], "2000", "2025-12-01"),
            (accounts[0], checking, "500", "2026-02-01"),
            (accounts[0], accounts[1], "750", "2026-03-01"),
        ]:
            ledger.create_transfer(
                session,
                schemas.TransferCreate(
                    source_account_id=source.id,
                    destination_account_id=destination.id,
                    amount=amount,
                    currency="BRL",
                    transaction_date=date.fromisoformat(day),
                    description="Synthetic analytics contribution / withdrawal",
                ),
            )
        fixture = session.get(DemoFixture, VERSION)
        fixture.payload = {**fixture.payload, "analytics_demo": "v07-synthetic-v1"}
        session.flush()
        return True
    finally:
        event.remove(session, "before_flush", stable)


if __name__ == "__main__":
    with Session(get_engine()) as session, session.begin():
        created = seed_analytics_demo(session)
    print(
        "Synthetic analytics demo created."
        if created
        else "Existing workspace preserved; no changes."
    )
