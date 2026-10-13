from datetime import date, timedelta
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import event
from sqlalchemy.orm import Session

from app import ledger, schemas
from app.investment_analytics import performance
from app.models import Asset, InvestmentActivity, PriceObservation


def test_three_year_twenty_asset_thousand_activity_history_uses_batched_reads(db_engine):
    start, end = date(2023, 1, 1), date(2026, 1, 1)
    with Session(db_engine) as session, session.begin():
        accounts = [
            ledger.create_account(
                session,
                schemas.AccountCreate(
                    name=f"Synthetic scale account {i}",
                    type="INVESTMENT",
                    currency="BRL",
                    opening_balance="10000",
                    opening_date=start,
                ),
            )
            for i in range(10)
        ]
        assets = [
            Asset(
                symbol=f"FAKE{i}",
                name=f"Synthetic scale security {i}",
                asset_type="ETF",
                exchange="SYNTHETIC",
                currency="BRL",
            )
            for i in range(20)
        ]
        session.add_all(assets)
        session.flush()
        for i in range(1200):
            session.add(
                InvestmentActivity(
                    request_id=uuid4(),
                    account_id=accounts[i % 10].id,
                    asset_id=assets[i % 20].id,
                    activity_type="BUY",
                    activity_date=start + timedelta(days=i % 1000),
                    sequence=i + 1,
                    quantity=Decimal(1),
                    unit_price=Decimal(1),
                    gross_amount=Decimal(1),
                    fees=Decimal(0),
                    taxes=Decimal(0),
                    cash_amount=Decimal(1),
                    direction="OUT",
                    currency="BRL",
                    notes="Synthetic scaling fixture",
                )
            )
        for offset in range(0, (end - start).days + 1, 7):
            for asset in assets:
                session.add(
                    PriceObservation(
                        asset_id=asset.id,
                        price_date=start + timedelta(days=offset),
                        price=Decimal(1),
                        currency="BRL",
                        source="MANUAL",
                        price_type="RAW_CLOSE",
                    )
                )
    statements = []

    def capture(_conn, _cursor, statement, _parameters, _context, _many):
        statements.append(statement)

    event.listen(db_engine, "before_cursor_execute", capture)
    try:
        with Session(db_engine) as session:
            result = performance(session, start, end, "BRL")
        assert Decimal(result["ending_value"]) == 100000
        assert Decimal(result["twr"]["value"]) == 0
        assert len(result["points"]) == 1097
        assert len(statements) < 20
    finally:
        event.remove(db_engine, "before_cursor_execute", capture)
