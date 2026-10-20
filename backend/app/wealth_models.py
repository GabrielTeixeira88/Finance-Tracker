"""Dated manual wealth records; none of these tables posts to the ledger."""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import CheckConstraint, Date, ForeignKey, Index, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models import Record
from app.storage_types import ExactMoney, UTCDateTime


class ManualPosition(Record, Base):
    __tablename__ = "manual_positions"
    name: Mapped[str] = mapped_column(String(120))
    kind: Mapped[str] = mapped_column(String(12))
    category: Mapped[str] = mapped_column(String(60))
    currency: Mapped[str] = mapped_column(String(3))
    liquidity: Mapped[str] = mapped_column(String(12), default="ILLIQUID")
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    acquisition_cost: Mapped[Decimal | None] = mapped_column(ExactMoney())
    disposal_proceeds: Mapped[Decimal | None] = mapped_column(ExactMoney())
    associated_asset_id: Mapped[UUID | None] = mapped_column(ForeignKey("manual_positions.id"))
    notes: Mapped[str] = mapped_column(String(2000), default="")
    terms: Mapped[str] = mapped_column(String(1000), default="")
    interest_rate: Mapped[Decimal | None] = mapped_column(ExactMoney())
    minimum_payment: Mapped[Decimal | None] = mapped_column(ExactMoney())
    payment_frequency: Mapped[str | None] = mapped_column(String(12))
    expected_payoff_date: Mapped[date | None] = mapped_column(Date)
    __table_args__ = (
        CheckConstraint("kind IN ('ASSET','LIABILITY')", name="kind"),
        CheckConstraint(
            "liquidity IN ('LIQUID','MARKETABLE','ILLIQUID','UNKNOWN')", name="liquidity"
        ),
        CheckConstraint("end_date IS NULL OR end_date >= start_date", name="dates"),
        CheckConstraint("length(trim(name)) > 0", name="name"),
        CheckConstraint("length(currency) = 3 AND currency NOT GLOB '*[^A-Z]*'", name="currency"),
        CheckConstraint(
            "associated_asset_id IS NULL OR associated_asset_id != id", name="association"
        ),
    )


class PositionObservation(Record, Base):
    __tablename__ = "position_observations"
    position_id: Mapped[UUID] = mapped_column(ForeignKey("manual_positions.id"), index=True)
    effective_date: Mapped[date] = mapped_column(Date, index=True)
    amount: Mapped[Decimal] = mapped_column(ExactMoney())
    notes: Mapped[str] = mapped_column(String(500), default="")
    voided_at: Mapped[datetime | None] = mapped_column(UTCDateTime())
    void_reason: Mapped[str | None] = mapped_column(String(500))
    __table_args__ = (
        CheckConstraint("length(amount) = 24 AND amount NOT GLOB '*[^0-9]*'", name="amount"),
        Index(
            "uq_position_observation_live_day",
            "position_id",
            "effective_date",
            unique=True,
            sqlite_where=text("voided_at IS NULL"),
        ),
    )


class Goal(Record, Base):
    __tablename__ = "goals"
    name: Mapped[str] = mapped_column(String(120))
    currency: Mapped[str] = mapped_column(String(3))
    mode: Mapped[str] = mapped_column(String(12))
    target: Mapped[Decimal] = mapped_column(ExactMoney())
    start_date: Mapped[date] = mapped_column(Date)
    deadline: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(12), default="ACTIVE")
    archived_date: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str] = mapped_column(String(2000), default="")
    __table_args__ = (
        CheckConstraint("mode IN ('MANUAL','ACCOUNT')", name="mode"),
        CheckConstraint("length(target) = 24 AND target NOT GLOB '*[^0-9]*'", name="target"),
        CheckConstraint("status IN ('ACTIVE','PAUSED','COMPLETED','ARCHIVED')", name="status"),
        CheckConstraint("deadline IS NULL OR deadline >= start_date", name="deadline"),
        CheckConstraint("length(trim(name)) > 0", name="name"),
        CheckConstraint("length(currency) = 3 AND currency NOT GLOB '*[^A-Z]*'", name="currency"),
    )


class GoalEntry(Record, Base):
    """Manual signed progress, or a dated replacement of one account allocation."""

    __tablename__ = "goal_entries"
    goal_id: Mapped[UUID] = mapped_column(ForeignKey("goals.id"), index=True)
    account_id: Mapped[UUID | None] = mapped_column(ForeignKey("financial_accounts.id"), index=True)
    effective_date: Mapped[date] = mapped_column(Date, index=True)
    amount: Mapped[Decimal] = mapped_column(ExactMoney())
    direction: Mapped[str] = mapped_column(String(3), default="IN")
    notes: Mapped[str] = mapped_column(String(500), default="")
    voided_at: Mapped[datetime | None] = mapped_column(UTCDateTime())
    void_reason: Mapped[str | None] = mapped_column(String(500))
    __table_args__ = (
        CheckConstraint("direction IN ('IN','OUT')", name="direction"),
        CheckConstraint("account_id IS NULL OR direction = 'IN'", name="allocation_direction"),
        CheckConstraint("length(amount) = 24 AND amount NOT GLOB '*[^0-9]*'", name="amount"),
        Index(
            "uq_goal_allocation_live_day",
            "goal_id",
            "account_id",
            "effective_date",
            unique=True,
            sqlite_where=text("voided_at IS NULL AND account_id IS NOT NULL"),
        ),
    )
