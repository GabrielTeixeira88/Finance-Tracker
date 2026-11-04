"""RDB lots, official Treasury marks and whole-account goal funding.

Revision ID: sqlite_0017
Revises: sqlite_0016
"""

import sqlalchemy as sa
from alembic import op

revision = "sqlite_0017"
down_revision = "sqlite_0016"
branch_labels = depends_on = None


def upgrade():
    # SQLite batch copy preserves every row. Restore the original retained-term
    # triggers immediately after the table rebuild, in this same DDL transaction.
    with op.batch_alter_table("fixed_income_contracts") as batch:
        batch.drop_constraint(op.f("ck_fixed_income_contracts_type"), type_="check")
        batch.drop_constraint(op.f("ck_fixed_income_contracts_index"), type_="check")
        batch.create_check_constraint(
            "type", "instrument_type IN ('CDB_CDI','RDB_CDI','CDB_FIXED','TESOURO_SELIC')"
        )
        batch.create_check_constraint(
            "index",
            "(instrument_type IN ('CDB_CDI','RDB_CDI') AND index_name='CDI') OR "
            "(instrument_type='CDB_FIXED' AND index_name IS NULL) OR "
            "(instrument_type='TESOURO_SELIC' AND index_name='SELIC_OVER')",
        )
    op.execute("""CREATE TRIGGER fixed_income_terms_immutable
        BEFORE UPDATE ON fixed_income_contracts
        BEGIN SELECT RAISE(ABORT, 'Fixed-income contract terms are immutable'); END""")
    op.execute("""CREATE TRIGGER fixed_income_terms_retained BEFORE DELETE ON fixed_income_contracts
        BEGIN SELECT RAISE(ABORT, 'Fixed-income contract history is retained'); END""")
    with op.batch_alter_table("price_observations") as batch:
        batch.drop_constraint(op.f("ck_price_observations_price_type"), type_="check")
        batch.create_check_constraint(
            "price_type", "price_type IN ('RAW_CLOSE','LATEST','ADJUSTED','OFFICIAL_PU')"
        )
    op.create_table(
        "goal_account_funding",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("goal_id", sa.Uuid(), sa.ForeignKey("goals.id"), nullable=False, unique=True),
        sa.Column(
            "account_id",
            sa.Uuid(),
            sa.ForeignKey("financial_accounts.id"),
            nullable=False,
            unique=True,
        ),
        sa.Column("effective_date", sa.Date(), nullable=False),
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
    )


def downgrade():
    raise RuntimeError(
        "Retain historical contracts and goal funding; restore a reviewed backup instead"
    )
