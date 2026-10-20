"""Optional descriptive debt terms, without payment posting or amortization."""

import sqlalchemy as sa
from alembic import op

revision = "sqlite_0013"
down_revision = "sqlite_0012"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("manual_positions", sa.Column("interest_rate", sa.String(24), nullable=True))
    op.add_column("manual_positions", sa.Column("minimum_payment", sa.String(24), nullable=True))
    op.add_column("manual_positions", sa.Column("payment_frequency", sa.String(12), nullable=True))
    op.add_column("manual_positions", sa.Column("expected_payoff_date", sa.Date(), nullable=True))


def downgrade():
    for name in ("expected_payoff_date", "payment_frequency", "minimum_payment", "interest_rate"):
        op.drop_column("manual_positions", name)
