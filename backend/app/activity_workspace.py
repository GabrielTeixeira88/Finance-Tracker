"""Read-only, stable, paginated investment activity queries for the source UI."""

from datetime import date
from typing import Literal
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app import investments
from app.fixed_income_models import FixedIncomeContract
from app.models import Asset, FinancialAccount, InvestmentActivity


def activity_page(
    db: Session,
    *,
    account_id: UUID | None = None,
    asset_id: UUID | None = None,
    query: str = "",
    activity_type: str = "",
    status: Literal["all", "active", "voided"] = "all",
    start: date | None = None,
    end: date | None = None,
    sort: Literal["date", "type", "security", "account"] = "date",
    descending: bool = True,
    offset: int = 0,
    limit: int = 50,
):
    if start and end and start > end:
        raise HTTPException(422, "Start date must not follow end date")
    statement = (
        select(InvestmentActivity)
        .outerjoin(Asset, Asset.id == InvestmentActivity.asset_id)
        .join(FinancialAccount, FinancialAccount.id == InvestmentActivity.account_id)
    )
    if account_id:
        statement = statement.where(InvestmentActivity.account_id == account_id)
    if asset_id:
        statement = statement.where(InvestmentActivity.asset_id == asset_id)
    if query.strip():
        text = query.strip()
        statement = statement.where(
            or_(
                InvestmentActivity.notes.icontains(text, autoescape=True),
                Asset.name.icontains(text, autoescape=True),
                Asset.symbol.icontains(text, autoescape=True),
                FinancialAccount.name.icontains(text, autoescape=True),
            )
        )
    if activity_type:
        if activity_type not in {"BUY", "SELL", "DIVIDEND", "INTEREST", "FEE", "TAX"}:
            raise HTTPException(422, "Unsupported investment activity type")
        statement = statement.where(InvestmentActivity.activity_type == activity_type)
    if status != "all":
        statement = statement.where(
            InvestmentActivity.voided_at.is_(None)
            if status == "active"
            else InvestmentActivity.voided_at.is_not(None)
        )
    if start:
        statement = statement.where(InvestmentActivity.activity_date >= start)
    if end:
        statement = statement.where(InvestmentActivity.activity_date <= end)
    count = db.scalar(select(func.count()).select_from(statement.subquery()))
    key = {
        "date": InvestmentActivity.activity_date,
        "type": InvestmentActivity.activity_type,
        "security": Asset.symbol,
        "account": FinancialAccount.name,
    }[sort]
    statement = statement.order_by(
        key.desc() if descending else key.asc(),
        InvestmentActivity.sequence.desc() if descending else InvestmentActivity.sequence.asc(),
    )
    return investments.wire(
        {
            "rows": list(db.scalars(statement.offset(offset).limit(limit))),
            "total": count,
            "offset": offset,
            "limit": limit,
            "fixed_income_asset_ids": list(db.scalars(select(FixedIncomeContract.asset_id))),
        }
    )
