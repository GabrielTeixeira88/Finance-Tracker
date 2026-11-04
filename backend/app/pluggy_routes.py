"""Loopback-only Pluggy controls; provider requests never share a DB write transaction."""

from datetime import date
from functools import lru_cache
from typing import Annotated
from urllib.parse import urlsplit
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import Field, SecretStr, ValidationError, model_validator
from sqlalchemy import select

from app import ingestion, ledger
from app.config import get_settings
from app.database import get_engine
from app.investments import wire
from app.models import ImportBatch
from app.pluggy_models import PluggyItem, PluggyObservation, PluggyResource
from app.pluggy_provider import PluggyError
from app.pluggy_service import PluggyService, map_resource, stage_bank, stage_investment
from app.routes import DB
from app.schemas import Input, OpeningMoney


def local_request(request: Request):
    if hasattr(request.app.state, "demo_store"):
        raise HTTPException(403, "Pluggy is disabled in the isolated demo")
    host = urlsplit("http://" + request.headers.get("host", "")).hostname
    origin = request.headers.get("origin")
    allowed = {v.strip() for v in get_settings().pluggy_local_origins.split(",")}
    if (
        host not in {"127.0.0.1", "localhost", "::1"}
        or request.headers.get("x-finance-pluggy") != "1"
        or (origin and origin not in allowed)
    ):
        raise HTTPException(403, "Pluggy requires the local application origin and header")


router = APIRouter(
    prefix="/api/pluggy",
    tags=["Pluggy read-only integration"],
    dependencies=[Depends(local_request)],
)


@lru_cache
def cached_service():
    return PluggyService(get_engine(), get_settings())


def get_service():
    return cached_service()


Service = Annotated[PluggyService, Depends(get_service)]


def call(service, method, *args):
    try:
        return getattr(service, method)(*args)
    except PluggyError as error:
        status = (
            409
            if error.code
            in {"PLUGGY_OPERATION_IN_PROGRESS", "CONNECTION_PAUSED", "PLUGGY_NOT_CONFIGURED"}
            else 502
        )
        raise HTTPException(status, error.code) from None


class Credentials(Input):
    client_id: SecretStr
    client_secret: SecretStr
    acknowledge_external_processing: bool


@router.get("/status")
def status(service: Service):
    try:
        configured = bool(service.secret())
        error = None
    except PluggyError as problem:
        configured, error = False, problem.code
    return {
        "configured": configured,
        "error": error,
        "automatic_posting": False,
        "payment_initiation": False,
        "credentials_store": "OS_VAULT",
    }


@router.put("/credentials")
async def credentials(request: Request, service: Service):
    raw = bytearray()
    async for chunk in request.stream():
        if len(raw) + len(chunk) > 16384:
            raise HTTPException(413, "Credential request too large")
        raw.extend(chunk)
    try:
        data = Credentials.model_validate_json(raw)
    except (ValidationError, ValueError):
        raise HTTPException(422, "Invalid credential configuration") from None
    client_id, secret = data.client_id.get_secret_value(), data.client_secret.get_secret_value()
    if (
        not data.acknowledge_external_processing
        or not 1 <= len(client_id) <= 256
        or not 1 <= len(secret) <= 2048
    ):
        raise HTTPException(422, "Enter credentials and acknowledge external data processing")
    call(service, "configure", client_id, secret)
    return {"saved": True}


@router.delete("/credentials")
def forget(service: Service):
    call(service, "forget")
    return {"disconnected": True, "local_history_preserved": True}


class Token(Input):
    item_id: UUID | None = None


@router.post("/connect-token")
def token(data: Token, service: Service):
    return call(service, "connect_token", data.item_id)


@router.post("/discover")
def discover(service: Service):
    return call(service, "discover")


class Adopt(Input):
    external_id: UUID


@router.post("/items", status_code=201)
def adopt(data: Adopt, service: Service):
    return {"id": call(service, "adopt", data.external_id)}


@router.get("/items")
def items(db: DB):
    return wire(list(db.scalars(select(PluggyItem).order_by(PluggyItem.created_at, PluggyItem.id))))


@router.post("/items/{item_id}/sync")
def sync(item_id: UUID, service: Service):
    return call(service, "sync", item_id)


