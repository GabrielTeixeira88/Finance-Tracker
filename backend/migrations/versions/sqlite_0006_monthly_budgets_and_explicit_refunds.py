"""monthly budgets and explicit refunds

Revision ID: sqlite_0006
Revises: sqlite_0005
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "sqlite_0006"
down_revision: str | None = "sqlite_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Additive schema; amounts retain the reviewed fixed-width ExactMoney encoding.
    op.create_table(
        "budget_groups",
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.CheckConstraint("length(trim(name)) > 0", name=op.f("ck_budget_groups_name")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_budget_groups")),
    )
    op.create_table(
        "budget_targets",
        sa.Column("category_id", sa.Uuid(), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "length(currency)=3 AND currency NOT GLOB '*[^A-Z]*'",
            name=op.f("ck_budget_targets_currency"),
        ),
        sa.ForeignKeyConstraint(
            ["category_id"],
            ["categories.id"],
            name=op.f("fk_budget_targets_category_id_categories"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_budget_targets")),
        sa.UniqueConstraint("category_id", "currency", name=op.f("uq_budget_targets_category_id")),
    )
    op.create_table(
        "budget_month_overrides",
        sa.Column("target_id", sa.Uuid(), nullable=False),
        sa.Column("month", sa.Date(), nullable=False),
        sa.Column("amount", sa.String(length=24), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("rollover_enabled", sa.Boolean(), nullable=False),
        sa.Column("group_id", sa.Uuid(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "strftime('%d', month) = '01'", name=op.f("ck_budget_month_overrides_month_start")
        ),
        sa.CheckConstraint(
            "typeof(amount)='text' AND length(amount)=24 AND amount NOT GLOB '*[^0-9]*'",
            name=op.f("ck_budget_month_overrides_amount"),
        ),
        sa.ForeignKeyConstraint(
            ["group_id"],
            ["budget_groups.id"],
            name=op.f("fk_budget_month_overrides_group_id_budget_groups"),
        ),
        sa.ForeignKeyConstraint(
            ["target_id"],
            ["budget_targets.id"],
            name=op.f("fk_budget_month_overrides_target_id_budget_targets"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_budget_month_overrides")),
        sa.UniqueConstraint("target_id", "month", name=op.f("uq_budget_month_overrides_target_id")),
    )
    op.create_table(
        "budget_versions",
        sa.Column("target_id", sa.Uuid(), nullable=False),
        sa.Column("month", sa.Date(), nullable=False),
        sa.Column("amount", sa.String(length=24), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("rollover_enabled", sa.Boolean(), nullable=False),
        sa.Column("group_id", sa.Uuid(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "strftime('%d', month) = '01'", name=op.f("ck_budget_versions_month_start")
        ),
        sa.CheckConstraint(
            "typeof(amount)='text' AND length(amount)=24 AND amount NOT GLOB '*[^0-9]*'",
            name=op.f("ck_budget_versions_amount"),
        ),
        sa.ForeignKeyConstraint(
            ["group_id"],
            ["budget_groups.id"],
            name=op.f("fk_budget_versions_group_id_budget_groups"),
        ),
        sa.ForeignKeyConstraint(
            ["target_id"],
            ["budget_targets.id"],
            name=op.f("fk_budget_versions_target_id_budget_targets"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_budget_versions")),
        sa.UniqueConstraint("target_id", "month", name=op.f("uq_budget_versions_target_id")),
    )
    op.create_table(
        "refund_links",
        sa.Column("refund_id", sa.Uuid(), nullable=False),
        sa.Column("purchase_id", sa.Uuid(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "refund_id <> purchase_id", name=op.f("ck_refund_links_different_entries")
        ),
        sa.ForeignKeyConstraint(
            ["purchase_id"],
            ["transactions.id"],
            name=op.f("fk_refund_links_purchase_id_transactions"),
        ),
        sa.ForeignKeyConstraint(
            ["refund_id"], ["transactions.id"], name=op.f("fk_refund_links_refund_id_transactions")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_refund_links")),
        sa.UniqueConstraint("refund_id", name=op.f("uq_refund_links_refund_id")),
    )
    op.create_index(
        op.f("ix_refund_links_purchase_id"), "refund_links", ["purchase_id"], unique=False
    )
    op.execute("""CREATE TRIGGER refund_insert_guard BEFORE INSERT ON refund_links
    BEGIN
      SELECT CASE WHEN NOT EXISTS (
        SELECT 1 FROM transactions r JOIN transactions p ON p.id=NEW.purchase_id
        WHERE r.id=NEW.refund_id AND r.transaction_type='INCOME'
        AND p.transaction_type='EXPENSE' AND r.deleted_at IS NULL AND p.deleted_at IS NULL
        AND r.currency=p.currency AND r.amount<=p.amount
        AND r.transaction_date>=p.transaction_date
      ) THEN RAISE(ABORT, 'Invalid refund relationship') END;
    END""")
    op.execute("""CREATE TRIGGER refund_link_immutable BEFORE UPDATE ON refund_links
    BEGIN SELECT RAISE(ABORT, 'Unlink refund before changing its relationship'); END""")
    op.execute("""CREATE TRIGGER refund_financial_guard BEFORE UPDATE ON transactions
    WHEN EXISTS (SELECT 1 FROM refund_links WHERE refund_id=OLD.id OR purchase_id=OLD.id)
    AND (NEW.amount<>OLD.amount OR NEW.transaction_type<>OLD.transaction_type
      OR NEW.account_id<>OLD.account_id OR NEW.currency<>OLD.currency
      OR NEW.transaction_date<>OLD.transaction_date OR NEW.deleted_at IS NOT OLD.deleted_at)
    BEGIN SELECT RAISE(ABORT, 'Unlink refunds before financial correction'); END""")


def downgrade() -> None:
    raise RuntimeError("Budget history and refund links cannot be destructively downgraded")
