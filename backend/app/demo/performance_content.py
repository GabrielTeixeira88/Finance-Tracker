"""Additive local planning examples; never change investments, official data or cash."""

from datetime import UTC, datetime
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy import select

from app import allocation_targets
from app.allocation_models import AllocationTarget, AllocationTargetWeight
from app.allocation_routes import TargetInput
from app.models import DemoFixture

MARKER = "performance_insights_content"
CONTENT_VERSION = 1
STAMP = datetime(2026, 9, 30, tzinfo=UTC)


def identity(key):
    return uuid5(NAMESPACE_URL, "finance-tracker/unified-performance-1/" + key)


def extend(session):
    from app.demo.unified import VERSION

    fixture = session.get(DemoFixture, VERSION)
    if fixture is None:
        raise ValueError("Performance examples require an owned unified demo")
    if fixture.payload.get(MARKER) == CONTENT_VERSION:
        return False
    # Explicit fictional planning choice, not a recommended model portfolio.
    target_id = identity("household-target")
    if session.get(AllocationTarget, target_id) is None:
        target = allocation_targets.save(
            session,
            TargetInput(
                name="Household investment plan",
                dimension="asset_class",
                currency="BRL",
                band_type="hybrid",
                band_bps=500,
                relative_factor_bps=2000,
                weights=[
                    {"category": "ETF", "target_bps": 6000},
                    {"category": "BOND", "target_bps": 3000},
                    {"category": "CASH", "target_bps": 1000},
                ],
            ),
            new_id=target_id,
        )
        fixture.payload = {**fixture.payload, "performance_target_id": str(target.id)}
        for weight in session.scalars(
            select(AllocationTargetWeight).where(AllocationTargetWeight.target_id == target_id)
        ):
            weight.id = identity("weight/" + weight.category)
            weight.created_at = weight.updated_at = STAMP
    else:
        fixture.payload = {**fixture.payload, "performance_target_id": str(target_id)}
    for row in session.scalars(select(AllocationTarget)):
        if str(row.id) == fixture.payload["performance_target_id"]:
            row.created_at = row.updated_at = STAMP
    fixture.payload = {**fixture.payload, MARKER: CONTENT_VERSION}
    session.flush()
    return True
