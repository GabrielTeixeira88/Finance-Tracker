"""gmail ingestion operational state and source identity

Revision ID: sqlite_0010
Revises: sqlite_0009
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "sqlite_0010"
down_revision: str | None = "sqlite_0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "gmail_sync_runs",
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("mode", sa.String(length=32), nullable=False),
        sa.Column("processed", sa.Integer(), nullable=False),
        sa.Column("duplicates", sa.Integer(), nullable=False),
        sa.Column("cancel_requested", sa.Boolean(), nullable=False),
        sa.Column("error", sa.String(length=100), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.PrimaryKeyConstraint("id", name=op.f("pk_gmail_sync_runs")),
    )
    op.create_table(
        "gmail_connections",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("mailbox", sa.String(length=254), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("label_id", sa.String(length=200), nullable=True),
        sa.Column("account_id", sa.Uuid(), nullable=True),
        sa.Column("senders", sa.JSON(), nullable=False),
        sa.Column("polling_minutes", sa.Integer(), nullable=False),
        sa.Column("paused", sa.Boolean(), nullable=False),
        sa.Column("backfill_start", sa.Date(), nullable=True),
        sa.Column("backfill_end", sa.Date(), nullable=True),
        sa.Column("history_id", sa.String(length=100), nullable=True),
        sa.Column("active_run", sa.String(length=36), nullable=True),
        sa.Column("lease_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_attempt", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_success", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error", sa.String(length=100), nullable=True),
        sa.CheckConstraint("id = 1", name=op.f("ck_gmail_connections_singleton")),
        sa.CheckConstraint(
            "polling_minutes IN (0,1,5,15)", name=op.f("ck_gmail_connections_polling")
        ),
        sa.ForeignKeyConstraint(
            ["account_id"],
            ["financial_accounts.id"],
            name=op.f("fk_gmail_connections_account_id_financial_accounts"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_gmail_connections")),
    )
    op.create_table(
        "gmail_message_claims",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("source_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["source_id"],
            ["source_records.id"],
            name="fk_gmail_message_claims_source_id_source_records",
        ),
        sa.UniqueConstraint("source_id", name="uq_gmail_message_claims_source_id"),
    )


def downgrade() -> None:
    op.drop_table("gmail_message_claims")
    op.drop_table("gmail_connections")
    op.drop_table("gmail_sync_runs")
