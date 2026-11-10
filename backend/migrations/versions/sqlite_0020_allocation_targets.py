"""Local Stage A target configuration; existing financial rows remain unchanged."""

import sqlalchemy as sa
from alembic import op

revision = "sqlite_0020"
down_revision = "sqlite_0019"
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
        "allocation_targets",
        *record_columns(),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("dimension", sa.String(24), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("scope", sa.String(12), nullable=False),
        sa.Column("band_type", sa.String(12), nullable=False),
        sa.Column("band_bps", sa.Integer(), nullable=False),
        sa.Column("relative_factor_bps", sa.Integer(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.CheckConstraint("length(trim(name)) > 0", name="name"),
        sa.CheckConstraint("scope IN ('all','accounts')", name="scope"),
        sa.CheckConstraint("band_type IN ('absolute','hybrid')", name="band_type"),
        sa.CheckConstraint("band_bps BETWEEN 0 AND 10000", name="band"),
        sa.CheckConstraint("relative_factor_bps BETWEEN 0 AND 10000", name="relative_band"),
        sa.CheckConstraint("version > 0", name="version"),
        sa.CheckConstraint(
            "dimension IN ('asset_class','instrument_type','sector',"
            "'geography','currency','issuer')",
            name="dimension",
        ),
        sa.CheckConstraint(
            "length(currency) = 3 AND currency NOT GLOB '*[^A-Z]*'", name="currency"
        ),
    )
    op.create_table(
        "allocation_target_weights",
        *record_columns(),
        sa.Column("target_id", sa.Uuid(), sa.ForeignKey("allocation_targets.id"), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("category", sa.String(100), nullable=False),
        sa.Column("target_bps", sa.Integer(), nullable=False),
        sa.Column("required", sa.Boolean(), nullable=False),
        sa.UniqueConstraint("target_id", "version", "category"),
        sa.CheckConstraint("target_bps BETWEEN 0 AND 10000", name="weight"),
        sa.CheckConstraint("version > 0", name="version"),
        sa.CheckConstraint("length(trim(category)) > 0", name="category"),
    )
    op.create_index(
        "ix_allocation_target_weights_target_id", "allocation_target_weights", ["target_id"]
    )
    op.create_table(
        "allocation_target_accounts",
        *record_columns(),
        sa.Column("target_id", sa.Uuid(), sa.ForeignKey("allocation_targets.id"), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("account_id", sa.Uuid(), sa.ForeignKey("financial_accounts.id"), nullable=False),
        sa.UniqueConstraint("target_id", "version", "account_id"),
        sa.CheckConstraint("version > 0", name="version"),
    )
    op.create_index(
        "ix_allocation_target_accounts_target_id", "allocation_target_accounts", ["target_id"]
    )


def downgrade():
    raise RuntimeError("Retain local allocation plans; restore a reviewed backup")
