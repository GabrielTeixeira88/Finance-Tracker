"""Isolated, opt-in synthetic preview fixtures."""

import sqlalchemy as sa
from alembic import op

revision = "sqlite_0002"
down_revision = "sqlite_0001"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "demo_fixtures",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
    )


def downgrade():
    raise RuntimeError("Destructive downgrades require a separately reviewed migration")
