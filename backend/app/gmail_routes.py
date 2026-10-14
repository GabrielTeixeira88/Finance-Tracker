"""Local-origin Gmail controls. Network calls never run inside DB write requests."""

from datetime import date, timedelta
from functools import lru_cache
from typing import Annotated, Literal
from urllib.parse import urlsplit
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import Field, field_validator, model_validator
from sqlalchemy import func, select

from app import ingestion, ledger
from app.config import get_settings
from app.database import get_engine
from app.gmail_models import GmailConnection, GmailSyncRun
from app.gmail_provider import GmailError
from app.gmail_service import GmailService, busy, connection
from app.ingestion_schemas import Candidate, Confirm
from app.models import ImportBatch
from app.routes import DB
from app.schemas import Input


def local_request(request: Request):
    allowed = {s.strip() for s in get_settings().gmail_local_origins.split(",")}
    origin = request.headers.get("origin")
    hostname = urlsplit("http://" + request.headers.get("host", "")).hostname
    if (
        hostname not in {"127.0.0.1", "localhost", "::1"}
        or request.headers.get("x-finance-gmail") != "1"
        or (origin and origin not in allowed)
    ):
        raise HTTPException(403, "Gmail controls require an approved local application origin")


router = APIRouter(
    prefix="/api/gmail", tags=["Gmail ingestion"], dependencies=[Depends(local_request)]
)


@lru_cache
def get_service():
    return GmailService(get_engine(), get_settings())


Service = Annotated[GmailService, Depends(get_service)]


def call(service, method, *args):
    try:
        return getattr(service, method)(*args)
    except GmailError as error:
        service.error(error.code)
        raise HTTPException(409, error.code) from None


@router.get("")
def status(db: DB):
    row = db.get(GmailConnection, 1)
    pending = db.scalar(
        select(func.count())
        .select_from(ImportBatch)
        .where(ImportBatch.source_type == "GMAIL", ImportBatch.status == "DRAFT")
    )
    result = {
        k: getattr(row, k) if row else None
        for k in (
            "mailbox",
            "label_id",
            "account_id",
            "last_attempt",
            "last_success",
            "error",
            "backfill_start",
            "backfill_end",
            "active_run",
        )
    }
    return {
        **result,
        "active_run": row.active_run if row and busy(row) else None,
        "status": row.status if row else "DISCONNECTED",
        "polling_minutes": row.polling_minutes if row else 5,
        "paused": row.paused if row else True,
        "senders": row.senders if row else [],
        "pending": pending,
        "configured": bool(get_settings().google_oauth_client_id),
        "parsers": [{"id": "synthetic-bank", "version": "1", "synthetic_only": True}],
        "automatic_posting": False,
    }


@router.post("/connect")
def connect(service: Service):
    return call(service, "begin_oauth")


@router.post("/disconnect")
def disconnect(service: Service):
    call(service, "disconnect")
    return {"status": "DISCONNECTED"}


@router.get("/labels")
def labels(service: Service):
    return [{"id": r["id"], "name": r["name"]} for r in call(service, "labels")]


class Configuration(Input):
    label_id: str = Field(min_length=1, max_length=200)
    account_id: UUID
    senders: list[str] = Field(default_factory=list, max_length=25)
    polling_minutes: Literal[0, 1, 5, 15] = 5
    paused: bool = True
    start: date
    end: date

    @field_validator("senders")
    @classmethod
    def addresses(cls, values):
        import re

        if any(not re.fullmatch(r"[^\s@<>]{1,100}@[^\s@<>]{1,150}", v.strip()) for v in values):
            raise ValueError("Use exact sender email addresses")
        return sorted(set(v.strip().lower() for v in values))

    @model_validator(mode="after")
    def dates(self):
        if (
            self.start > self.end
            or self.end > date.today()
            or self.end - self.start > timedelta(days=90)
        ):
            raise ValueError("Choose at most 90 historical days")
        return self


