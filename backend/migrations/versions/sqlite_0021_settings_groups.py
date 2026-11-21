"""Add account group metadata without changing any financial rows."""

import sqlalchemy as sa
from alembic import op

revision = "sqlite_0021"
down_revision = "sqlite_0020"
branch_labels = depends_on = None


def upgrade():
    op.create_table(
        "account_groups",
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
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("normalized_name", sa.String(360), nullable=False, unique=True),
        sa.Column("description", sa.String(500), nullable=False),
        sa.CheckConstraint("length(trim(name)) > 0", name="nonempty_name"),
    )
    op.create_table(
        "account_group_members",
        sa.Column("group_id", sa.Uuid(), sa.ForeignKey("account_groups.id"), primary_key=True),
        sa.Column(
            "account_id", sa.Uuid(), sa.ForeignKey("financial_accounts.id"), primary_key=True
        ),
    )


def downgrade():
    op.drop_table("account_group_members")
    op.drop_table("account_groups")
