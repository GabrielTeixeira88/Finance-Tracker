"""Add exact saved goal plans and non-destructive lifecycle/funding history."""

from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision = "sqlite_0019"
down_revision = "sqlite_0018"
branch_labels = depends_on = None


def record_columns():
    return [
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    ]


def upgrade():
    op.create_table(
        "goal_plans",
        *record_columns(),
        sa.Column("goal_id", sa.Uuid(), sa.ForeignKey("goals.id"), nullable=False, unique=True),
        sa.Column("goal_type", sa.String(24), nullable=False),
        sa.Column("monthly", sa.String(24), nullable=False),
        sa.CheckConstraint(
            "goal_type IN ('education','home','car','wedding','custom_save_up')", name="type"
        ),
        sa.CheckConstraint("length(monthly) = 24 AND monthly NOT GLOB '*[^0-9]*'", name="monthly"),
    )
    op.create_table(
        "goal_lifecycle",
        *record_columns(),
        sa.Column("goal_id", sa.Uuid(), sa.ForeignKey("goals.id"), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("effective_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(12), nullable=False),
        sa.UniqueConstraint("goal_id", "sequence"),
        sa.CheckConstraint(
            "status IN ('ACTIVE','PAUSED','COMPLETED','ARCHIVED','DELETED')", name="status"
        ),
    )
    op.create_index("ix_goal_lifecycle_goal_id", "goal_lifecycle", ["goal_id"])
    op.create_table(
        "goal_investment_funding",
        *record_columns(),
        sa.Column("goal_id", sa.Uuid(), sa.ForeignKey("goals.id"), nullable=False),
        sa.Column("account_id", sa.Uuid(), sa.ForeignKey("financial_accounts.id"), nullable=False),
        sa.Column("effective_date", sa.Date(), nullable=False),
        sa.Column("funding_epoch", sa.Integer(), nullable=False),
        sa.UniqueConstraint("goal_id", "funding_epoch"),
    )
    op.create_index("ix_goal_investment_funding_goal_id", "goal_investment_funding", ["goal_id"])
    op.create_index(
        "ix_goal_investment_funding_account_id", "goal_investment_funding", ["account_id"]
    )
    op.create_table(
        "goal_entry_epochs",
        sa.Column("entry_id", sa.Uuid(), sa.ForeignKey("goal_entries.id"), primary_key=True),
        sa.Column("funding_epoch", sa.Integer(), nullable=False),
        sa.CheckConstraint("funding_epoch > 0", name="positive_epoch"),
    )
    connection = op.get_bind()
    for goal in connection.execute(
        sa.text("SELECT id, archived_date FROM goals WHERE archived_date IS NOT NULL")
    ):
        connection.execute(
            sa.text(
                "INSERT INTO goal_lifecycle (id, goal_id, sequence, effective_date, status) "
                "VALUES (:id, :goal, 1, :day, 'ARCHIVED')"
            ),
            {"id": uuid4().hex, "goal": goal.id, "day": goal.archived_date},
        )


def downgrade():
    raise RuntimeError("Retain goal planning and funding audit; restore a reviewed backup")
