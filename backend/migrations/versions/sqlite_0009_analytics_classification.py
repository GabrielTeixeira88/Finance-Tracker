"""Add explicit asset classification without changing financial records."""

import sqlalchemy as sa
from alembic import op

revision = "sqlite_0009"
down_revision = "sqlite_0008"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "asset_classifications",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.current_timestamp(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.current_timestamp(),
        ),
        sa.Column("asset_id", sa.Uuid(), nullable=False),
        sa.Column("sector", sa.String(100), nullable=True),
        sa.Column("geography", sa.String(100), nullable=True),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_asset_classifications")),
        sa.ForeignKeyConstraint(
            ["asset_id"], ["assets.id"], name=op.f("fk_asset_classifications_asset_id_assets")
        ),
        sa.UniqueConstraint("asset_id", name=op.f("uq_asset_classifications_asset_id")),
    )


def downgrade():
    op.drop_table("asset_classifications")
