import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Computed,
    Date,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from app.database import Base
from app.storage_types import ExactMoney, UTCDateTime


class DemoFixture(Base):
    """Explicit preview illustrations, never part of the financial ledger."""

    __tablename__ = "demo_fixtures"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    payload: Mapped[dict] = mapped_column(JSON)


class Record:
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime(), server_default=func.now(), onupdate=func.now()
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
        CheckConstraint(
            "length(currency) = 3 AND currency NOT GLOB '*[^A-Z]*'", name="currency_code"
        ),
        CheckConstraint(
            "type IN ('CHECKING','SAVINGS','CASH','CREDIT_CARD','INVESTMENT')", name="type"
        ),
    )


class Category(Record, Base):
    __tablename__ = "categories"
    name: Mapped[str] = mapped_column(String(120))
    normalized_name: Mapped[str] = mapped_column(
        String(120), Computed("lower(trim(name))", persisted=True)
    )
    __table_args__ = (
        CheckConstraint("length(trim(name)) > 0", name="nonempty_name"),
        Index("uq_categories_name_normalized", "normalized_name", unique=True),
    )


class Payee(Record, Base):
    __tablename__ = "payees"
    name: Mapped[str] = mapped_column(String(120))
    normalized_name: Mapped[str] = mapped_column(String(360), unique=True)
    __table_args__ = (CheckConstraint("length(trim(name)) > 0", name="nonempty_name"),)

    @validates("name")
    def normalize_name(self, _key, value):
        value = " ".join(value.split())
        self.normalized_name = value.casefold()
        return value


class Transfer(Record, Base):
    __tablename__ = "transfers"
    source_account_id: Mapped[uuid.UUID]
    destination_account_id: Mapped[uuid.UUID]
    source_entry_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("transactions.id", deferrable=True, initially="DEFERRED", use_alter=True),
        default=uuid.uuid4,
    )
    destination_entry_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("transactions.id", deferrable=True, initially="DEFERRED", use_alter=True),
        default=uuid.uuid4,
    )
    amount: Mapped[Decimal] = mapped_column(ExactMoney())
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
        CheckConstraint("source_entry_id <> destination_entry_id", name="different_entries"),
        CheckConstraint(
            "typeof(amount) = 'text' AND length(amount) = 24 AND amount NOT GLOB '*[^0-9]*' "
            "AND amount > '000000000000000000000000'",
            name="positive_amount",
        ),
        Index("ix_transfers_source", "source_account_id"),
        Index("ix_transfers_destination", "destination_account_id"),
    )


class Transaction(Record, Base):
    __tablename__ = "transactions"
    account_id: Mapped[uuid.UUID]
    transaction_type: Mapped[str] = mapped_column(String(20))
    direction: Mapped[str] = mapped_column(String(3))
    amount: Mapped[Decimal] = mapped_column(ExactMoney())
    currency: Mapped[str] = mapped_column(String(3))
    transaction_date: Mapped[date] = mapped_column(Date)
    description: Mapped[str] = mapped_column(String(500))
    merchant: Mapped[str | None] = mapped_column(String(120))
    category_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("categories.id"))
    payee_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("payees.id"))
    payee: Mapped[Payee | None] = relationship(lazy="selectin")
    review_status: Mapped[str] = mapped_column(
        String(20), default="REVIEWED", server_default="REVIEWED"
    )
    transfer_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("transfers.id"))
    deleted_at: Mapped[datetime | None] = mapped_column(UTCDateTime())
    manual_fields: Mapped[list] = mapped_column(JSON, default=list, server_default="[]")
    rule_assignments: Mapped[dict] = mapped_column(JSON, default=dict, server_default="{}")
    __table_args__ = (
        CheckConstraint("review_status IN ('NEEDS_REVIEW','REVIEWED')", name="review_status"),
        CheckConstraint(
            "payee_id IS NULL OR transaction_type IN ('INCOME','EXPENSE')", name="payee_type"
        ),
        ForeignKeyConstraint(
            ["account_id", "currency"], ["financial_accounts.id", "financial_accounts.currency"]
        ),
        CheckConstraint(
            "typeof(amount) = 'text' AND length(amount) = 24 AND amount NOT GLOB '*[^0-9]*' "
            "AND amount > '000000000000000000000000'",
            name="positive_amount",
        ),
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
            sqlite_where=text("transaction_type = 'OPENING_BALANCE'"),
        ),
        Index("ix_transactions_account_date", "account_id", "transaction_date"),
        Index("ix_transactions_type_date", "transaction_type", "transaction_date"),
        Index("ix_transactions_category", "category_id"),
        Index("ix_transactions_date", "transaction_date"),
        Index("ix_transactions_payee", "payee_id"),
        Index("ix_transactions_review_date", "review_status", "transaction_date"),
    )