@router.post("/items/{item_id}/refresh")
def refresh(item_id: UUID, service: Service):
    return call(service, "update", item_id)


class Pause(Input):
    paused: bool


@router.patch("/items/{item_id}")
def pause(item_id: UUID, data: Pause, db: DB):
    item = ledger.require(db, PluggyItem, item_id)
    if item.status == "REVOKED" and not data.paused:
        raise HTTPException(409, "Reconnect revoked connections explicitly")
    item.paused = data.paused
    return {"paused": item.paused}


class Revoke(Input):
    confirm_external_id: UUID


@router.post("/items/{item_id}/revoke")
def revoke(item_id: UUID, data: Revoke, service: Service):
    from sqlalchemy.orm import Session

    with Session(service.engine) as db:
        if str(data.confirm_external_id) != ledger.require(db, PluggyItem, item_id).external_id:
            raise HTTPException(422, "Confirm the exact provider connection to revoke")
    return call(service, "revoke", item_id)


@router.get("/resources")
def resources(
    db: DB,
    item_id: UUID,
    kind: str = Query(
        pattern="^(ACCOUNT|TRANSACTION|BILL|INVESTMENT|INVESTMENT_TRANSACTION|CONSENT|LOAN|IDENTITY)$"
    ),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    parent_id: str | None = Query(None, max_length=200),
):
    ledger.require(db, PluggyItem, item_id)
    query = select(PluggyResource).where(
        PluggyResource.item_id == item_id, PluggyResource.kind == kind
    )
    if parent_id:
        key = "investmentId" if kind == "INVESTMENT_TRANSACTION" else "accountId"
        query = query.where(PluggyResource.data[key].as_string() == parent_id)
    return wire(
        list(
            db.scalars(
                query.order_by(PluggyResource.created_at, PluggyResource.id)
                .offset(offset)
                .limit(limit)
            )
        )
    )


@router.get("/resources/{resource_id}/observations")
def observations(resource_id: UUID, db: DB, offset: int = Query(0, ge=0)):
    ledger.require(db, PluggyResource, resource_id)
    return wire(
        list(
            db.scalars(
                select(PluggyObservation)
                .where(PluggyObservation.resource_id == resource_id)
                .order_by(PluggyObservation.created_at.desc(), PluggyObservation.id)
                .offset(offset)
                .limit(50)
            )
        )
    )


class Mapping(Input):
    account_id: UUID
    asset_id: UUID | None = None


@router.put("/resources/{resource_id}/mapping")
def mapping(resource_id: UUID, data: Mapping, db: DB):
    map_resource(
        db, ledger.require(db, PluggyResource, resource_id), data.account_id, data.asset_id
    )
    return {"mapped": True}


class Period(Input):
    start: date
    end: date

    @model_validator(mode="after")
    def valid(self):
        if self.start > self.end or self.end > date.today():
            raise ValueError("Choose a historical review period")
        return self


@router.post("/resources/{resource_id}/review")
def review(resource_id: UUID, data: Period, db: DB):
    resource = ledger.require(db, PluggyResource, resource_id)
    return ingestion.batch_info(
        stage_bank(db, resource, data.start.isoformat(), data.end.isoformat())
    )


class ReviewedActivity(Input):
    resource_id: UUID
    fees: OpeningMoney
    taxes: OpeningMoney


class InvestmentReview(Input):
    activities: list[ReviewedActivity] = Field(min_length=1, max_length=200)


@router.post("/resources/{resource_id}/investment-review")
def investment_review(resource_id: UUID, data: InvestmentReview, db: DB):
    return ingestion.batch_info(
        stage_investment(db, ledger.require(db, PluggyResource, resource_id), data.activities)
    )


@router.get("/reviews")
def reviews(db: DB, offset: int = Query(0, ge=0)):
    return [
        ingestion.batch_info(b)
        for b in db.scalars(
            select(ImportBatch)
            .where(ImportBatch.source_type.in_(["PLUGGY", "PLUGGY_INVESTMENT"]))
            .order_by(ImportBatch.created_at.desc(), ImportBatch.id)
            .offset(offset)
            .limit(50)
        )
    ]
