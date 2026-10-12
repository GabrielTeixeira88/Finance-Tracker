from datetime import date
from uuid import UUID

from fastapi import APIRouter, Query
from sqlalchemy import select

from app import investments, ledger
from app.investment_schemas import ActivityInput, AssetInput, PriceInput
from app.models import Asset, InvestmentActivity, PriceObservation
from app.routes import DB

router = APIRouter(prefix="/api/investments", tags=["investments"])


@router.get("/assets")
def assets(db: DB):
    return investments.wire(
        list(db.scalars(select(Asset).order_by(Asset.symbol, Asset.exchange, Asset.currency)))
    )


@router.post("/assets", status_code=201)
def create_asset(data: AssetInput, db: DB):
    row = Asset(**data.model_dump())
    db.add(row)
    db.flush()
    return investments.wire(row)


@router.get("/portfolio")
@router.get("/holdings")
def portfolio(db: DB, account_id: UUID | None = None, as_of: date | None = None):
    return investments.portfolio(db, account_id=account_id, as_of=as_of)


@router.get("/accounts")
def accounts(db: DB, as_of: date | None = None):
    return investments.portfolio(db, as_of=as_of)["accounts"]


@router.get("/accounts/{account_id}")
def account(account_id: UUID, db: DB, as_of: date | None = None):
    return investments.portfolio(db, account_id=account_id, as_of=as_of)


@router.get("/assets/{asset_id}")
def asset(asset_id: UUID, db: DB, as_of: date | None = None):
    report = investments.portfolio(db, asset_id=asset_id, as_of=as_of)
    return {
        "asset": investments.wire(ledger.require(db, Asset, asset_id)),
        **{key: report[key] for key in ("as_of", "method", "holdings", "positions")},
    }


@router.post("/assets/{asset_id}/prices", status_code=201)
def price(asset_id: UUID, data: PriceInput, db: DB):
    from app.market_models import AssetPricing

    ledger.require(db, Asset, asset_id)
    row = PriceObservation(asset_id=asset_id, **data.model_dump())
    db.add(row)
    db.flush()
    config = db.scalar(select(AssetPricing).where(AssetPricing.asset_id == asset_id))
    if config is None:
        config = AssetPricing(asset_id=asset_id)
        db.add(config)
    config.mode = "MANUAL"
    return investments.wire(row)


@router.get("/activities")
def activities(
    db: DB,
    account_id: UUID | None = None,
    asset_id: UUID | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    query = select(InvestmentActivity)
    if account_id:
        query = query.where(InvestmentActivity.account_id == account_id)
    if asset_id:
        query = query.where(InvestmentActivity.asset_id == asset_id)
    return investments.wire(
        list(
            db.scalars(
                query.order_by(
                    InvestmentActivity.activity_date.desc(), InvestmentActivity.sequence.desc()
                )
                .limit(limit)
                .offset(offset)
            )
        )
    )


@router.post("/activities/preview")
def preview(data: ActivityInput, db: DB):
    # Savepoint runs the real validations but never posts preview history.
    transaction = db.begin_nested()
    try:
        row = investments.post(db, data)
        positions = investments.reconstruct(investments.activities(db, data.account_id))
        position = positions.get((data.account_id, data.asset_id, data.currency), {})
        return investments.wire(
            {
                "gross_amount": row.gross_amount,
                "cash_amount": row.cash_amount,
                "direction": row.direction,
                "resulting_quantity": position.get("quantity", 0),
            }
        )
    finally:
        transaction.rollback()


@router.post("/activities", status_code=201)
def post(data: ActivityInput, db: DB):
    return investments.wire(investments.post(db, data))


@router.post("/activities/{activity_id}/void")
def void(activity_id: UUID, db: DB):
    return investments.wire(investments.void(db, activity_id))
