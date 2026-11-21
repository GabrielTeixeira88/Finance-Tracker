"""Non-posting planning metadata and dated lifecycle/funding epochs."""

from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy import CheckConstraint, Date, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models import Record
from app.storage_types import ExactMoney


class GoalPlan(Record, Base):
    __tablename__ = "goal_plans"
    goal_id: Mapped[UUID] = mapped_column(ForeignKey("goals.id"), unique=True)
    goal_type: Mapped[str] = mapped_column(String(24), default="custom_save_up")
    monthly: Mapped[Decimal] = mapped_column(ExactMoney(), default=Decimal(0))
    __table_args__ = (
        CheckConstraint(
            "goal_type IN ('education','home','car','wedding','custom_save_up')", name="type"
        ),
        CheckConstraint("length(monthly) = 24 AND monthly NOT GLOB '*[^0-9]*'", name="monthly"),
    )


class GoalLifecycle(Record, Base):
    __tablename__ = "goal_lifecycle"
    goal_id: Mapped[UUID] = mapped_column(ForeignKey("goals.id"), index=True)
    sequence: Mapped[int] = mapped_column(Integer)
    effective_date: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(12))
    __table_args__ = (
        UniqueConstraint("goal_id", "sequence"),
        CheckConstraint(
            "status IN ('ACTIVE','PAUSED','COMPLETED','ARCHIVED','DELETED')", name="status"
        ),
    )


class GoalInvestmentFunding(Record, Base):
    """New reservation epochs; original exclusive reservations remain immutable."""

    __tablename__ = "goal_investment_funding"
    goal_id: Mapped[UUID] = mapped_column(ForeignKey("goals.id"), index=True)
    account_id: Mapped[UUID] = mapped_column(ForeignKey("financial_accounts.id"), index=True)
    effective_date: Mapped[date] = mapped_column(Date)
    funding_epoch: Mapped[int] = mapped_column(Integer)
    __table_args__ = (UniqueConstraint("goal_id", "funding_epoch"),)


class GoalEntryEpoch(Base):
    """Append-only association; original contribution/allocation rows stay unchanged."""

    __tablename__ = "goal_entry_epochs"
    entry_id: Mapped[UUID] = mapped_column(ForeignKey("goal_entries.id"), primary_key=True)
    funding_epoch: Mapped[int] = mapped_column(Integer)
    __table_args__ = (CheckConstraint("funding_epoch > 0", name="positive_epoch"),)
