"""Life Event metadata and unique purchase associations; no ledger rewrite.

Revision ID: sqlite_0015
Revises: sqlite_0014
"""

import sqlalchemy as sa
from alembic import op

revision = "sqlite_0015"
down_revision = "sqlite_0014"
branch_labels = depends_on = None


def record_columns():
    return [
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
    ]


def upgrade():
    op.create_table(
        "life_events",
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.String(1000), nullable=False),
        sa.Column("event_type", sa.String(24), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("color", sa.String(12), nullable=False),
        sa.Column("icon", sa.String(24), nullable=False),
        sa.Column("planned_budget", sa.String(24), nullable=True),
        *record_columns(),
        sa.CheckConstraint("start_date <= end_date", name=op.f("ck_life_events_dates")),
        sa.CheckConstraint(
            "planned_budget IS NULL OR (typeof(planned_budget)='text' "
            "AND length(planned_budget)=24 AND planned_budget NOT GLOB '*[^0-9]*')",
            name=op.f("ck_life_events_planned_budget"),
        ),
    )
    op.create_index(op.f("ix_life_events_start_date"), "life_events", ["start_date"])
    op.create_table(
        "life_event_links",
        sa.Column("event_id", sa.Uuid(), nullable=False),
        sa.Column("transaction_id", sa.Uuid(), nullable=False),
        *record_columns(),
        sa.ForeignKeyConstraint(["event_id"], ["life_events.id"]),
        sa.ForeignKeyConstraint(["transaction_id"], ["transactions.id"]),
        sa.UniqueConstraint("transaction_id"),
    )
    op.create_index(op.f("ix_life_event_links_event_id"), "life_event_links", ["event_id"])


def downgrade():
    raise RuntimeError(
        "Preserve Life Event associations; review an explicit data export before downgrade"
    )
