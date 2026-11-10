"""Add optional category/group presentation without changing financial tables."""

import sqlalchemy as sa
from alembic import op

revision = "sqlite_0018"
down_revision = "sqlite_0017"
branch_labels = depends_on = None


def upgrade():
    op.create_table(
        "classification_appearance",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "category_id",
            sa.Uuid(),
            sa.ForeignKey("categories.id", ondelete="CASCADE"),
            unique=True,
        ),
        sa.Column(
            "group_id",
            sa.Uuid(),
            sa.ForeignKey("budget_groups.id", ondelete="CASCADE"),
            unique=True,
        ),
        sa.Column("color", sa.String(7)),
        sa.Column("icon", sa.String(48)),
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
        sa.CheckConstraint("(category_id IS NULL) <> (group_id IS NULL)", name="one_owner"),
    )


def downgrade():
    raise RuntimeError("Retain saved classification appearance; restore a reviewed backup instead")