class TransactionRule(Record, Base):
    __tablename__ = "transaction_rules"
    name: Mapped[str] = mapped_column(String(120))
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    priority: Mapped[int] = mapped_column(Integer, default=100)
    match_mode: Mapped[str] = mapped_column(String(3))
    conditions: Mapped[list] = mapped_column(JSON)
    actions: Mapped[dict] = mapped_column(JSON)
    __table_args__ = (CheckConstraint("match_mode IN ('ALL','ANY')", name="match_mode"),)


class RuleApplication(Record, Base):
    __tablename__ = "rule_applications"
    transaction_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("transactions.id"), index=True)
    # Historical identity/name remain readable after the editable rule is deleted.
    rule_id: Mapped[str] = mapped_column(String(36))
    rule_name: Mapped[str] = mapped_column(String(120))
    changes: Mapped[dict] = mapped_column(JSON)


class TransactionCorrection(Record, Base):
    __tablename__ = "transaction_corrections"
    transaction_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("transactions.id"), index=True)
    source: Mapped[str] = mapped_column(String(12))
    context: Mapped[dict] = mapped_column(JSON)
    changes: Mapped[dict] = mapped_column(JSON)
    __table_args__ = (CheckConstraint("source IN ('USER','DEMO_USER')", name="source"),)


class RuleSuggestion(Record, Base):
    __tablename__ = "rule_suggestions"
    fingerprint: Mapped[str] = mapped_column(String(64), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    conditions: Mapped[list] = mapped_column(JSON)
    actions: Mapped[dict] = mapped_column(JSON)
    support_count: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(12), default="PENDING")
    __table_args__ = (
        CheckConstraint("status IN ('PENDING','ACCEPTED','DISMISSED','STALE')", name="status"),
    )


class Schedule(Record, Base):
    __tablename__ = "schedules"
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(String(500))
    transaction_type: Mapped[str] = mapped_column(String(20))
    account_id: Mapped[uuid.UUID]
    currency: Mapped[str] = mapped_column(String(3))
    payee_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("payees.id"))
    category_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("categories.id"))
    amount: Mapped[Decimal] = mapped_column(ExactMoney())
    amount_is_approximate: Mapped[bool] = mapped_column(Boolean, default=False)
    amount_tolerance: Mapped[Decimal] = mapped_column(ExactMoney(), default=Decimal("0"))
    frequency: Mapped[str] = mapped_column(String(12))
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    __table_args__ = (
        ForeignKeyConstraint(
            ["account_id", "currency"], ["financial_accounts.id", "financial_accounts.currency"]
        ),
        CheckConstraint("transaction_type IN ('INCOME','EXPENSE')", name="type"),
        CheckConstraint(
            "frequency IN ('ONCE','WEEKLY','BIWEEKLY','MONTHLY','YEARLY')", name="frequency"
        ),
        CheckConstraint("end_date IS NULL OR end_date >= start_date", name="dates"),
        CheckConstraint(
            "typeof(amount)='text' AND length(amount)=24 "
            "AND amount NOT GLOB '*[^0-9]*' "
            "AND amount > '000000000000000000000000'",
            name="amount",
        ),
        CheckConstraint(
            "typeof(amount_tolerance)='text' AND length(amount_tolerance)=24 "
            "AND amount_tolerance NOT GLOB '*[^0-9]*'",
            name="tolerance",
        ),
    )


class ScheduleCompletion(Record, Base):
    __tablename__ = "schedule_completions"
    schedule_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("schedules.id"))
    due_date: Mapped[date] = mapped_column(Date)
    transaction_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("transactions.id"), unique=True)
    expected: Mapped[dict] = mapped_column(JSON)
    __table_args__ = (UniqueConstraint("schedule_id", "due_date"),)


