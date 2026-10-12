"""Opt-in v0.6 synthetic cache and multicurrency portfolio. Never edits a populated DB."""

from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy import event, select
from sqlalchemy.orm import Session

from app import investments, ledger, schemas
from app.database import get_engine
from app.investment_schemas import ActivityInput
from app.market_models import AssetPricing, FXObservation, MarketSettings
from app.models import Asset, DemoFixture, PriceObservation, Record
from app.seed_demo import VERSION
from app.seed_investment_demo import seed_investment_demo


def seed_market_demo(session):
    if not seed_investment_demo(session):
        return False
    anchor = datetime(2026, 9, 30, tzinfo=UTC)
    counter = 0

    def stable(session, _context, _instances):
        nonlocal counter
        for row in session.new:
            if isinstance(row, Record):
                counter += 1
                row.id = row.id or uuid5(NAMESPACE_URL, f"finance-tracker/v06/{counter}")
                row.created_at = row.updated_at = anchor

    event.listen(session, "before_flush", stable)
    try:
        for currency, symbols in [("USD", ["AAPL", "MSFT", "VOO"]), ("EUR", ["VWCE"])]:
            account = ledger.create_account(
                session,
                schemas.AccountCreate(
                    name=f"Synthetic {currency} brokerage",
                    type="INVESTMENT",
                    currency=currency,
                    institution="Fictional International Securities",
                    opening_balance="20000",
                    opening_date=date(2025, 10, 1),
                ),
            )
            for symbol in symbols:
                asset = Asset(
                    symbol=symbol,
                    name=f"Synthetic illustration / {symbol}",
                    asset_type="STOCK" if symbol in {"AAPL", "MSFT"} else "ETF",
                    exchange="NASDAQ"
                    if symbol in {"AAPL", "MSFT"}
                    else "NYSE ARCA"
                    if symbol == "VOO"
                    else "XETRA",
                    currency=currency,
                )
                session.add(asset)
                session.flush()
                for sequence, kind, day, quantity, price, gross in [
                    (1, "BUY", date(2025, 10, 2), "10", "100", None),
                    (2, "BUY", date(2026, 3, 10), "5", "110", None),
                    (3, "SELL", date(2026, 6, 15), "3", "120", None),
                    (4, "DIVIDEND", date(2026, 8, 20), "0", "0", "25"),
                ]:
                    investments.post(
                        session,
                        ActivityInput(
                            request_id=uuid5(NAMESPACE_URL, f"v06-demo/{symbol}/{sequence}"),
                            account_id=account.id,
                            asset_id=asset.id,
                            activity_type=kind,
                            activity_date=day,
                            quantity=quantity,
                            unit_price=price,
                            gross_amount=gross,
                            currency=currency,
                            notes="Synthetic demo; not a real trade",
                        ),
                    )
        assets = list(session.scalars(select(Asset).order_by(Asset.symbol)))
        start, end = date(2025, 9, 24), date(2026, 9, 30)
        for index, asset in enumerate(assets):
            mode = "MANUAL" if asset.symbol == "IVVB11" else "AUTOMATIC"
            session.add(AssetPricing(asset_id=asset.id, mode=mode, provider="SYNTHETIC"))
            if asset.symbol in {"VALE3", "IVVB11"}:
                continue  # Explicit missing position and an existing manual-only observation.
            day = start
            while day <= end:
                if day.weekday() < 5 and not (asset.symbol == "MSFT" and day > date(2026, 9, 15)):
                    elapsed = (day - start).days
                    price = Decimal(100 + index * 10) + Decimal(elapsed) * (
                        Decimal("-0.03") if asset.symbol == "BOVA11" else Decimal("0.07")
                    )
                    session.add(
                        PriceObservation(
                            asset_id=asset.id,
                            currency=asset.currency,
                            price_date=day,
                            price=price,
                            source="SYNTHETIC",
                            price_type="RAW_CLOSE",
                            fetched_at=anchor,
                        )
                    )
                day += timedelta(days=1)
        day = start
        while day <= end:
            if day.weekday() < 5:
                for currency, base, step in [
                    ("BRL", "5.4", "0.0005"),
                    ("USD", "1.08", "0.0001"),
                    ("JPY", "155", "0.005"),
                ]:
                    session.add(
                        FXObservation(
                            base_currency="EUR",
                            quote_currency=currency,
                            rate_date=day,
                            rate=Decimal(base) + Decimal((day - start).days) * Decimal(step),
                            provider="SYNTHETIC",
                            fetched_at=anchor,
                        )
                    )
            day += timedelta(days=1)
        session.add(
            MarketSettings(automatic=False, reporting_currency="BRL", fx_provider="SYNTHETIC")
        )
        fixture = session.get(DemoFixture, VERSION)
        fixture.payload = {**fixture.payload, "market_demo": "v06-synthetic-v1"}
        session.flush()
        return True
    finally:
        event.remove(session, "before_flush", stable)


if __name__ == "__main__":
    with Session(get_engine()) as session, session.begin():
        created = seed_market_demo(session)
    print(
        "Synthetic market demo created." if created else "Existing workspace preserved; no changes."
    )
