from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select

from app import ingestion, investments, ledger
from app import investment_imports as service
from app.ingestion_routes import bounded_model_upload, save_profile
from app.ingestion_schemas import Confirm
from app.models import ImportBatch, ImportProfile, SourceRecord
from app.routes import DB

router = APIRouter(prefix="/api/investments/imports", tags=["brokerage imports"])


async def upload(request: Request):
    return await bounded_model_upload(request, service.Upload)


@router.get("/profiles")
def profiles(db: DB):
    return investments.wire(
        [
            p
            for p in db.scalars(select(ImportProfile).order_by(ImportProfile.name))
            if p.configuration.get("kind") == "BROKERAGE"
        ]
    )


@router.post("/profiles", status_code=201)
def create_profile(data: service.Profile, db: DB):
    return investments.wire(save_profile(data, db))


@router.get("")
def history(db: DB, limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0)):
    return [
        ingestion.batch_info(b)
        for b in db.scalars(
            select(ImportBatch)
            .where(ImportBatch.source_type == "BROKERAGE_CSV")
            .order_by(ImportBatch.created_at.desc(), ImportBatch.id)
            .limit(limit)
            .offset(offset)
        )
    ]


@router.post("/preview", status_code=201)
def preview(data: Annotated[service.Upload, Depends(upload)], db: DB):
    return service.preview(db, service.create_batch(db, data))


@router.get("/{batch_id}")
def get(batch_id: UUID, db: DB):
    return service.preview(db, service.require_batch(db, batch_id))


@router.patch("/{batch_id}/rows/{source_id}")
def decision(batch_id: UUID, source_id: UUID, data: service.Decision, db: DB):
    batch = service.require_batch(db, batch_id)
    if batch.status != "DRAFT":
        raise HTTPException(409, "Completed imports are immutable")
    source = ledger.require(db, SourceRecord, source_id)
    if source.import_batch_id != batch.id:
        raise HTTPException(404, "Row is not in this import")
    source.decision = data.model_dump()
    db.flush()
    return service.preview(db, batch)


@router.post("/{batch_id}/confirm")
def confirm(batch_id: UUID, data: Confirm, db: DB):
    return service.confirm(db, service.require_batch(db, batch_id), data)