class ImportProfile(Record, Base):
    __tablename__ = "import_profiles"
    name: Mapped[str] = mapped_column(String(120))
    configuration: Mapped[dict] = mapped_column(JSON)
    default_account_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("financial_accounts.id")
    )


class ImportBatch(Record, Base):
    __tablename__ = "import_batches"
    source_type: Mapped[str] = mapped_column(String(32))
    filename: Mapped[str] = mapped_column(String(200))
    file_hash: Mapped[str] = mapped_column(String(64))
    account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("financial_accounts.id"), index=True)
    status: Mapped[str] = mapped_column(String(16), default="DRAFT")
    configuration: Mapped[dict] = mapped_column(JSON)
    source_context: Mapped[dict] = mapped_column(JSON)
    counts: Mapped[dict] = mapped_column(JSON, default=dict)
    completed_at: Mapped[datetime | None] = mapped_column(UTCDateTime())
    __table_args__ = (CheckConstraint("status IN ('DRAFT','COMPLETED')", name="status"),)


class SourceRecord(Record, Base):
    __tablename__ = "source_records"
    import_batch_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("import_batches.id"), index=True)
    row_number: Mapped[int] = mapped_column(Integer)
    source_type: Mapped[str] = mapped_column(String(32))
    external_id: Mapped[str | None] = mapped_column(String(255))
    source_fingerprint: Mapped[str] = mapped_column(String(64), index=True)
    external_fingerprint: Mapped[str | None] = mapped_column(String(64), index=True)
    # Claims are set only on successful posting/linking. Re-import observations retain
    # their own provenance without claiming the same economic event a second time.
    file_claim: Mapped[str | None] = mapped_column(String(64), unique=True)
    external_claim: Mapped[str | None] = mapped_column(String(64), unique=True)
    raw_data: Mapped[dict] = mapped_column(JSON)
    normalized_data: Mapped[dict] = mapped_column(JSON)
    validation_errors: Mapped[list] = mapped_column(JSON)
    decision: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(20), default="PENDING")
    transaction_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("transactions.id"), index=True
    )
    __table_args__ = (
        UniqueConstraint("import_batch_id", "row_number"),
        CheckConstraint("row_number > 0", name="row_number"),
        CheckConstraint(
            "status IN ('PENDING','IMPORTED','LINKED','DUPLICATE','SKIPPED','INVALID')",
            name="status",
        ),
        CheckConstraint(
            "(file_claim IS NULL AND external_claim IS NULL) OR transaction_id IS NOT NULL",
            name="claim_link",
        ),
    )


class BudgetGroup(Record, Base):
    __tablename__ = "budget_groups"
    name: Mapped[str] = mapped_column(String(120))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    __table_args__ = (CheckConstraint("length(trim(name)) > 0", name="name"),)


class BudgetTarget(Record, Base):
    __tablename__ = "budget_targets"
    category_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("categories.id"))
    currency: Mapped[str] = mapped_column(String(3))
    __table_args__ = (
        UniqueConstraint("category_id", "currency"),
        CheckConstraint("length(currency)=3 AND currency NOT GLOB '*[^A-Z]*'", name="currency"),
    )


class BudgetConfiguration:
    target_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("budget_targets.id"))
    month: Mapped[date] = mapped_column(Date)
    amount: Mapped[Decimal] = mapped_column(ExactMoney())
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    rollover_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    group_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("budget_groups.id"))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


def budget_constraints():
    return (
        UniqueConstraint("target_id", "month"),
        CheckConstraint("strftime('%d', month) = '01'", name="month_start"),
        CheckConstraint(
            "typeof(amount)='text' AND length(amount)=24 AND amount NOT GLOB '*[^0-9]*'",
            name="amount",
        ),
    )


class BudgetVersion(BudgetConfiguration, Record, Base):
    __tablename__ = "budget_versions"
    __table_args__ = budget_constraints()


class BudgetMonthOverride(BudgetConfiguration, Record, Base):
    __tablename__ = "budget_month_overrides"
    __table_args__ = budget_constraints()


class RefundLink(Record, Base):
    __tablename__ = "refund_links"
    refund_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("transactions.id"), unique=True)
    purchase_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("transactions.id"), index=True)
    __table_args__ = (CheckConstraint("refund_id <> purchase_id", name="different_entries"),)
