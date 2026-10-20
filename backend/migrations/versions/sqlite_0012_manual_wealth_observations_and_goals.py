"""manual wealth observations and goals

Revision ID: sqlite_0012
Revises: sqlite_0011
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "sqlite_0012"
down_revision: str | None = "sqlite_0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "goals",
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("mode", sa.String(length=12), nullable=False),
        sa.Column("target", sa.String(length=24), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("deadline", sa.Date(), nullable=True),
        sa.Column("status", sa.String(length=12), nullable=False),
        sa.Column("archived_date", sa.Date(), nullable=True),
        sa.Column("notes", sa.String(length=2000), nullable=False),
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
            "length(currency) = 3 AND currency NOT GLOB '*[^A-Z]*'", name=op.f("ck_goals_currency")
        ),
        sa.CheckConstraint("mode IN ('MANUAL','ACCOUNT')", name=op.f("ck_goals_mode")),
        sa.CheckConstraint(
            "status IN ('ACTIVE','PAUSED','COMPLETED','ARCHIVED')", name=op.f("ck_goals_status")
        ),
        sa.CheckConstraint(
            "deadline IS NULL OR deadline >= start_date", name=op.f("ck_goals_deadline")
        ),
        sa.CheckConstraint("length(trim(name)) > 0", name=op.f("ck_goals_name")),
        sa.CheckConstraint(
            "length(target) = 24 AND target NOT GLOB '*[^0-9]*'", name=op.f("ck_goals_target")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_goals")),
    )
    op.create_table(
        "manual_positions",
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("kind", sa.String(length=12), nullable=False),
        sa.Column("category", sa.String(length=60), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("liquidity", sa.String(length=12), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("acquisition_cost", sa.String(length=24), nullable=True),
        sa.Column("disposal_proceeds", sa.String(length=24), nullable=True),
        sa.Column("associated_asset_id", sa.Uuid(), nullable=True),
        sa.Column("notes", sa.String(length=2000), nullable=False),
        sa.Column("terms", sa.String(length=1000), nullable=False),
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
        sa.CheckConstraint("kind IN ('ASSET','LIABILITY')", name=op.f("ck_manual_positions_kind")),
        sa.CheckConstraint(
            "length(currency) = 3 AND currency NOT GLOB '*[^A-Z]*'",
            name=op.f("ck_manual_positions_currency"),
        ),
        sa.CheckConstraint(
            "liquidity IN ('LIQUID','MARKETABLE','ILLIQUID','UNKNOWN')",
            name=op.f("ck_manual_positions_liquidity"),
        ),
        sa.CheckConstraint(
            "associated_asset_id IS NULL OR associated_asset_id != id",
            name=op.f("ck_manual_positions_association"),
        ),
        sa.CheckConstraint(
            "end_date IS NULL OR end_date >= start_date", name=op.f("ck_manual_positions_dates")
        ),
        sa.CheckConstraint("length(trim(name)) > 0", name=op.f("ck_manual_positions_name")),
        sa.ForeignKeyConstraint(
            ["associated_asset_id"],
            ["manual_positions.id"],
            name=op.f("fk_manual_positions_associated_asset_id_manual_positions"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_manual_positions")),
    )
    op.create_table(
        "goal_entries",
        sa.Column("goal_id", sa.Uuid(), nullable=False),
        sa.Column("account_id", sa.Uuid(), nullable=True),
        sa.Column("effective_date", sa.Date(), nullable=False),
        sa.Column("amount", sa.String(length=24), nullable=False),
        sa.Column("direction", sa.String(length=3), nullable=False),
        sa.Column("notes", sa.String(length=500), nullable=False),
        sa.Column("voided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("void_reason", sa.String(length=500), nullable=True),
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
            "account_id IS NULL OR direction = 'IN'",
            name=op.f("ck_goal_entries_allocation_direction"),
        ),
        sa.CheckConstraint("direction IN ('IN','OUT')", name=op.f("ck_goal_entries_direction")),
        sa.CheckConstraint(
            "length(amount) = 24 AND amount NOT GLOB '*[^0-9]*'",
            name=op.f("ck_goal_entries_amount"),
        ),
        sa.ForeignKeyConstraint(
            ["account_id"],
            ["financial_accounts.id"],
            name=op.f("fk_goal_entries_account_id_financial_accounts"),
        ),
        sa.ForeignKeyConstraint(
            ["goal_id"], ["goals.id"], name=op.f("fk_goal_entries_goal_id_goals")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_goal_entries")),
    )
    op.create_index(
        op.f("ix_goal_entries_account_id"), "goal_entries", ["account_id"], unique=False
    )
    op.create_index(
        op.f("ix_goal_entries_effective_date"), "goal_entries", ["effective_date"], unique=False
    )
    op.create_index(op.f("ix_goal_entries_goal_id"), "goal_entries", ["goal_id"], unique=False)
    op.create_table(
        "position_observations",
        sa.Column("position_id", sa.Uuid(), nullable=False),
        sa.Column("effective_date", sa.Date(), nullable=False),
        sa.Column("amount", sa.String(length=24), nullable=False),
        sa.Column("notes", sa.String(length=500), nullable=False),
        sa.Column("voided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("void_reason", sa.String(length=500), nullable=True),
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
            "length(amount) = 24 AND amount NOT GLOB '*[^0-9]*'",
            name=op.f("ck_position_observations_amount"),
        ),
        sa.ForeignKeyConstraint(
            ["position_id"],
            ["manual_positions.id"],
            name=op.f("fk_position_observations_position_id_manual_positions"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_position_observations")),
    )
    op.create_index(
        op.f("ix_position_observations_effective_date"),
        "position_observations",
        ["effective_date"],
        unique=False,
    )
    op.create_index(
        op.f("ix_position_observations_position_id"),
        "position_observations",
        ["position_id"],
        unique=False,
    )

    op.create_index(
        "uq_position_observation_live_day",
        "position_observations",
        ["position_id", "effective_date"],
        unique=True,
        sqlite_where=sa.text("voided_at IS NULL"),
    )
    op.create_index(
        "uq_goal_allocation_live_day",
        "goal_entries",
        ["goal_id", "account_id", "effective_date"],
        unique=True,
        sqlite_where=sa.text("voided_at IS NULL AND account_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_goal_allocation_live_day", table_name="goal_entries")
    op.drop_index("uq_position_observation_live_day", table_name="position_observations")
    op.drop_index(op.f("ix_position_observations_position_id"), table_name="position_observations")
    op.drop_index(
        op.f("ix_position_observations_effective_date"), table_name="position_observations"
    )
    op.drop_table("position_observations")
    op.drop_index(op.f("ix_goal_entries_goal_id"), table_name="goal_entries")
    op.drop_index(op.f("ix_goal_entries_effective_date"), table_name="goal_entries")
    op.drop_index(op.f("ix_goal_entries_account_id"), table_name="goal_entries")
    op.drop_table("goal_entries")
    op.drop_table("manual_positions")
    op.drop_table("goals")
