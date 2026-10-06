import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Numeric,
    String,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Record:
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class FinancialAccount(Record, Base):
    __tablename__ = "financial_accounts"
    name: Mapped[str] = mapped_column(String(120))
    type: Mapped[str] = mapped_column(String(20))
    currency: Mapped[str] = mapped_column(String(3))
    institution: Mapped[str | None] = mapped_column(String(120))
    active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=text("true"))
    __table_args__ = (
        UniqueConstraint("id", "currency"),
        CheckConstraint("length(trim(name)) > 0", name="nonempty_name"),
        CheckConstraint("currency ~ '^[A-Z]{3}$'", name="currency_code"),
        CheckConstraint(
            "type IN ('CHECKING','SAVINGS','CASH','CREDIT_CARD','INVESTMENT')", name="type"
        ),
    )


class Category(Record, Base):
    __tablename__ = "categories"
    name: Mapped[str] = mapped_column(String(120))
    __table_args__ = (
        CheckConstraint("length(trim(name)) > 0", name="nonempty_name"),
        # Match PostgreSQL's canonical expression so Alembic detects no false drift.
        Index("uq_categories_name_normalized", text("lower(TRIM(BOTH FROM name))"), unique=True),
    )


class Transfer(Record, Base):
    __tablename__ = "transfers"
    source_account_id: Mapped[uuid.UUID]
    destination_account_id: Mapped[uuid.UUID]
    amount: Mapped[Decimal] = mapped_column(Numeric(24, 6))
    currency: Mapped[str] = mapped_column(String(3))
    transaction_date: Mapped[date] = mapped_column(Date)
    description: Mapped[str] = mapped_column(String(500), default="Transfer")
    __table_args__ = (
        ForeignKeyConstraint(
            ["source_account_id", "currency"],
            ["financial_accounts.id", "financial_accounts.currency"],
        ),
        ForeignKeyConstraint(
            ["destination_account_id", "currency"],
            ["financial_accounts.id", "financial_accounts.currency"],
        ),
        CheckConstraint("source_account_id <> destination_account_id", name="different_accounts"),
        CheckConstraint("amount > 0 AND amount < 'Infinity'::numeric", name="positive_amount"),
        Index("ix_transfers_source", "source_account_id"),
        Index("ix_transfers_destination", "destination_account_id"),
    )


class Transaction(Record, Base):
    __tablename__ = "transactions"
    account_id: Mapped[uuid.UUID]
    transaction_type: Mapped[str] = mapped_column(String(20))
    direction: Mapped[str] = mapped_column(String(3))
    amount: Mapped[Decimal] = mapped_column(Numeric(24, 6))
    currency: Mapped[str] = mapped_column(String(3))
    transaction_date: Mapped[date] = mapped_column(Date)
    description: Mapped[str] = mapped_column(String(500))
    merchant: Mapped[str | None] = mapped_column(String(120))
    category_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("categories.id"))
    transfer_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("transfers.id"))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    __table_args__ = (
        ForeignKeyConstraint(
            ["account_id", "currency"], ["financial_accounts.id", "financial_accounts.currency"]
        ),
        CheckConstraint("amount > 0 AND amount < 'Infinity'::numeric", name="positive_amount"),
        CheckConstraint("length(trim(description)) > 0", name="description"),
        CheckConstraint("direction IN ('IN','OUT')", name="direction"),
        CheckConstraint(
            "(transaction_type = 'INCOME' AND direction = 'IN') OR "
            "(transaction_type = 'EXPENSE' AND direction = 'OUT') OR "
            "transaction_type IN ('TRANSFER','OPENING_BALANCE')",
            name="type_direction",
        ),
        CheckConstraint(
            "(transaction_type = 'TRANSFER') = (transfer_id IS NOT NULL)", name="transfer_link"
        ),
        CheckConstraint(
            "transaction_type IN ('INCOME','EXPENSE') OR "
            "(category_id IS NULL AND merchant IS NULL AND deleted_at IS NULL)",
            name="special_fields",
        ),
        UniqueConstraint("transfer_id", "direction"),
        Index(
            "uq_account_opening",
            "account_id",
            unique=True,
            postgresql_where=text("transaction_type = 'OPENING_BALANCE'"),
        ),
        Index("ix_transactions_account_date", "account_id", "transaction_date"),
        Index("ix_transactions_type_date", "transaction_type", "transaction_date"),
        Index("ix_transactions_category", "category_id"),
        Index("ix_transactions_date", "transaction_date"),
    )
