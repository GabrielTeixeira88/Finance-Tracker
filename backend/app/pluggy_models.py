"""Local provider evidence; these records never act as account balances/holdings."""

import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models import Record, UTCDateTime


class PluggyItem(Record, Base):
    __tablename__ = "pluggy_items"
    external_id: Mapped[str] = mapped_column(String(36), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    connector_id: Mapped[str | None] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(40))
    paused: Mapped[bool] = mapped_column(Boolean, default=False)
    last_sync: Mapped[datetime | None] = mapped_column(UTCDateTime())
    error: Mapped[str | None] = mapped_column(String(80))
    warnings: Mapped[list] = mapped_column(JSON, default=list)


class PluggyResource(Record, Base):
    __tablename__ = "pluggy_resources"
    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("pluggy_items.id"), index=True)
    kind: Mapped[str] = mapped_column(String(32))
    external_id: Mapped[str] = mapped_column(String(200))
    digest: Mapped[str] = mapped_column(String(64))
    data: Mapped[dict] = mapped_column(JSON)
    account_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("financial_accounts.id"), index=True
    )
    asset_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("assets.id"))
    __table_args__ = (UniqueConstraint("item_id", "kind", "external_id"),)


class PluggyObservation(Record, Base):
    __tablename__ = "pluggy_observations"
    resource_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("pluggy_resources.id"), index=True)
    digest: Mapped[str] = mapped_column(String(64))
    data: Mapped[dict] = mapped_column(JSON)
    __table_args__ = (UniqueConstraint("resource_id", "digest"),)