@router.put("/configuration")
def configure(data: Configuration, service: Service):
    call(service, "configure", data)
    return {"saved": True}


class Pause(Input):
    paused: bool


@router.post("/polling")
def polling(data: Pause, db: DB):
    row = connection(db)
    if not data.paused and (row.status != "CONNECTED" or not row.label_id or not row.account_id):
        raise HTTPException(409, "Connect and configure Gmail first")
    row.paused = data.paused
    return {"paused": row.paused}


@router.post("/sync")
def sync(service: Service):
    return {"run_id": call(service, "start_sync")}


@router.post("/cancel")
def cancel(db: DB):
    row = connection(db)
    if row.active_run:
        run = db.get(GmailSyncRun, UUID(row.active_run))
        if run:
            run.cancel_requested = True
    return {"cancel_requested": True}


@router.get("/runs")
def runs(db: DB):
    return list(db.scalars(select(GmailSyncRun).order_by(GmailSyncRun.created_at.desc()).limit(30)))


@router.get("/queue")
def queue(db: DB, offset: int = Query(0, ge=0), completed: bool = False):
    batches = db.scalars(
        select(ImportBatch)
        .where(
            ImportBatch.source_type == "GMAIL",
            ImportBatch.status == ("COMPLETED" if completed else "DRAFT"),
        )
        .order_by(ImportBatch.created_at.desc(), ImportBatch.id)
        .limit(25)
        .offset(offset)
    )
    return [ingestion.preview(db, batch) for batch in batches]


class EditCandidate(Input):
    account_id: UUID
    candidate: Candidate


@router.put("/candidates/{batch_id}")
def edit_candidate(batch_id: UUID, data: EditCandidate, db: DB):
    batch = ledger.require(db, ImportBatch, batch_id)
    if batch.source_type != "GMAIL" or batch.status != "DRAFT":
        raise HTTPException(409, "Only unposted Gmail candidates can be edited")
    source = ingestion.source_rows(db, batch)[0]
    if source.validation_errors or source.raw_data.get("link_only") == "yes":
        raise HTTPException(422, "Unsupported or special notifications must be linked or skipped")
    account = ledger.posting_account(db, data.account_id)
    if account.currency != data.candidate.currency:
        raise HTTPException(422, "Choose an account matching the original currency")
    if data.candidate.currency != source.normalized_data["currency"]:
        raise HTTPException(422, "Preserve the original source currency")
    # Raw parser output remains immutable; only the reviewable candidate is edited.
    batch.account_id = account.id
    source.normalized_data = data.candidate.model_dump(mode="json")
    source.normalized_data["ambiguity"] = source.raw_data.get("original_ambiguity") or None
    source.decision = {
        k: str(v) if v else None
        for k, v in (
            ("category_id", data.candidate.category_id),
            ("payee_id", data.candidate.payee_id),
        )
    }
    db.flush()
    return ingestion.preview(db, batch)


class Approval(Input):
    batch_id: UUID
    preview_token: str = Field(min_length=64, max_length=64)


class BulkApproval(Input):
    items: list[Approval] = Field(min_length=1, max_length=25)


@router.post("/approve")
def approve(data: BulkApproval, db: DB):
    if len({item.batch_id for item in data.items}) != len(data.items):
        raise HTTPException(422, "Select each candidate once")
    results = []
    for item in data.items:
        batch = ledger.require(db, ImportBatch, item.batch_id)
        if batch.source_type != "GMAIL":
            raise HTTPException(422, "Select Gmail candidates only")
        if len(data.items) > 1 and batch.status != "COMPLETED":
            preview = ingestion.preview(db, batch)
            if not preview["ready"] or any(
                row["status"] != "NEW" or row["candidate"].get("ambiguity") or row["schedules"]
                for row in preview["rows"]
            ):
                raise HTTPException(409, "Review ambiguous notifications individually")
        results.append(
            ingestion.confirm(
                db, batch, Confirm(preview_token=item.preview_token, account_confirmed=True)
            )
        )
    return results
