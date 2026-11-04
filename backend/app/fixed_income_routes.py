from datetime import date
from uuid import UUID

from fastapi import APIRouter

from app import fixed_income, investments, ledger
from app.fixed_income_models import FixedIncomeContract, FixedIncomeIndex
from app.fixed_income_schemas import IndexInput, Redemption, Subscription
from app.routes import DB

router = APIRouter(prefix="/api/investments/fixed-income", tags=["fixed-income"])


@router.get("")
def overview(db: DB, as_of: date | None = None, account_id: UUID | None = None):
    return fixed_income.overview(db, as_of or date.today(), account_id)


@router.post("", status_code=201)
def subscribe(data: Subscription, db: DB):
    return investments.wire(fixed_income.subscribe(db, data))


@router.post("/indices", status_code=201)
def index(data: IndexInput, db: DB):
    row = FixedIncomeIndex(**data.model_dump())
    db.add(row)
    db.flush()
    return {**investments.wire(row), "factor": format(row.factor, "f")}


@router.get("/{contract_id}/history")
def history(contract_id: UUID, start: date, end: date, db: DB):
    return fixed_income.contract_history(
        db, ledger.require(db, FixedIncomeContract, contract_id), start, end
    )


@router.post("/{contract_id}/redemptions/preview")
def preview(contract_id: UUID, data: Redemption, db: DB):
    return fixed_income.redeem(
        db, ledger.require(db, FixedIncomeContract, contract_id), data, preview=True
    )


@router.post("/{contract_id}/redemptions", status_code=201)
def redeem(contract_id: UUID, data: Redemption, db: DB):
    return fixed_income.redeem(db, ledger.require(db, FixedIncomeContract, contract_id), data)
