"""User-declared classification, never inferred issuer or fund look-through data."""

import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base, Record


class AssetClassification(Record, Base):
    __tablename__ = "asset_classifications"
    asset_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assets.id"), unique=True)
    sector: Mapped[str | None] = mapped_column(String(100))
    geography: Mapped[str | None] = mapped_column(String(100))
