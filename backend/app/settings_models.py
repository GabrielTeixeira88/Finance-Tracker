"""Local organizational metadata; never a second financial balance or ownership ledger."""

import uuid

from sqlalchemy import CheckConstraint, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base, Record


class AccountGroup(Record, Base):
    __tablename__ = "account_groups"
    name: Mapped[str] = mapped_column(String(120))
    normalized_name: Mapped[str] = mapped_column(String(360), unique=True)
    description: Mapped[str] = mapped_column(String(500), default="")
    __table_args__ = (CheckConstraint("length(trim(name)) > 0", name="nonempty_name"),)


class AccountGroupMember(Base):
    __tablename__ = "account_group_members"
    group_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("account_groups.id"), primary_key=True)
    account_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("financial_accounts.id"), primary_key=True
    )
