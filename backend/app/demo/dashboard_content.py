"""One additive fictional manual holding for the dashboard's valuation reminder.

Existing ownership, not a new purchase: never creates cash, income or investments.
"""

from datetime import UTC, date, datetime
from decimal import Decimal
from uuid import NAMESPACE_URL, uuid5

from app import wealth
from app.models import DemoFixture
from app.wealth_models import ManualPosition
from app.wealth_routes import ObservationInput

MARKER = "dashboard_content"
CONTENT_VERSION = 1
STAMP = datetime(2026, 9, 30, tzinfo=UTC)


def identity(key):
    return uuid5(NAMESPACE_URL, "finance-tracker/unified-dashboard-1/" + key)


def extend(session):
    from app.demo.unified import VERSION

    fixture = session.get(DemoFixture, VERSION)
    if fixture is None:
        raise ValueError("Dashboard examples require an owned unified demo")
    if fixture.payload.get(MARKER) == CONTENT_VERSION:
        return False
    row = session.get(ManualPosition, identity("audio-collection"))
    if row is None:
        row = ManualPosition(
            id=identity("audio-collection"),
            name="Vintage audio collection",
            kind="ASSET",
            category="COLLECTIBLE",
            currency="BRL",
            liquidity="ILLIQUID",
            start_date=date(2024, 10, 1),
            created_at=STAMP,
            updated_at=STAMP,
            notes="Fictional equipment owned before replay. Recorded valuations; no cash posting.",
        )
        wealth.check_position(session, row)
        session.add(row)
        session.flush()
        for day, amount in ((date(2024, 10, 1), "2200"), (date(2026, 5, 15), "2600")):
            observation = wealth.add_observation(
                session,
                row,
                ObservationInput(
                    effective_date=day,
                    amount=Decimal(amount),
                    notes="Fictional recorded appraisal",
                ),
            )
            observation.id = identity(day.isoformat())
            observation.created_at = STAMP
            observation.updated_at = STAMP
    fixture.payload = {**fixture.payload, MARKER: CONTENT_VERSION}
    session.flush()
    return True
