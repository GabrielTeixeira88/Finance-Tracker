"""Fictional v0.10 wealth example; opt in only on an empty database."""

from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy import event, select
from sqlalchemy.orm import Session

from app import wealth
from app.database import get_engine
from app.models import DemoFixture, FinancialAccount, Record
from app.seed_analytics_demo import seed_analytics_demo
from app.seed_demo import VERSION
from app.wealth_models import Goal, GoalEntry, ManualPosition, PositionObservation


def seed_wealth_demo(session):
    session.connection(execution_options={"sqlite_write": True})
    if session.get(DemoFixture, VERSION):
        return False
    if session.scalar(select(ManualPosition).limit(1)) or session.scalar(select(Goal).limit(1)):
        raise ValueError("Wealth demo requires an empty database; existing data preserved")
    if not seed_analytics_demo(session):
        return False
    sequence = 0

    def stable(session, _context, _instances):
        nonlocal sequence
        for row in session.new:
            if isinstance(row, Record):
                sequence += 1
                row.id = row.id or uuid5(NAMESPACE_URL, f"finance-tracker/v010/{sequence}")
                row.created_at = row.updated_at = datetime(2026, 9, 30, tzinfo=UTC)

    event.listen(session, "before_flush", stable)
    try:
        property_asset = None
        for name, kind, category, initial, monthly in [
            ("Fictional Riverside Home", "ASSET", "REAL_ESTATE", "500000", "1500"),
            ("Fictional Riverside Mortgage", "LIABILITY", "MORTGAGE", "300000", "-1200"),
            ("Fictional Compact Car", "ASSET", "VEHICLE", "45000", "-400"),
            ("Fictional Education Loan", "LIABILITY", "STUDENT_LOAN", "12000", "-300"),
        ]:
            row = ManualPosition(
                name=name,
                kind=kind,
                category=category,
                currency="BRL",
                start_date=date(2025, 4, 1),
                liquidity="ILLIQUID",
                notes="Synthetic demonstration only",
                terms="Manual principal observations; no payment postings are inferred.",
                associated_asset_id=property_asset.id if category == "MORTGAGE" else None,
            )
            session.add(row)
            session.flush()
            if category == "REAL_ESTATE":
                property_asset = row
            for n in range(18):
                year, month = divmod(2025 * 12 + 3 + n, 12)
                session.add(
                    PositionObservation(
                        position_id=row.id,
                        effective_date=date(year, month + 1, 1),
                        amount=Decimal(initial) + Decimal(monthly) * n,
                        notes="Fictional monthly estimate",
                    )
                )
            session.flush()
        savings = session.scalar(select(FinancialAccount).where(FinancialAccount.name == "Savings"))
        for name, mode, target, amount in [
            ("Synthetic emergency fund", "ACCOUNT", "25000", "12000"),
            ("Synthetic travel savings", "ACCOUNT", "10000", "5000"),
            ("Synthetic vehicle purchase", "MANUAL", "40000", "6000"),
        ]:
            goal = Goal(
                name=name,
                mode=mode,
                target=Decimal(target),
                currency="BRL",
                start_date=date(2025, 4, 1),
                deadline=date(2027, 12, 31),
                status="ACTIVE",
                notes="Fictional goal; allocations never increase net worth",
            )
            session.add(goal)
            session.flush()
            for n in range(6):
                session.add(
                    GoalEntry(
                        goal_id=goal.id,
                        account_id=savings.id if mode == "ACCOUNT" else None,
                        amount=(Decimal(amount) * (n + 1) / 6).quantize(Decimal("0.000001"))
                        if mode == "ACCOUNT"
                        else Decimal(amount) / 6,
                        effective_date=date(2026, n + 4, 1),
                        direction="IN",
                        notes="Synthetic progress",
                    )
                )
            session.flush()
            wealth.validate_progress(session, goal)
        fixture = session.get(DemoFixture, VERSION)
        complete_synthetic_coverage(session, fixture.start_date, fixture.end_date)
        fixture.payload = {**fixture.payload, "wealth_demo": "v010-synthetic-v1"}
        session.flush()
        return True
    finally:
        event.remove(session, "before_flush", stable)


def complete_synthetic_coverage(session, start, end):
    """This new empty-workspace fixture intentionally has a covered net-worth chart.

    Older demo entry points keep their deliberate missing-coverage examples unchanged.
    No refresh, live quote, or existing user workspace is involved.
    """
    from app.market_models import AssetPricing, FXObservation
    from app.models import Asset, PriceObservation

    for asset in session.scalars(select(Asset).order_by(Asset.symbol, Asset.id)):
        config = session.scalar(select(AssetPricing).where(AssetPricing.asset_id == asset.id))
        if config is None:
            config = AssetPricing(asset_id=asset.id)
            session.add(config)
        config.mode, config.provider = "AUTOMATIC", "SYNTHETIC"
        config.blocked_from = config.blocked_to = None
        existing = {
            p.price_date
            for p in session.scalars(
                select(PriceObservation).where(
                    PriceObservation.asset_id == asset.id,
                    PriceObservation.source == "SYNTHETIC",
                    PriceObservation.price_type == "RAW_CLOSE",
                )
            )
        }
        for n in range((end - start).days + 1):
            day = start + timedelta(days=n)
            if day.weekday() < 5 and day not in existing:
                session.add(
                    PriceObservation(
                        asset_id=asset.id,
                        currency=asset.currency,
                        price_date=day,
                        price=Decimal("100") + Decimal(n % 37 - 18) / Decimal(10),
                        source="SYNTHETIC",
                        price_type="RAW_CLOSE",
                    )
                )
        session.flush()
    existing = {
        (r.rate_date, r.quote_currency)
        for r in session.scalars(select(FXObservation).where(FXObservation.provider == "SYNTHETIC"))
    }
    for n in range((end - start).days + 1):
        day = start + timedelta(days=n)
        for currency, rate in [("BRL", "6"), ("USD", "1.1"), ("JPY", "160")]:
            if day.weekday() < 5 and (day, currency) not in existing:
                session.add(
                    FXObservation(
                        base_currency="EUR",
                        quote_currency=currency,
                        rate_date=day,
                        rate=Decimal(rate),
                        provider="SYNTHETIC",
                        fetched_at=datetime(2026, 9, 30, tzinfo=UTC),
                    )
                )


if __name__ == "__main__":
    with Session(get_engine()) as session, session.begin():
        created = seed_wealth_demo(session)
    print(
        "Synthetic wealth demo created." if created else "Existing workspace preserved; no changes."
    )
