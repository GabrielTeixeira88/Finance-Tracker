"""Normalized payees and review metadata; preserve every existing ledger row."""

import sqlalchemy as sa
from alembic import op

revision = "sqlite_0003"
down_revision = "sqlite_0002"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "payees",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("normalized_name", sa.String(360), nullable=False, unique=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.CheckConstraint("length(trim(name)) > 0", name="nonempty_name"),
    )
    # Native additive DDL avoids rebuilding a table with cyclic deferred FKs and triggers.
    op.execute("""ALTER TABLE transactions ADD COLUMN payee_id CHAR(32)
        CONSTRAINT fk_transactions_payee_id_payees REFERENCES payees(id)
        CONSTRAINT ck_transactions_payee_type
        CHECK (payee_id IS NULL OR transaction_type IN ('INCOME','EXPENSE'))""")
    op.execute("""ALTER TABLE transactions ADD COLUMN review_status VARCHAR(20)
        NOT NULL DEFAULT 'REVIEWED' CONSTRAINT ck_transactions_review_status
        CHECK (review_status IN ('NEEDS_REVIEW','REVIEWED'))""")
    op.create_index("ix_transactions_payee", "transactions", ["payee_id"])
    op.create_index(
        "ix_transactions_review_date", "transactions", ["review_status", "transaction_date"]
    )
    op.execute("DROP TRIGGER protect_transaction_update")
    # Special entries permit review only. All original posting fields remain protected.
    op.execute("""CREATE TRIGGER protect_transaction_update BEFORE UPDATE ON transactions
        WHEN NEW.account_id IS NOT OLD.account_id OR NEW.currency IS NOT OLD.currency
          OR NEW.id IS NOT OLD.id OR NEW.created_at IS NOT OLD.created_at
          OR (OLD.transaction_type IN ('INCOME','EXPENSE')
              AND NEW.transaction_type NOT IN ('INCOME','EXPENSE'))
          OR (OLD.transaction_type IN ('TRANSFER','OPENING_BALANCE') AND (
              NEW.transaction_type IS NOT OLD.transaction_type
              OR NEW.direction IS NOT OLD.direction OR NEW.amount IS NOT OLD.amount
              OR NEW.transaction_date IS NOT OLD.transaction_date
              OR NEW.description IS NOT OLD.description
              OR NEW.merchant IS NOT OLD.merchant OR NEW.category_id IS NOT OLD.category_id
              OR NEW.payee_id IS NOT OLD.payee_id OR NEW.transfer_id IS NOT OLD.transfer_id
              OR NEW.deleted_at IS NOT OLD.deleted_at))
        BEGIN SELECT RAISE(ABORT, 'Preserve financial history'); END""")


def downgrade():
    raise RuntimeError("Destructive downgrades require a separately reviewed migration")
