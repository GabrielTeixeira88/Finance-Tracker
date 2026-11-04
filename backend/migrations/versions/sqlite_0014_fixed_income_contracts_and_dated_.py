"""fixed income contracts and dated reference factors

Revision ID: sqlite_0014
Revises: sqlite_0013
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "sqlite_0014"
down_revision: str | None = "sqlite_0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "fixed_income_indices",
        sa.Column("index_name", sa.String(length=12), nullable=False),
        sa.Column("observation_date", sa.Date(), nullable=False),
        sa.Column("source", sa.String(length=12), nullable=False),
        sa.Column("factor", sa.String(36), nullable=False),
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
            "index_name IN ('CDI','SELIC_OVER')", name=op.f("ck_fixed_income_indices_index")
        ),
        sa.CheckConstraint(
            "source IN ('SYNTHETIC','MANUAL')", name=op.f("ck_fixed_income_indices_source")
        ),
        sa.CheckConstraint(
            "typeof(factor)='text' AND length(factor)=36 AND factor NOT GLOB "
            "'*[^0-9]*' AND factor >= '000000000000000001000000000000000000'",
            name=op.f("ck_fixed_income_indices_factor"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_fixed_income_indices")),
        sa.UniqueConstraint(
            "index_name",
            "observation_date",
            "source",
            name=op.f("uq_fixed_income_indices_index_name"),
        ),
    )
    op.create_index(
        op.f("ix_fixed_income_indices_observation_date"),
        "fixed_income_indices",
        ["observation_date"],
        unique=False,
    )
    op.create_table(
        "fixed_income_contracts",
        sa.Column("asset_id", sa.Uuid(), nullable=False),
        sa.Column("account_id", sa.Uuid(), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("instrument_type", sa.String(length=20), nullable=False),
        sa.Column("issuer", sa.String(length=120), nullable=False),
        sa.Column("settlement_date", sa.Date(), nullable=False),
        sa.Column("maturity_date", sa.Date(), nullable=False),
        sa.Column("redemption_from", sa.Date(), nullable=False),
        sa.Column("liquidity", sa.String(length=20), nullable=False),
        sa.Column("index_name", sa.String(length=12), nullable=True),
        sa.Column("index_source", sa.String(length=12), nullable=False),
        sa.Column("cdi_percent", sa.String(24), nullable=False),
        sa.Column("annual_rate", sa.String(24), nullable=False),
        sa.Column("spread_rate", sa.String(24), nullable=False),
        sa.Column("acquisition_price", sa.String(24), nullable=False),
        sa.Column("fictional", sa.Boolean(), nullable=False),
        sa.Column("fgc_eligible", sa.Boolean(), nullable=False),
        sa.Column("notes", sa.String(length=1000), nullable=False),
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
            "(instrument_type='CDB_CDI' AND index_name='CDI') OR "
            "(instrument_type='CDB_FIXED' AND index_name IS NULL) OR "
            "(instrument_type='TESOURO_SELIC' AND index_name='SELIC_OVER')",
            name=op.f("ck_fixed_income_contracts_index"),
        ),
        sa.CheckConstraint(
            "acquisition_price > '000000000000000000000000'",
            name=op.f("ck_fixed_income_contracts_positive_price"),
        ),
        sa.CheckConstraint("currency='BRL'", name=op.f("ck_fixed_income_contracts_currency")),
        sa.CheckConstraint(
            "index_source != 'SYNTHETIC' OR fictional=1",
            name=op.f("ck_fixed_income_contracts_fictional"),
        ),
        sa.CheckConstraint(
            "index_source IN ('SYNTHETIC','MANUAL')", name=op.f("ck_fixed_income_contracts_source")
        ),
        sa.CheckConstraint(
            "instrument_type != 'TESOURO_SELIC' OR fgc_eligible=0",
            name=op.f("ck_fixed_income_contracts_fgc"),
        ),
        sa.CheckConstraint(
            "instrument_type IN ('CDB_CDI','CDB_FIXED','TESOURO_SELIC')",
            name=op.f("ck_fixed_income_contracts_type"),
        ),
        sa.CheckConstraint(
            "liquidity IN ('DAILY','AT_MATURITY')", name=op.f("ck_fixed_income_contracts_liquidity")
        ),
        sa.CheckConstraint(
            "typeof(acquisition_price)='text' AND length(acquisition_price)=24 AND "
            "acquisition_price NOT GLOB '*[^0-9]*'",
            name=op.f("ck_fixed_income_contracts_acquisition_price"),
        ),
        sa.CheckConstraint(
            "typeof(annual_rate)='text' AND length(annual_rate)=24 AND annual_rate NOT "
            "GLOB '*[^0-9]*'",
            name=op.f("ck_fixed_income_contracts_annual_rate"),
        ),
        sa.CheckConstraint(
            "typeof(cdi_percent)='text' AND length(cdi_percent)=24 AND cdi_percent NOT "
            "GLOB '*[^0-9]*'",
            name=op.f("ck_fixed_income_contracts_cdi_percent"),
        ),
        sa.CheckConstraint(
            "typeof(spread_rate)='text' AND length(spread_rate)=24 AND spread_rate NOT "
            "GLOB '*[^0-9]*'",
            name=op.f("ck_fixed_income_contracts_spread_rate"),
        ),
        sa.CheckConstraint(
            "settlement_date < maturity_date AND redemption_from >= settlement_date "
            "AND redemption_from <= maturity_date",
            name=op.f("ck_fixed_income_contracts_dates"),
        ),
        sa.ForeignKeyConstraint(
            ["account_id", "currency"],
            ["financial_accounts.id", "financial_accounts.currency"],
            name=op.f("fk_fixed_income_contracts_account_id_financial_accounts"),
        ),
        sa.ForeignKeyConstraint(
            ["asset_id", "currency"],
            ["assets.id", "assets.currency"],
            name=op.f("fk_fixed_income_contracts_asset_id_assets"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_fixed_income_contracts")),
        sa.UniqueConstraint("asset_id", name=op.f("uq_fixed_income_contracts_asset_id")),
    )

    op.execute("""CREATE TRIGGER fixed_income_terms_immutable
        BEFORE UPDATE ON fixed_income_contracts
        BEGIN SELECT RAISE(ABORT, 'Fixed-income contract terms are immutable'); END""")
    op.execute("""CREATE TRIGGER fixed_income_terms_retained BEFORE DELETE ON fixed_income_contracts
        BEGIN SELECT RAISE(ABORT, 'Fixed-income contract history is retained'); END""")


def downgrade() -> None:
    raise RuntimeError("Fixed-income history cannot be destructively downgraded")
