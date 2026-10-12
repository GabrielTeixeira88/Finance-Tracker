"""Local quotes, FX and synchronization metadata; preserve all financial records."""

import sqlalchemy as sa
from alembic import op

revision = "sqlite_0008"
down_revision = "sqlite_0007"
branch_labels = None
depends_on = None


def record_columns():
    return [
        sa.Column("id", sa.Uuid(), primary_key=True),
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
    ]


def upgrade():
    # No inbound references to observations; rebuilding this cache table preserves
    # every manual ID/value/date/timestamp and never touches activity/ledger tables.
    with op.batch_alter_table("price_observations") as batch:
        batch.drop_constraint("uq_price_observations_asset_id", type_="unique")
        batch.drop_constraint(op.f("ck_price_observations_source"), type_="check")
        batch.add_column(
            sa.Column("price_type", sa.String(12), nullable=False, server_default="RAW_CLOSE")
        )
        batch.add_column(sa.Column("fetched_at", sa.DateTime(timezone=True)))
        batch.add_column(sa.Column("observed_at", sa.DateTime(timezone=True)))
        batch.create_unique_constraint(
            "uq_price_observations_asset_id", ["asset_id", "price_date", "source", "price_type"]
        )
        batch.create_check_constraint("source", "source IN ('MANUAL','BRAPI','ALPHA','SYNTHETIC')")
        batch.create_check_constraint(
            "price_type", "price_type IN ('RAW_CLOSE','LATEST','ADJUSTED')"
        )
    op.create_table(
        "asset_pricing",
        *record_columns(),
        sa.Column("asset_id", sa.Uuid(), sa.ForeignKey("assets.id"), nullable=False, unique=True),
        sa.Column("mode", sa.String(12), nullable=False),
        sa.Column("provider", sa.String(12)),
        sa.Column("symbol_override", sa.String(40)),
        sa.Column("blocked_from", sa.Date()),
        sa.Column("blocked_to", sa.Date()),
        sa.CheckConstraint("mode IN ('MANUAL','AUTOMATIC')", name="mode"),
        sa.CheckConstraint("provider IN ('BRAPI','ALPHA','SYNTHETIC')", name="provider"),
        sa.CheckConstraint(
            "blocked_to IS NULL OR (blocked_from IS NOT NULL AND blocked_to >= blocked_from)",
            name="blocked_range",
        ),
    )
    # Existing manually maintained securities must not silently become automatic.
    op.execute(
        sa.text(
            "INSERT INTO asset_pricing (id,asset_id,mode) "
            "SELECT lower(hex(randomblob(16))),asset_id,'MANUAL' "
            "FROM price_observations WHERE source='MANUAL' GROUP BY asset_id"
        )
    )
    op.create_table(
        "fx_observations",
        *record_columns(),
        sa.Column("base_currency", sa.String(3), nullable=False),
        sa.Column("quote_currency", sa.String(3), nullable=False),
        sa.Column("rate_date", sa.Date(), nullable=False),
        sa.Column("rate", sa.String(36), nullable=False),
        sa.Column("provider", sa.String(12), nullable=False),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("base_currency", "quote_currency", "rate_date", "provider"),
        sa.CheckConstraint(
            "base_currency='EUR' AND quote_currency IN ('BRL','USD','JPY')", name="pair"
        ),
        sa.CheckConstraint("provider IN ('ECB','SYNTHETIC')", name="provider"),
        sa.CheckConstraint(
            "typeof(rate)='text' AND length(rate)=36 AND rate NOT GLOB '*[^0-9]*' "
            "AND rate > '000000000000000000000000000000000000'",
            name="rate",
        ),
    )
    op.create_index("ix_fx_observations_rate_date", "fx_observations", ["rate_date"])
    op.create_table(
        "market_settings",
        *record_columns(),
        sa.Column("singleton", sa.Integer(), nullable=False, unique=True),
        sa.Column("automatic", sa.Boolean(), nullable=False),
        sa.Column("reporting_currency", sa.String(3), nullable=False),
        sa.Column("fx_provider", sa.String(12), nullable=False),
        sa.CheckConstraint("singleton=1", name="singleton"),
        sa.CheckConstraint("reporting_currency IN ('BRL','USD','EUR','JPY')", name="currency"),
        sa.CheckConstraint("fx_provider IN ('ECB','SYNTHETIC')", name="fx_provider"),
    )
    op.create_table(
        "market_sync_state",
        *record_columns(),
        sa.Column("scope", sa.String(80), nullable=False, unique=True),
        sa.Column("provider", sa.String(12), nullable=False),
        sa.Column("attempted_at", sa.DateTime(timezone=True)),
        sa.Column("succeeded_at", sa.DateTime(timezone=True)),
        sa.Column("retry_at", sa.DateTime(timezone=True)),
        sa.Column("error", sa.String(40)),
        sa.Column("first_date", sa.Date()),
        sa.Column("last_date", sa.Date()),
    )
    op.create_table(
        "market_provider_budget",
        *record_columns(),
        sa.Column("provider", sa.String(12), nullable=False, unique=True),
        sa.Column("usage_date", sa.Date(), nullable=False),
        sa.Column("requests", sa.Integer(), nullable=False),
        sa.Column("retry_at", sa.DateTime(timezone=True)),
    )


def downgrade():
    raise RuntimeError("Market history must be retained; restore a reviewed local backup instead")
