"""Explicit local settings projections and portable, whitelisted exports."""

import csv
import io
import json
from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Request, Response
from pydantic import Field
from sqlalchemy import delete, func, select

from app import investments, ledger
from app._version import __version__
from app.analytics_models import AssetClassification
from app.life_event_models import LifeEvent, LifeEventLink
from app.market_models import FXObservation
from app.market_valuation import preferences
from app.models import (
    Asset,
    BudgetGroup,
    BudgetMonthOverride,
    BudgetTarget,
    BudgetVersion,
    Category,
    FinancialAccount,
    InvestmentActivity,
    Payee,
    PriceObservation,
    Transaction,
    TransactionRule,
)
from app.routes import DB
from app.schemas import Input, Name
from app.settings_models import AccountGroup, AccountGroupMember
from app.wealth_models import Goal, GoalEntry, ManualPosition, PositionObservation

router = APIRouter(prefix="/api/settings", tags=["local settings"])


@router.get("/preferences")
def reporting_preferences(db: DB):
    return {"reporting_currency": preferences(db)["reporting_currency"]}


def exact_wire(value):
    """Exports are lossless, including 18-place FX; never reuse settled money rounding."""
    if isinstance(value, Decimal):
        return format(value, "f")
    if isinstance(value, (date, datetime, UUID)):
        return str(value)
    if isinstance(value, dict):
        return {key: exact_wire(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [exact_wire(item) for item in value]
    if hasattr(value, "__table__"):
        return exact_wire(
            {column.name: getattr(value, column.name) for column in value.__table__.columns}
        )
    return value


class GroupInput(Input):
    name: Name
    description: str = Field(default="", max_length=500)
    account_ids: list[UUID] = Field(default_factory=list, max_length=200)


def group_wire(db, row):
    return {
        **investments.wire(row),
        "account_ids": [
            str(i)
            for i in db.scalars(
                select(AccountGroupMember.account_id)
                .where(AccountGroupMember.group_id == row.id)
                .order_by(AccountGroupMember.account_id)
            )
        ],
    }


@router.get("/account-groups")
def groups(db: DB):
    return [
        group_wire(db, row)
        for row in db.scalars(
            select(AccountGroup).order_by(AccountGroup.normalized_name, AccountGroup.id)
        )
    ]


def save_group(db, row, data):
    if len(data.account_ids) != len(set(data.account_ids)):
        raise HTTPException(422, "Duplicate group membership")
    for account_id in data.account_ids:
        ledger.require(db, FinancialAccount, account_id)
    row.name = " ".join(data.name.split())
    row.normalized_name = row.name.casefold()
    row.description = data.description.strip()
    db.add(row)
    db.flush()
    db.execute(delete(AccountGroupMember).where(AccountGroupMember.group_id == row.id))
    db.add_all(AccountGroupMember(group_id=row.id, account_id=i) for i in data.account_ids)
    db.flush()
    return group_wire(db, row)


@router.post("/account-groups", status_code=201)
def create_group(data: GroupInput, db: DB):
    return save_group(db, AccountGroup(), data)


@router.put("/account-groups/{group_id}")
def update_group(group_id: UUID, data: GroupInput, db: DB):
    return save_group(db, ledger.require(db, AccountGroup, group_id), data)


@router.delete("/account-groups/{group_id}", status_code=204)
def remove_group(group_id: UUID, db: DB):
    row = ledger.require(db, AccountGroup, group_id)
    db.execute(delete(AccountGroupMember).where(AccountGroupMember.group_id == group_id))
    db.delete(row)
    db.flush()
    return Response(status_code=204)


class SecurityMetadata(Input):
    name: Name


@router.patch("/securities/{asset_id}")
def security_metadata(asset_id: UUID, data: SecurityMetadata, db: DB):
    # Listing identity, currency, activities and fixed-income terms remain immutable here.
    asset = ledger.require(db, Asset, asset_id)
    asset.name = data.name
    db.flush()
    return investments.wire(asset)


@router.get("/fx")
def fx_history(db: DB, limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)):
    return {
        "total": db.scalar(select(func.count()).select_from(FXObservation)),
        "items": exact_wire(
            list(
                db.scalars(
                    select(FXObservation)
                    .order_by(FXObservation.rate_date.desc(), FXObservation.id)
                    .limit(limit)
                    .offset(offset)
                )
            )
        ),
    }


@router.get("/about")
def about(request: Request):
    return {
        "name": "Finance Tracker",
        "version": __version__,
        "database": "SQLite",
        "repository": "https://github.com/GabrielTeixeira88/Finance-Tracker",
        "license": "AGPL-3.0-only (owner-authored code); third-party components retain "
        "their AGPL, GPL, MIT, OFL and other applicable licenses.",
        "deployment": "Local demo (fictional ledger)"
        if hasattr(request.app.state, "demo_store")
        else "Personal workspace (single-user, local-first)",
    }


# Each export column is reviewed; integration payloads and credentials stay excluded.
EXPORTS = {
    "accounts": (FinancialAccount, "id name type currency institution active"),
    "categories": (Category, "id name"),
    "payees": (Payee, "id name"),
    "securities": (Asset, "id symbol name asset_type exchange currency isin"),
    "transactions": (
        Transaction,
        "id account_id transaction_type direction amount currency "
        "transaction_date description merchant category_id payee_id review_status "
        "transfer_id deleted_at",
    ),
    "activities": (
        InvestmentActivity,
        "id account_id asset_id activity_type activity_date quantity "
        "unit_price gross_amount fees taxes cash_amount direction currency notes voided_at",
    ),
    "prices": (PriceObservation, "id asset_id price_date price currency source price_type"),
    "fx": (FXObservation, "id base_currency quote_currency rate_date rate provider fetched_at"),
    "account-groups": (AccountGroup, "id name description"),
    "group-members": (AccountGroupMember, "group_id account_id"),
    "classifications": (AssetClassification, "id asset_id sector geography"),
    "assets-liabilities": (
        ManualPosition,
        "id name kind category currency liquidity start_date "
        "end_date acquisition_cost disposal_proceeds associated_asset_id notes",
    ),
    "manual-valuations": (
        PositionObservation,
        "id position_id effective_date amount notes voided_at void_reason",
    ),
    "goals": (Goal, "id name currency mode target start_date deadline status notes"),
    "goal-progress": (
        GoalEntry,
        "id goal_id account_id effective_date amount direction notes voided_at",
    ),
    "budget-groups": (BudgetGroup, "id name sort_order"),
    "budget-targets": (BudgetTarget, "id category_id currency"),
    "budget-versions": (
        BudgetVersion,
        "id target_id month amount active rollover_enabled group_id sort_order",
    ),
    "budget-overrides": (
        BudgetMonthOverride,
        "id target_id month amount active rollover_enabled group_id sort_order",
    ),
    "rules": (TransactionRule, "id name enabled priority match_mode conditions actions"),
    "life-events": (
        LifeEvent,
        "id name event_type description start_date end_date currency color icon planned_budget",
    ),
    "life-event-links": (LifeEventLink, "id event_id transaction_id"),
}

PROJECTIONS = {
    "holdings": "account_id asset_id symbol name exchange currency quantity average_cost "
    "cost_basis realized income market_value unrealized",
    "portfolio-history": "date currency value known_value missing_assets missing_fx carried_assets",
    "net-worth-history": "date currency value assets liabilities known_value complete",
}


@router.get("/exports")
def export_catalog():
    return {"datasets": [*EXPORTS, *PROJECTIONS], "formats": ["csv", "json"], "max_rows": 50000}


def safe_cell(value):
    # Spreadsheet formula defense for text only; exact signed Decimal strings stay numeric.
    if isinstance(value, str) and value.lstrip().startswith(("=", "+", "-", "@", "\t", "\r")):
        return "'" + value
    return value


@router.get("/exports/{dataset}")
def export_data(
    dataset: str, db: DB, format: Literal["csv", "json"] = "json", as_of: date | None = None
):
    if dataset not in EXPORTS and dataset not in PROJECTIONS:
        raise HTTPException(404, "Unsupported export dataset")
    if dataset in EXPORTS:
        model, names = EXPORTS[dataset]
        fields = names.split()
        order = [getattr(model, column.name) for column in model.__table__.primary_key]
        rows = list(db.scalars(select(model).order_by(*order).limit(50001)))
        if len(rows) > 50000:
            raise HTTPException(413, "Export exceeds 50,000 rows; use a local database backup")
        values = [{key: getattr(row, key) for key in fields} for row in rows]
    else:
        from datetime import timedelta

        from app.market_valuation import history
        from app.wealth import net_worth

        day = as_of or date.today()
        if day < date(1901, 1, 1) or day > date.today():
            raise HTTPException(422, "Choose an available historical export date")
        currency = preferences(db)["reporting_currency"]
        if dataset == "holdings":
            rows = investments.portfolio(db, as_of=day, serialize=False)["holdings"]
        elif dataset == "portfolio-history":
            rows = history(db, day - timedelta(days=365), day, reporting_currency=currency)[
                "points"
            ]
        else:
            rows = net_worth(db, day - timedelta(days=365), day, currency)["points"]
        if dataset != "holdings":
            rows = [{**row, "currency": currency} for row in rows]
        fields = PROJECTIONS[dataset].split()
        values = [{key: row[key] for key in fields} for row in rows]
    headers = {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": f'attachment; filename="finance-tracker-{dataset}.{format}"',
    }
    if format == "json":
        from fastapi.responses import JSONResponse

        return JSONResponse(
            {"version": __version__, "dataset": dataset, "records": exact_wire(values)},
            headers=headers,
        )
    output = io.StringIO(newline="")
    writer = csv.writer(output, lineterminator="\r\n")
    writer.writerow(fields)
    for row in values:
        writer.writerow(
            [
                safe_cell(
                    json.dumps(exact_wire(row[key]), ensure_ascii=False)
                    if isinstance(row[key], (dict, list))
                    else row[key]
                )
                for key in fields
            ]
        )
    return Response(output.getvalue(), media_type="text/csv; charset=utf-8", headers=headers)
