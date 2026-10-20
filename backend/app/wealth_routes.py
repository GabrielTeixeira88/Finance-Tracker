from datetime import date
from decimal import localcontext
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from pydantic import Field
from sqlalchemy import select

from app import ledger, wealth
from app.investments import wire
from app.routes import DB
from app.schemas import Currency, Input, Name, OpeningMoney
from app.wealth_models import Goal, GoalEntry, ManualPosition, PositionObservation

router = APIRouter(prefix="/api", tags=["net-worth-goals"])


class PositionInput(Input):
    name: Name
    kind: Literal["ASSET", "LIABILITY"]
    category: str = Field(min_length=1, max_length=60)
    currency: Currency
    liquidity: Literal["LIQUID", "MARKETABLE", "ILLIQUID", "UNKNOWN"] = "ILLIQUID"
    start_date: date
    acquisition_cost: OpeningMoney | None = None
    associated_asset_id: UUID | None = None
    notes: str = Field(default="", max_length=2000)
    terms: str = Field(default="", max_length=1000)
    interest_rate: OpeningMoney | None = None
    minimum_payment: OpeningMoney | None = None
    payment_frequency: Literal["WEEKLY", "MONTHLY", "QUARTERLY", "ANNUAL", "OTHER"] | None = None
    expected_payoff_date: date | None = None


class ObservationInput(Input):
    effective_date: date
    amount: OpeningMoney
    notes: str = Field(default="", max_length=500)


class VoidInput(Input):
    reason: str = Field(min_length=1, max_length=500)


class ObservationCorrection(ObservationInput):
    reason: str = Field(min_length=1, max_length=500)


class CloseInput(Input):
    end_date: date
    disposal_proceeds: OpeningMoney | None = None


class GoalInput(Input):
    name: Name
    mode: Literal["MANUAL", "ACCOUNT"]
    currency: Currency
    target: OpeningMoney
    start_date: date
    deadline: date | None = None
    notes: str = Field(default="", max_length=2000)


