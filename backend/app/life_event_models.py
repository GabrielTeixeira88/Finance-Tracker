"""Life Events are reporting metadata; they never own ledger postings."""

from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base, Record
from app.storage_types import ExactMoney


class LifeEvent(Record, Base):
    __tablename__ = "life_events"
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(String(1000), default="")
    event_type: Mapped[str] = mapped_column(String(24))
    start_date: Mapped[date] = mapped_column(index=True)
    end_date: Mapped[date]
    currency: Mapped[str] = mapped_column(String(3))
    color: Mapped[str] = mapped_column(String(12))
    icon: Mapped[str] = mapped_column(String(24))
    planned_budget: Mapped[Decimal | None] = mapped_column(ExactMoney())
    __table_args__ = (
        CheckConstraint("start_date <= end_date", name="dates"),
        CheckConstraint(
            "planned_budget IS NULL OR (typeof(planned_budget)='text' "
            "AND length(planned_budget)=24 AND planned_budget NOT GLOB '*[^0-9]*')",
            name="planned_budget",
        ),
    )


class LifeEventLink(Record, Base):
    __tablename__ = "life_event_links"
    event_id: Mapped[UUID] = mapped_column(ForeignKey("life_events.id"), index=True)
    transaction_id: Mapped[UUID] = mapped_column(ForeignKey("transactions.id"))
    __table_args__ = (UniqueConstraint("transaction_id"),)
