"""Market metadata/cache only. These records never post financial movements."""

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, Date, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base, Record
from app.storage_types import ExactRate, UTCDateTime


class AssetPricing(Record, Base):
    __tablename__ = "asset_pricing"
    asset_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assets.id"), unique=True)
    mode: Mapped[str] = mapped_column(String(12), default="AUTOMATIC")
    provider: Mapped[str | None] = mapped_column(String(12))
    symbol_override: Mapped[str | None] = mapped_column(String(40))
    blocked_from: Mapped[date | None] = mapped_column(Date)
    blocked_to: Mapped[date | None] = mapped_column(Date)
    __table_args__ = (
        CheckConstraint("mode IN ('MANUAL','AUTOMATIC')", name="mode"),
        CheckConstraint("provider IN ('BRAPI','ALPHA','SYNTHETIC')", name="provider"),
        CheckConstraint(
            "blocked_to IS NULL OR (blocked_from IS NOT NULL AND blocked_to >= blocked_from)",
            name="blocked_range",
        ),
    )


class FXObservation(Record, Base):
    __tablename__ = "fx_observations"
    base_currency: Mapped[str] = mapped_column(String(3))
    quote_currency: Mapped[str] = mapped_column(String(3))
    rate_date: Mapped[date] = mapped_column(Date, index=True)
    rate: Mapped[Decimal] = mapped_column(ExactRate())
    provider: Mapped[str] = mapped_column(String(12))
    fetched_at: Mapped[datetime] = mapped_column(UTCDateTime())
    __table_args__ = (
        UniqueConstraint("base_currency", "quote_currency", "rate_date", "provider"),
        CheckConstraint(
            "base_currency='EUR' AND quote_currency IN ('BRL','USD','JPY')", name="pair"
        ),
        CheckConstraint("provider IN ('ECB','SYNTHETIC')", name="provider"),
        CheckConstraint(
            "typeof(rate)='text' AND length(rate)=36 AND rate NOT GLOB '*[^0-9]*' "
            "AND rate > '000000000000000000000000000000000000'",
            name="rate",
        ),
    )


class MarketSettings(Record, Base):
    __tablename__ = "market_settings"
    singleton: Mapped[int] = mapped_column(Integer, default=1, unique=True)
    automatic: Mapped[bool] = mapped_column(Boolean, default=False)
    reporting_currency: Mapped[str] = mapped_column(String(3), default="BRL")
    fx_provider: Mapped[str] = mapped_column(String(12), default="ECB")
    __table_args__ = (
        CheckConstraint("singleton=1", name="singleton"),
        CheckConstraint("reporting_currency IN ('BRL','USD','EUR','JPY')", name="currency"),
        CheckConstraint("fx_provider IN ('ECB','SYNTHETIC')", name="fx_provider"),
    )


class SyncState(Record, Base):
    __tablename__ = "market_sync_state"
    scope: Mapped[str] = mapped_column(String(80), unique=True)
    provider: Mapped[str] = mapped_column(String(12))
    attempted_at: Mapped[datetime | None] = mapped_column(UTCDateTime())
    succeeded_at: Mapped[datetime | None] = mapped_column(UTCDateTime())
    retry_at: Mapped[datetime | None] = mapped_column(UTCDateTime())
    error: Mapped[str | None] = mapped_column(String(40))
    first_date: Mapped[date | None] = mapped_column(Date)
    last_date: Mapped[date | None] = mapped_column(Date)


class ProviderBudget(Record, Base):
    __tablename__ = "market_provider_budget"
    provider: Mapped[str] = mapped_column(String(12), unique=True)
    usage_date: Mapped[date] = mapped_column(Date)
    requests: Mapped[int] = mapped_column(Integer, default=0)
    retry_at: Mapped[datetime | None] = mapped_column(UTCDateTime())
