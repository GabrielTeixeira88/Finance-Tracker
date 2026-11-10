"""Fictional classification and expectation examples; never creates ledger movements."""

from datetime import UTC, date, datetime
from decimal import Decimal
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy import select

from app import schedules
from app.analytics_models import AssetClassification
from app.automation_schemas import ScheduleInput
from app.demo.real_market import identity as historical_identity
from app.fixed_income_models import FixedIncomeContract
from app.models import Asset, Category, DemoFixture, FinancialAccount, Schedule

MARKER = "audit_content"
CONTENT_VERSION = 1
STAMP = datetime(2026, 9, 30, tzinfo=UTC)


def identity(key):
    return uuid5(NAMESPACE_URL, "finance-tracker/unified-audit-1/" + key)


def extend(session):
    from app.demo.unified import VERSION

    fixture = session.get(DemoFixture, VERSION)
    if fixture is None:
        raise ValueError("Audit examples require an owned unified demo")
    if fixture.payload.get(MARKER) == CONTENT_VERSION:
        return False
    existing = set(session.scalars(select(AssetClassification.asset_id)))
    contracts = {row.asset_id: row for row in session.scalars(select(FixedIncomeContract))}
    for asset in session.scalars(select(Asset)):
        if asset.id in existing:
            continue  # Preserve explicit user metadata, including deliberately blank fields.
        if asset.id in contracts:
            geography = "Brazil"
            sector = (
                "Government"
                if contracts[asset.id].instrument_type == "TESOURO_SELIC"
                else "Financials"
            )
        elif asset.symbol.startswith("SIM-"):
            # Fictional security-level declarations, not sourced ETF holdings/look-through.
            geography = (
                "Global"
                if "GLOBAL" in asset.symbol
                else "United States"
                if "SP500" in asset.symbol
                else "Brazil"
            )
            sector = (
                "Real Estate"
                if any(key in asset.symbol for key in ("PROPERTY", "LOG", "FII"))
                else "Diversified"
            )
        else:
            continue
        session.add(
            AssetClassification(
                id=identity("classification/" + str(asset.id)),
                asset_id=asset.id,
                sector=sector,
                geography=geography,
                created_at=STAMP,
                updated_at=STAMP,
            )
        )
    checking = session.get(FinancialAccount, historical_identity("row/2"))
    category = session.scalar(select(Category).where(Category.name == "Housing"))
    if checking and checking.active and session.get(Schedule, identity("rent-expectation")) is None:
        row = schedules.save_schedule(
            session,
            ScheduleInput(
                name="Monthly rent",
                description="Fictional upcoming rent expectation; not a posted expense",
                transaction_type="EXPENSE",
                account_id=checking.id,
                currency="BRL",
                category_id=category.id if category else None,
                amount=Decimal("1800"),
                frequency="MONTHLY",
                start_date=date(2026, 10, 5),
            ),
        )
        row.id = identity("rent-expectation")
        row.created_at = row.updated_at = STAMP
    fixture.payload = {**fixture.payload, MARKER: CONTENT_VERSION}
    session.flush()
    return True
