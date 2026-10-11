from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import ValidationError
from sqlalchemy import select

from app import ingestion, ledger
from app.ingestion_parsers import csv_rows, decode_upload, parse_ofx
from app.ingestion_schemas import MAX_BYTES, Confirm, Decision, ProfileInput, Upload
from app.models import FinancialAccount, ImportBatch, ImportProfile
from app.routes import DB

router = APIRouter(prefix="/api/imports", tags=["local imports"])


async def bounded_model_upload(request: Request, model):
    content = bytearray()
    async for chunk in request.stream():
        if len(content) + len(chunk) > MAX_BYTES * 3 // 2:
            raise HTTPException(413, "Upload request exceeds the 2 MiB file limit")
        content.extend(chunk)
    try:
        return model.model_validate_json(content)
    except ValidationError as error:
        raise HTTPException(
            422, "Invalid upload or mapping; check required columns and format settings"
        ) from error


async def bounded_upload(request: Request):
    return await bounded_model_upload(request, Upload)


Uploaded = Annotated[Upload, Depends(bounded_upload)]


@router.post("/inspect")
def inspect(data: Uploaded, db: DB):
    account = ledger.posting_account(db, data.account_id)
    _, content = decode_upload(data)
    if data.source_type == "CSV":
        if data.configuration is None:
            raise HTTPException(422, "Choose CSV format settings")
        headers, rows = csv_rows(content, data.configuration)
        return {"headers": headers, "sample": rows[:3], "count": len(rows)}
    rows, context = parse_ofx(content, account.currency)
    return {"source_context": context, "count": len(rows)}


@router.get("/profiles")
def profiles(db: DB):
    return [
        p
        for p in db.scalars(select(ImportProfile).order_by(ImportProfile.name, ImportProfile.id))
        if p.configuration.get("kind") != "BROKERAGE"
    ]


def save_profile(data, db, profile=None):
    if data.default_account_id:
        ledger.require(db, FinancialAccount, data.default_account_id)
    values = data.model_dump(mode="json")
    values["default_account_id"] = data.default_account_id
    if profile:
        for key, value in values.items():
            setattr(profile, key, value)
    else:
        profile = ImportProfile(**values)
        db.add(profile)
    db.flush()
    return profile


@router.post("/profiles", status_code=201)
def create_profile(data: ProfileInput, db: DB):
    return save_profile(data, db)


@router.put("/profiles/{record_id}")
def update_profile(record_id: UUID, data: ProfileInput, db: DB):
    profile = ledger.require(db, ImportProfile, record_id)
    if profile.configuration.get("kind") == "BROKERAGE":
        raise HTTPException(409, "Brokerage mappings belong to investment imports")
    return save_profile(data, db, profile)


@router.delete("/profiles/{record_id}", status_code=204)
def delete_profile(record_id: UUID, db: DB):
    db.delete(ledger.require(db, ImportProfile, record_id))
    db.flush()
    return Response(status_code=204)


@router.get("")
def history(db: DB, limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0)):
    return [
        ingestion.batch_info(batch)
        for batch in db.scalars(
            select(ImportBatch)
            .where(ImportBatch.source_type.in_(["CSV", "OFX"]))
            .order_by(ImportBatch.created_at.desc(), ImportBatch.id)
            .limit(limit)
            .offset(offset)
        )
    ]


@router.post("", status_code=201)
def preview_upload(data: Uploaded, db: DB):
    return ingestion.preview(db, ingestion.create_batch(db, data))


@router.get("/{batch_id}")
def get_batch(batch_id: UUID, db: DB):
    return ingestion.preview(db, ledger.require(db, ImportBatch, batch_id))


@router.patch("/{batch_id}/rows/{source_id}")
def update_row(batch_id: UUID, source_id: UUID, data: Decision, db: DB):
    batch = ledger.require(db, ImportBatch, batch_id)
    ingestion.decide(db, batch, source_id, data)
    return ingestion.preview(db, batch)


@router.post("/{batch_id}/confirm")
def confirm(batch_id: UUID, data: Confirm, db: DB):
    return ingestion.confirm(db, ledger.require(db, ImportBatch, batch_id), data)