class GoalStatus(Input):
    status: Literal["ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]


class GoalEntryInput(ObservationInput):
    account_id: UUID | None = None
    direction: Literal["IN", "OUT"] = "IN"


@router.get("/net-worth/history")
def history(db: DB, start: date, end: date, currency: Currency = "BRL"):
    return wire(wealth.net_worth(db, start, end, currency))


@router.get("/net-worth/summary")
def summary(db: DB, as_of: date | None = None, currency: Currency = "BRL"):
    day = as_of or date.today()
    return wire(wealth.net_worth(db, day, day, currency))


@router.get("/manual-positions")
def positions(db: DB):
    return wire(list(db.scalars(select(ManualPosition).order_by(ManualPosition.name))))


@router.post("/manual-positions", status_code=201)
def create_position(data: PositionInput, db: DB):
    record = ManualPosition(**data.model_dump())
    wealth.check_position(db, record)
    db.add(record)
    db.flush()
    return wire(record)


@router.patch("/manual-positions/{record_id}")
def edit_position(record_id: UUID, data: PositionInput, db: DB):
    record = ledger.require(db, ManualPosition, record_id)
    if (record.kind, record.currency, record.start_date) != (
        data.kind,
        data.currency,
        data.start_date,
    ):
        raise HTTPException(409, "Kind, currency and start date are immutable")
    for key, value in data.model_dump().items():
        setattr(record, key, value)
    wealth.check_position(db, record)
    db.flush()
    return wire(record)


@router.get("/manual-positions/{record_id}/observations")
def observations(record_id: UUID, db: DB):
    return wire(wealth.position_values(db, ledger.require(db, ManualPosition, record_id)))


@router.post("/manual-positions/{record_id}/observations", status_code=201)
def observation(record_id: UUID, data: ObservationInput, db: DB):
    return wire(wealth.add_observation(db, ledger.require(db, ManualPosition, record_id), data))


@router.post("/manual-observations/{record_id}/void")
def void_observation(record_id: UUID, data: VoidInput, db: DB):
    record = ledger.require(db, PositionObservation, record_id)
    wealth.void_record(record, data.reason)
    db.flush()
    return wire(record)


@router.post("/manual-observations/{record_id}/correct")
def correct_observation(record_id: UUID, data: ObservationCorrection, db: DB):
    record = ledger.require(db, PositionObservation, record_id)
    wealth.void_record(record, data.reason)
    db.flush()
    return wire(
        wealth.add_observation(
            db,
            ledger.require(db, ManualPosition, record.position_id),
            ObservationInput(**data.model_dump(exclude={"reason"})),
        )
    )


@router.post("/manual-positions/{record_id}/close")
def close_position(record_id: UUID, data: CloseInput, db: DB):
    record = ledger.require(db, ManualPosition, record_id)
    if record.end_date:
        raise HTTPException(409, "Already disposed or paid off")
    wealth.valid_day(data.end_date)
    if data.end_date < record.start_date:
        raise HTTPException(422, "End date precedes ownership")
    if any(
        o.effective_date > data.end_date and not o.voided_at
        for o in wealth.position_values(db, record)
    ):
        raise HTTPException(409, "Later observations must be corrected first")
    if record.kind == "LIABILITY" and data.disposal_proceeds is not None:
        raise HTTPException(422, "Debt payoff has no disposal proceeds")
    record.end_date = data.end_date
    record.disposal_proceeds = data.disposal_proceeds
    db.flush()
    return wire(record)


@router.get("/goals")
def goals(db: DB, as_of: date | None = None):
    return wire(
        [
            wealth.goal_detail(db, g, as_of or date.today())
            for g in db.scalars(select(Goal).order_by(Goal.name))
        ]
    )


@router.post("/goals", status_code=201)
def create_goal(data: GoalInput, db: DB):
    record = Goal(**data.model_dump(), status="ACTIVE")
    wealth.valid_day(record.start_date)
    if record.deadline and record.deadline < record.start_date:
        raise HTTPException(422, "Deadline precedes goal start")
    db.add(record)
    db.flush()
    return wire(record)


@router.get("/goal-allocations")
def allocations(db: DB, as_of: date | None = None):
    return wire(wealth.savings_allocations(db, as_of or date.today()))


@router.get("/goals/{record_id}")
def goal(
    record_id: UUID,
    db: DB,
    as_of: date | None = None,
    monthly: str = Query(default="0", pattern=r"^\d{1,18}(\.\d{1,6})?$"),
):
    from decimal import Decimal

    return wire(
        wealth.goal_detail(
            db, ledger.require(db, Goal, record_id), as_of or date.today(), Decimal(monthly)
        )
    )


@router.patch("/goals/{record_id}")
def edit_goal(record_id: UUID, data: GoalInput, db: DB):
    record = ledger.require(db, Goal, record_id)
    if (record.mode, record.currency) != (data.mode, data.currency):
        raise HTTPException(409, "Tracking mode and currency are immutable")
    for key, value in data.model_dump().items():
        setattr(record, key, value)
    wealth.check_goal(db, record)
    db.flush()
    return wire(record)


@router.post("/goals/{record_id}/status")
def goal_status(record_id: UUID, data: GoalStatus, db: DB):
    record = ledger.require(db, Goal, record_id)
    if record.status == "ARCHIVED":
        raise HTTPException(
            409, "Archived goals retain their historical release date; create a new goal"
        )
    record.status = data.status
    record.archived_date = date.today() if data.status == "ARCHIVED" else None
    with localcontext() as ctx:
        ctx.prec = 60
        wealth.validate_progress(db, record)
    return wire(record)


@router.post("/goals/{record_id}/entries", status_code=201)
def goal_entry(record_id: UUID, data: GoalEntryInput, db: DB):
    with localcontext() as ctx:
        ctx.prec = 60
        return wire(wealth.add_goal_entry(db, ledger.require(db, Goal, record_id), data))


@router.post("/goal-entries/{record_id}/void")
def void_entry(record_id: UUID, data: VoidInput, db: DB):
    record = ledger.require(db, GoalEntry, record_id)
    wealth.void_record(record, data.reason)
    with localcontext() as ctx:
        ctx.prec = 60
        wealth.validate_progress(db, ledger.require(db, Goal, record.goal_id))
    return wire(record)
