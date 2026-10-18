"""Additive reconciliation state; the ledger remains the balance authority."""

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Date,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models import Record
from app.storage_types import ExactMoney, UTCDateTime


class Clearing(Record, Base):
    __tablename__ = "transaction_clearing"
    transaction_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("transactions.id"), unique=True)
    cleared: Mapped[bool] = mapped_column(Boolean, default=False)
    bank_date: Mapped[date | None] = mapped_column(Date)
    source_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("source_records.id"))


class Statement(Record, Base):
    __tablename__ = "reconciliation_statements"
    account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("financial_accounts.id"), index=True)
    cutoff: Mapped[date] = mapped_column(Date)
    balance_magnitude: Mapped[Decimal] = mapped_column(ExactMoney())
    balance_negative: Mapped[bool] = mapped_column(Boolean)
    notes: Mapped[str] = mapped_column(String(500), default="")
    status: Mapped[str] = mapped_column(String(16), default="DRAFT")
    revision: Mapped[int] = mapped_column(Integer, default=1)
    completed_at: Mapped[datetime | None] = mapped_column(UTCDateTime())
    result: Mapped[dict] = mapped_column(JSON, default=dict)
    __table_args__ = (
        CheckConstraint("status IN ('DRAFT','COMPLETED','REOPENED')", name="status"),
        CheckConstraint("revision > 0", name="revision"),
        CheckConstraint(
            "length(balance_magnitude)=24 AND balance_magnitude NOT GLOB '*[^0-9]*'", name="balance"
        ),
    )


class StatementEntry(Record, Base):
    __tablename__ = "reconciliation_entries"
    statement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("reconciliation_statements.id"), index=True
    )
    transaction_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("transactions.id"), index=True)
    revision: Mapped[int] = mapped_column(Integer)
    __table_args__ = (UniqueConstraint("statement_id", "revision", "transaction_id"),)


class SourceDisposition(Record, Base):
    __tablename__ = "source_dispositions"
    source_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("source_records.id"), unique=True)
    detached: Mapped[bool] = mapped_column(Boolean, default=False)
    dismissed: Mapped[bool] = mapped_column(Boolean, default=False)
    rejected_ids: Mapped[list] = mapped_column(JSON, default=list)


class ReconciliationAudit(Record, Base):
    __tablename__ = "reconciliation_audits"
    request_id: Mapped[uuid.UUID] = mapped_column(unique=True)
    payload_digest: Mapped[str] = mapped_column(String(64))
    action: Mapped[str] = mapped_column(String(40))
    actor: Mapped[str] = mapped_column(String(32), default="LOCAL_USER")
    details: Mapped[dict] = mapped_column(JSON)
