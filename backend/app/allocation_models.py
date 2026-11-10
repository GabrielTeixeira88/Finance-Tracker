"""Local planning configuration. Targets never own money or create activities."""

from uuid import UUID

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models import Record


class AllocationTarget(Record, Base):
    __tablename__ = "allocation_targets"
    name: Mapped[str] = mapped_column(String(120))
    dimension: Mapped[str] = mapped_column(String(24))
    currency: Mapped[str] = mapped_column(String(3))
    scope: Mapped[str] = mapped_column(String(12))
    band_type: Mapped[str] = mapped_column(String(12))
    band_bps: Mapped[int] = mapped_column(Integer)
    relative_factor_bps: Mapped[int] = mapped_column(Integer)
    version: Mapped[int] = mapped_column(Integer, default=1)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    __table_args__ = (
        CheckConstraint("length(trim(name)) > 0", name="name"),
        CheckConstraint("scope IN ('all','accounts')", name="scope"),
        CheckConstraint("band_type IN ('absolute','hybrid')", name="band_type"),
        CheckConstraint("band_bps BETWEEN 0 AND 10000", name="band"),
        CheckConstraint("relative_factor_bps BETWEEN 0 AND 10000", name="relative_band"),
        CheckConstraint("version > 0", name="version"),
        CheckConstraint(
            "dimension IN ('asset_class','instrument_type','sector',"
            "'geography','currency','issuer')",
            name="dimension",
        ),
        CheckConstraint("length(currency) = 3 AND currency NOT GLOB '*[^A-Z]*'", name="currency"),
    )


class AllocationTargetWeight(Record, Base):
    __tablename__ = "allocation_target_weights"
    target_id: Mapped[UUID] = mapped_column(ForeignKey("allocation_targets.id"), index=True)
    version: Mapped[int] = mapped_column(Integer)
    category: Mapped[str] = mapped_column(String(100))
    target_bps: Mapped[int] = mapped_column(Integer)
    required: Mapped[bool] = mapped_column(Boolean, default=True)
    __table_args__ = (
        UniqueConstraint("target_id", "version", "category"),
        CheckConstraint("target_bps BETWEEN 0 AND 10000", name="weight"),
        CheckConstraint("version > 0", name="version"),
        CheckConstraint("length(trim(category)) > 0", name="category"),
    )


class AllocationTargetAccount(Record, Base):
    __tablename__ = "allocation_target_accounts"
    target_id: Mapped[UUID] = mapped_column(ForeignKey("allocation_targets.id"), index=True)
    version: Mapped[int] = mapped_column(Integer)
    account_id: Mapped[UUID] = mapped_column(ForeignKey("financial_accounts.id"))
    __table_args__ = (
        UniqueConstraint("target_id", "version", "account_id"),
        CheckConstraint("version > 0", name="version"),
    )
