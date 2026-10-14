"""Gmail operational metadata only. Credentials live in the OS keyring."""

import uuid
from datetime import date, datetime

from sqlalchemy import JSON, Boolean, CheckConstraint, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base, Record
from app.storage_types import UTCDateTime


class GmailConnection(Base):
    __tablename__ = "gmail_connections"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    mailbox: Mapped[str | None] = mapped_column(String(254))
    status: Mapped[str] = mapped_column(String(32), default="DISCONNECTED")
    label_id: Mapped[str | None] = mapped_column(String(200))
    account_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("financial_accounts.id"))
    senders: Mapped[list] = mapped_column(JSON, default=list)
    polling_minutes: Mapped[int] = mapped_column(Integer, default=5)
    paused: Mapped[bool] = mapped_column(Boolean, default=True)
    backfill_start: Mapped[date | None]
    backfill_end: Mapped[date | None]
    history_id: Mapped[str | None] = mapped_column(String(100))
    active_run: Mapped[str | None] = mapped_column(String(36))
    lease_until: Mapped[datetime | None] = mapped_column(UTCDateTime())
    last_attempt: Mapped[datetime | None] = mapped_column(UTCDateTime())
    last_success: Mapped[datetime | None] = mapped_column(UTCDateTime())
    error: Mapped[str | None] = mapped_column(String(100))
    __table_args__ = (
        CheckConstraint("id = 1", name="singleton"),
        CheckConstraint("polling_minutes IN (0,1,5,15)", name="polling"),
    )


class GmailSyncRun(Record, Base):
    __tablename__ = "gmail_sync_runs"
    status: Mapped[str] = mapped_column(String(32), default="RUNNING")
    mode: Mapped[str] = mapped_column(String(32))
    processed: Mapped[int] = mapped_column(Integer, default=0)
    duplicates: Mapped[int] = mapped_column(Integer, default=0)
    cancel_requested: Mapped[bool] = mapped_column(Boolean, default=False)
    error: Mapped[str | None] = mapped_column(String(100))
    completed_at: Mapped[datetime | None] = mapped_column(UTCDateTime())


class GmailMessageClaim(Base):
    """Unique mailbox/message identity pointing to the existing provenance record."""

    __tablename__ = "gmail_message_claims"
    identity: Mapped[str] = mapped_column("id", String(64), primary_key=True)
    source_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("source_records.id"), unique=True)
