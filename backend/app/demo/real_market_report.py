"""Educational projections from production services, never presentation fixtures."""

from decimal import Decimal

from sqlalchemy import select

from app import fixed_income, investments
from app.demo.real_market_snapshot import END
from app.models import InvestmentActivity


def report(session):
    positions = fixed_income.overview(session, END)["positions"]
    lots = [p for p in positions if p["contract"]["instrument_type"] == "RDB_CDI"]
    summary = {}
    for key in ("principal", "gross_interest", "gross_value", "income_tax", "iof", "estimated_net"):
        summary[key] = (
            sum((Decimal(p[key]) for p in lots), Decimal(0))
            if all(p[key] is not None for p in lots)
            else None
        )
    rows = list(
        session.scalars(
            select(InvestmentActivity)
            .where(
                InvestmentActivity.voided_at.is_(None),
                InvestmentActivity.activity_date <= END,
            )
            .order_by(InvestmentActivity.activity_date, InvestmentActivity.sequence)
        )
    )
    return investments.wire(
        {
            "positions": positions,
            "caixinha": summary,
            "purchases": [
                {
                    "date": r.activity_date,
                    "account_id": r.account_id,
                    "asset_id": r.asset_id,
                    "quantity": r.quantity,
                    "unit_price": r.unit_price,
                    "invested": r.gross_amount,
                    "description": r.notes,
                }
                for r in rows
                if r.activity_type == "BUY"
            ],
            "taxes": "Estimated resident-individual IR/IOF, calculated per application lot. "
            "Gross values remain authoritative; taxes are not posted until redemption.",
            "treasury_fees": "One Treasury holding below BRL 10,000: assumed exempt from B3 "
            "custody; zero broker fee. Morning sale PU is a gross mark, not a closing quote.",
        }
    )
