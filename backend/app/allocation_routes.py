"""Stage A planning configuration and read-only drift. No worksheet/posting API."""

from datetime import date
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Query
from pydantic import Field
from sqlalchemy import select

from app import allocation_targets, ledger, wealth
from app.allocation_models import AllocationTarget
from app.routes import DB
from app.schemas import Currency, Input, Name

router = APIRouter(prefix="/api/investments/allocation-targets", tags=["allocation targets"])


class WeightInput(Input):
    category: str = Field(min_length=1, max_length=100)
    target_bps: int = Field(ge=0, le=10000, strict=True)
    required: bool = True


class TargetInput(Input):
    name: Name
    dimension: Literal[
        "asset_class", "instrument_type", "sector", "geography", "currency", "issuer"
    ]
    currency: Currency = "BRL"
    scope: Literal["all", "accounts"] = "all"
    account_ids: list[UUID] = Field(default_factory=list, max_length=100)
    band_type: Literal["absolute", "hybrid"] = "absolute"
    band_bps: int = Field(default=500, ge=0, le=10000, strict=True)
    relative_factor_bps: int = Field(default=2000, ge=0, le=10000, strict=True)
    weights: list[WeightInput] = Field(min_length=1, max_length=100)
    expected_version: int | None = Field(default=None, gt=0, strict=True)


@router.get("")
def listing(db: DB):
    return [
        allocation_targets.detail(db, row)
        for row in db.scalars(
            select(AllocationTarget)
            .where(AllocationTarget.active.is_(True))
            .order_by(AllocationTarget.name, AllocationTarget.id)
        )
    ]


@router.post("", status_code=201)
def create(data: TargetInput, db: DB):
    return allocation_targets.detail(db, allocation_targets.save(db, data))


@router.put("/{target_id}")
def update(target_id: UUID, data: TargetInput, db: DB):
    target = ledger.require(db, AllocationTarget, target_id)
    return allocation_targets.detail(db, allocation_targets.save(db, data, target))


@router.delete("/{target_id}")
def remove(target_id: UUID, db: DB, expected_version: int = Query(gt=0)):
    from fastapi import HTTPException

    target = ledger.require(db, AllocationTarget, target_id)
    if target.version != expected_version:
        raise HTTPException(409, "Target changed; reload before deleting")
    target.active = False
    db.flush()
    return allocation_targets.detail(db, target)


@router.get("/{target_id}/drift")
def drift(target_id: UUID, db: DB, as_of: date | None = None):
    day = as_of or date.today()
    wealth.valid_day(day)
    return allocation_targets.drift(db, ledger.require(db, AllocationTarget, target_id), day)
