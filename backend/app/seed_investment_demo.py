"""Opt-in deterministic investment extension; never upgrades or resets an edited demo."""

import base64
from datetime import UTC, date, datetime
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy import event, select
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app import investment_imports, investments, ledger, schemas
from app.database import get_engine
from app.ingestion_schemas import Confirm
from app.investment_schemas import ActivityInput, AssetInput, PriceInput
from app.models import Asset, DemoFixture, FinancialAccount, PriceObservation, Record, Transfer
from app.seed_demo import VERSION
from app.seed_spending_demo import seed_spending_demo


def seed_investment_demo(session):
    if not seed_spending_demo(session):
        return False
    if session.scalar(select(Asset.id).limit(1)):
        raise ValueError("Investment demo requires an empty workspace")
    sequence = 0

    def stable(session, _context, _instances):
        nonlocal sequence
        for record in session.new:
            if isinstance(record, Record):
                sequence += 1
                record.id = record.id or uuid5(NAMESPACE_URL, f"finance-tracker/phase5/{sequence}")
                record.created_at = record.updated_at = datetime(2026, 9, 30, tzinfo=UTC)
                if isinstance(record, Transfer):
                    record.source_entry_id = uuid5(NAMESPACE_URL, f"phase5-transfer/{sequence}/out")
                    record.destination_entry_id = uuid5(
                        NAMESPACE_URL, f"phase5-transfer/{sequence}/in"
                    )
        for record in session.dirty:
            if isinstance(record, Record):
                record.updated_at = datetime(2026, 9, 30, tzinfo=UTC)
                flag_modified(record, "updated_at")

    event.listen(session, "before_flush", stable)
    try:
        accounts = {a.name: a for a in session.scalars(select(FinancialAccount))}
        first = accounts["Investment Account"]
        second = ledger.create_account(
            session,
            schemas.AccountCreate(
                name="Synthetic Brokerage B",
                type="INVESTMENT",
                currency="BRL",
                institution="Fictional Securities",
            ),
        )
        for source, destination, value, day in [
            (accounts["Checking"], second, "3000", 1),
            (second, accounts["Checking"], "100", 29),
        ]:
            ledger.create_transfer(
                session,
                schemas.TransferCreate(
                    source_account_id=source.id,
                    destination_account_id=destination.id,
                    amount=value,
                    currency="BRL",
                    transaction_date=date(2026, 9, day),
                    description="Synthetic investment cash transfer",
                ),
            )
        assets = {}
        for symbol, kind in [
            ("WRLD11", "ETF"),
            ("IVVB11", "ETF"),
            ("BOVA11", "ETF"),
            ("PETR4", "STOCK"),
            ("VALE3", "STOCK"),
        ]:
            row = Asset(
                **AssetInput(
                    symbol=symbol,
                    name=f"Synthetic illustration / {symbol}",
                    asset_type=kind,
                    exchange="XBSP",
                    currency="BRL",
                ).model_dump()
            )
            session.add(row)
            session.flush()
            assets[symbol] = row
        specs = [
            (first, "WRLD11", "BUY", "10", "100", None, "5", "0", 5),
            (first, "WRLD11", "BUY", "10", "120", None, "0", "0", 6),
            (first, "WRLD11", "SELL", "5", "140", None, "5", "2", 10),
            (second, "WRLD11", "BUY", "5", "110", None, "0", "0", 7),
            (first, "IVVB11", "BUY", "6", "300", None, "3", "0", 8),
            (first, "BOVA11", "BUY", "10", "100", None, "0", "0", 9),
            (first, "PETR4", "BUY", "5", "50", None, "0", "0", 10),
            (first, "PETR4", "SELL", "5", "40", None, "0", "0", 11),
            (first, "VALE3", "BUY", "3", "60", None, "0", "0", 12),
            (first, "WRLD11", "DIVIDEND", "0", "0", "80", "0", "8", 20),
            (second, None, "INTEREST", "0", "0", "12", "0", "0", 21),
            (first, None, "FEE", "0", "0", "5", "0", "0", 22),
            (first, None, "TAX", "0", "0", "10", "0", "0", 23),
        ]
        for i, (account, symbol, kind, quantity, price, gross, fees, taxes, day) in enumerate(
            specs
        ):
            investments.post(
                session,
                ActivityInput(
                    request_id=uuid5(NAMESPACE_URL, f"phase5-demo-activity/{i}"),
                    account_id=account.id,
                    asset_id=assets[symbol].id if symbol else None,
                    activity_type=kind,
                    activity_date=date(2026, 9, day),
                    quantity=quantity,
                    unit_price=price,
                    gross_amount=gross,
                    fees=fees,
                    taxes=taxes,
                    currency="BRL",
                    notes="Synthetic demo; not a real trade",
                ),
            )
        for symbol, price in [
            ("WRLD11", "145"),
            ("IVVB11", "320"),
            ("BOVA11", "95"),
            ("PETR4", "40"),
        ]:
            session.add(
                PriceObservation(
                    asset_id=assets[symbol].id,
                    **PriceInput(
                        price_date=date(2026, 9, 30), price=price, currency="BRL"
                    ).model_dump(),
                )
            )
        fixture = session.get(DemoFixture, VERSION)
        csv = (
            "date,type,symbol,exchange,quantity,unit_price,currency,external_id\n"
            "2026-09-24,BUY,BOVA11,XBSP,2,100,BRL,SYNTHETIC-DEMO-TRADE-1\n"
        )
        upload = investment_imports.Upload(
            filename="synthetic-demo-brokerage.csv",
            account_id=first.id,
            content_base64=base64.b64encode(csv.encode()).decode(),
            configuration=investment_imports.Mapping(
                source_namespace="synthetic-demo-brokerage",
                columns={
                    "date": 0,
                    "type": 1,
                    "symbol": 2,
                    "exchange": 3,
                    "quantity": 4,
                    "unit_price": 5,
                    "currency": 6,
                    "external_id": 7,
                },
            ),
        )
        for _ in range(2):
            batch = investment_imports.create_batch(session, upload)
            shown = investment_imports.preview(session, batch)
            investment_imports.confirm(
                session,
                batch,
                Confirm(preview_token=shown["preview_token"], account_confirmed=True),
            )
            batch.completed_at = datetime(2026, 9, 30, tzinfo=UTC)
        fixture.payload = {**fixture.payload, "investment_demo": "phase5-v1"}
        session.flush()
        return True
    finally:
        event.remove(session, "before_flush", stable)


if __name__ == "__main__":
    with Session(get_engine()) as session, session.begin():
        created = seed_investment_demo(session)
    print(
        "Synthetic investment demo created."
        if created
        else "Existing workspace preserved; no changes."
    )
