from datetime import date
from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Query
from pydantic import BeforeValidator, Field
from sqlalchemy import func, select
from sqlalchemy.orm import aliased

from app import ledger
from app import reconciliation as service
from app.models import SourceRecord, Transaction
from app.reconciliation_models import ReconciliationAudit, Statement
from app.routes import DB
from app.schemas import Input, exact_decimal

router = APIRouter(prefix="/api", tags=["reconciliation"])


class Command(Input):
    request_id: UUID


class Clear(Command):
    cleared: bool
    source_id: UUID | None = None
    bank_date: date | None = None


class SourceChange(Command):
    token: str = Field(min_length=64, max_length=64)
    action: Literal["LINK", "UNLINK", "REJECT", "DISMISS", "REOPEN"]
    transaction_id: UUID | None = None
    reason: str = Field(min_length=1, max_length=500)


class StatementCreate(Command):
    account_id: UUID
    cutoff: date
    ending_balance: Annotated[
        Decimal,
        BeforeValidator(exact_decimal),
        Field(
            gt=Decimal("-1e18"),
            lt=Decimal("1e18"),
            max_digits=24,
            decimal_places=6,
            allow_inf_nan=False,
        ),
    ]
    notes: str = Field(default="", max_length=500)


class StatementChange(Command):
    token: str = Field(min_length=64, max_length=64)
    action: Literal["COMPLETE", "REOPEN"]
    reason: str = Field(min_length=1, max_length=500)


class Merge(Command):
    survivor_id: UUID
    duplicate_id: UUID
    token: str = Field(min_length=64, max_length=64)


@router.get("/transactions/{record_id}/sources")
def transaction_sources(record_id: UUID, db: DB):
    return {**service.state(db, record_id), "sources": service.sources(db, record_id)}


@router.post("/transactions/{record_id}/clearing")
def clearing(record_id: UUID, data: Clear, db: DB):
    return service.clear_transaction(db, record_id, data)


@router.get("/reconciliation/candidates")
def candidates(db: DB, offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=100)):
    return [
        service.candidate_view(db, row)
        for row in db.scalars(
            select(SourceRecord)
            .where(SourceRecord.source_type.in_(["CSV", "OFX", "GMAIL"]))
            .order_by(SourceRecord.created_at.desc(), SourceRecord.id)
            .offset(offset)
            .limit(limit)
        )
    ]


@router.post("/reconciliation/sources/{source_id}")
def source_change(source_id: UUID, data: SourceChange, db: DB):
    return service.change_source(db, source_id, data)


@router.get("/reconciliation/sessions")
def statements(db: DB, account_id: UUID | None = None):
    query = select(Statement).order_by(Statement.cutoff.desc(), Statement.id)
    if account_id:
        query = query.where(Statement.account_id == account_id)
    return [service.statement_view(db, row) for row in db.scalars(query.limit(100))]


@router.post("/reconciliation/sessions")
def create_statement(data: StatementCreate, db: DB):
    return service.create_statement(db, data)


@router.post("/reconciliation/sessions/{record_id}")
def change_statement(record_id: UUID, data: StatementChange, db: DB):
    return service.transition_statement(db, ledger.require(db, Statement, record_id), data)


@router.get("/reconciliation/history")
def history(db: DB, offset: int = Query(0, ge=0)):
    return list(
        db.scalars(
            select(ReconciliationAudit)
            .order_by(ReconciliationAudit.created_at.desc(), ReconciliationAudit.id)
            .offset(offset)
            .limit(100)
        )
    )


@router.get("/reconciliation/merge-preview")
def merge_preview(survivor_id: UUID, duplicate_id: UUID, db: DB):
    return service.merge_preview(db, survivor_id, duplicate_id)


@router.get("/reconciliation/duplicates")
def duplicate_candidates(db: DB, offset: int = Query(0, ge=0)):
    other = aliased(Transaction)
    # Date arithmetic never casts or aggregates monetary values.
    pairs = db.execute(
        select(Transaction, other)
        .join(
            other,
            (
                (Transaction.id < other.id)
                & (Transaction.account_id == other.account_id)
                & (Transaction.amount == other.amount)
                & (Transaction.currency == other.currency)
                & (Transaction.transaction_type == other.transaction_type)
            ),
        )
        .where(
            Transaction.deleted_at.is_(None),
            other.deleted_at.is_(None),
            Transaction.transaction_type.in_(["INCOME", "EXPENSE"]),
            func.abs(
                func.julianday(Transaction.transaction_date)
                - func.julianday(other.transaction_date)
            )
            <= service.ingestion_matching.get_settings().reconciliation_match_days,
        )
        .order_by(Transaction.transaction_date.desc(), Transaction.id, other.id)
        .offset(offset)
        .limit(50)
    )
    return [
        service.merge_preview(db, a.id, b.id)
        for a, b in pairs
        if abs((a.transaction_date - b.transaction_date).days)
        <= service.ingestion_matching.get_settings().reconciliation_match_days
    ]


@router.post("/reconciliation/merge")
def merge(data: Merge, db: DB):
    return service.merge(db, data)
