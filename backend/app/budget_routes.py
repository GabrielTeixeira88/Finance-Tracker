from datetime import date
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Response
from sqlalchemy import select

from app import budget_schemas as inputs
from app import budgets, ledger, spending
from app.models import BudgetGroup, BudgetMonthOverride, BudgetTarget, BudgetVersion, RefundLink
from app.routes import DB
from app.schemas import Currency

router = APIRouter(prefix="/api", tags=["spending and budgets"])


@router.get("/budgets/monthly")
def monthly(db: DB, month: inputs.Month, currency: Currency, as_of: date | None = None):
    return budgets.monthly(db, month, currency, as_of)


@router.post("/budgets/targets", status_code=201)
def save_target(data: inputs.TargetInput, db: DB):
    return budgets.save_target(db, data)


@router.delete("/budgets/targets/{target_id}", status_code=204)
def disable_target(target_id: UUID, month: inputs.Month, db: DB):
    target = ledger.require(db, BudgetTarget, target_id)
    _, versions, overrides = budgets.configurations(
        db, target.currency, spending.month_start(month)
    )
    config = budgets.effective(target.id, spending.month_start(month), versions, overrides)
    if config is None:
        raise HTTPException(404, "No target configuration for this month")
    values = {**budgets.settings(config), "active": False, "rollover_enabled": False}
    budgets.save_target(
        db,
        inputs.TargetInput(
            category_id=target.category_id,
            currency=target.currency,
            month=month,
            **values,
        ),
    )
    # A same-month override must not mask the explicit disable operation.
    override = overrides.get((target.id, spending.month_start(month)))
    if override:
        override.active = False
        override.rollover_enabled = False
    db.flush()
    return Response(status_code=204)


@router.delete("/budgets/targets/{target_id}/override", status_code=204)
def clear_override(target_id: UUID, month: inputs.Month, db: DB):
    ledger.require(db, BudgetTarget, target_id)
    row = db.scalar(
        select(BudgetMonthOverride).where(
            BudgetMonthOverride.target_id == target_id,
            BudgetMonthOverride.month == spending.month_start(month),
        )
    )
    if row:
        db.delete(row)
        db.flush()
    return Response(status_code=204)


@router.post("/budgets/copy-month")
def copy_month(data: inputs.CopyMonth, db: DB):
    return budgets.copy_month(db, data)


@router.get("/budgets/groups")
def groups(db: DB):
    return list(
        db.scalars(
            select(BudgetGroup).order_by(BudgetGroup.sort_order, BudgetGroup.name, BudgetGroup.id)
        )
    )


@router.post("/budgets/groups", status_code=201)
def create_group(data: inputs.GroupInput, db: DB):
    row = BudgetGroup(**data.model_dump())
    db.add(row)
    db.flush()
    return row


@router.put("/budgets/groups/{group_id}")
def update_group(group_id: UUID, data: inputs.GroupInput, db: DB):
    row = ledger.require(db, BudgetGroup, group_id)
    row.name, row.sort_order = data.name, data.sort_order
    db.flush()
    return row


@router.delete("/budgets/groups/{group_id}", status_code=204)
def delete_group(group_id: UUID, db: DB):
    row = ledger.require(db, BudgetGroup, group_id)
    for model in (BudgetVersion, BudgetMonthOverride):
        if db.scalar(select(model.id).where(model.group_id == group_id).limit(1)):
            raise HTTPException(409, "Group is referenced by budget history; rename instead")
    db.delete(row)
    db.flush()
    return Response(status_code=204)


@router.get("/spending/summary")
def summary(
    db: DB, date_from: date, date_to: date, currency: Currency, account_id: UUID | None = None
):
    if (date_to - date_from).days > 3660:
        raise HTTPException(422, "Choose a date range no longer than ten years")
    data = spending.calculate(db, date_from, date_to, currency, account_id)[currency]
    return {
        "currency": currency,
        "date_from": date_from,
        "date_to_exclusive": date_to,
        **{
            key: spending.money(data[key])
            for key in ("income", "expenses", "gross_expenses", "refunds")
        },
        "categories": [
            {"category_id": str(k) if k else None, "spent": spending.money(v)}
            for k, v in data["categories"].items()
        ],
    }


@router.get("/spending/refunds")
def refunds(db: DB, limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)):
    return list(
        db.scalars(
            select(RefundLink)
            .order_by(RefundLink.created_at.desc(), RefundLink.id)
            .limit(limit)
            .offset(offset)
        )
    )


@router.post("/spending/refunds", status_code=201)
def create_refund(data: inputs.RefundInput, db: DB):
    return spending.create_refund(db, data)


@router.post("/spending/refunds/link", status_code=201)
def link_refund(data: inputs.RefundAssociation, db: DB):
    return spending.associate_refund(db, data.purchase_id, data.refund_id)


@router.delete("/spending/refunds/{link_id}", status_code=204)
def unlink_refund(link_id: UUID, db: DB):
    db.delete(ledger.require(db, RefundLink, link_id))
    db.flush()
    return Response(status_code=204)
