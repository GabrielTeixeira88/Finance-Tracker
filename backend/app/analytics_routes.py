"""Offline analytics endpoints; reads never change the financial ledger."""

from datetime import date, datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Query
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select

from app import investment_analytics
from app.analytics_models import AssetClassification
from app.ledger import require
from app.models import Asset
from app.routes import DB

router = APIRouter(prefix="/api/investments/analytics", tags=["investment analytics"])
Currency = Literal["BRL", "USD", "EUR", "JPY"]
Scope = Annotated[list[UUID] | None, Query(max_length=100)]


class Metric(BaseModel):
    value: str | None
    method: str
    quality: Literal["COMPLETE", "PARTIAL", "UNAVAILABLE"]
    reasons: list[str]


class ReturnPoint(BaseModel):
    date: date
    return_percent: str | None


class ScopeAccount(BaseModel):
    id: UUID
    name: str


class Benchmark(BaseModel):
    asset_id: UUID
    symbol: str
    currency: str
    method: str
    points: list[ReturnPoint]
    return_metric: Metric = Field(alias="return")
    difference_percentage_points: str | None
    missing_days: int
    source: str | None
    quote_date: date | None
    refreshed_at: datetime | None


class PerformanceResponse(BaseModel):
    start: date
    end: date
    currency: str
    accounts: list[ScopeAccount]
    opening_value: str | None
    ending_value: str | None
    net_external_flows: str | None
    absolute_gain: Metric
    twr: Metric
    xirr: Metric
    points: list[ReturnPoint]
    valuation: dict
    flows: list[dict]
    benchmark: Benchmark | None


class IncomeAmounts(BaseModel):
    currency: str
    gross: str
    fees: str
    taxes: str
    net: str


class IncomeEvent(IncomeAmounts):
    id: UUID
    date: date
    account_id: UUID
    account: str
    asset_id: UUID | None
    symbol: str
    type: Literal["DIVIDEND", "INTEREST"]


class IncomeMonth(IncomeAmounts):
    month: str


class IncomeGroup(IncomeAmounts):
    name: str
    id: str | None


class IncomeResponse(BaseModel):
    start: date
    end: date
    method: str
    quality: Literal["COMPLETE"]
    events: list[IncomeEvent]
    months: list[IncomeMonth]
    breakdowns: dict[str, list[IncomeGroup]]


class AllocationMember(BaseModel):
    account_id: UUID
    asset_id: UUID | None


class AllocationGroup(BaseModel):
    name: str
    value: str | None
    weight_percent: str | None
    complete: bool
    members: list[AllocationMember]


class AllocationResponse(BaseModel):
    as_of: date
    currency: str
    method: str
    quality: Literal["COMPLETE", "PARTIAL", "UNAVAILABLE"]
    reasons: list[str]
    total_value: str | None
    known_value: str
    groups: dict[str, list[AllocationGroup]]
    concentration: dict[str, str | None]
    rows: list[dict]
    metadata_policy: str


@router.get("/performance", response_model=PerformanceResponse)
def performance(
    db: DB,
    end: date,
    start: date | None = None,
    currency: Currency = "BRL",
    account_ids: Scope = None,
    benchmark_id: UUID | None = None,
):
    return investment_analytics.performance(db, start, end, currency, account_ids, benchmark_id)


@router.get("/income", response_model=IncomeResponse)
def income(
    db: DB,
    start: date,
    end: date,
    account_ids: Scope = None,
    asset_id: UUID | None = None,
):
    return investment_analytics.income(db, start, end, account_ids, asset_id)


@router.get("/allocation", response_model=AllocationResponse)
def allocation(db: DB, as_of: date, currency: Currency = "BRL", account_ids: Scope = None):
    return investment_analytics.allocation(db, as_of, currency, account_ids)


@router.get("/insights")
def insights(
    db: DB,
    start: date,
    end: date,
    currency: Currency = "BRL",
    account_ids: Scope = None,
    asset_id: UUID | None = None,
):
    return investment_analytics.insights(db, start, end, currency, account_ids, asset_id)


class ClassificationInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    sector: str | None = Field(default=None, max_length=100)
    geography: str | None = Field(default=None, max_length=100)

    @field_validator("sector", "geography")
    @classmethod
    def clean(cls, value):
        return value.strip() or None if value is not None else None


@router.get("/assets/{asset_id}/classification", response_model=ClassificationInput)
def classification(db: DB, asset_id: UUID):
    require(db, Asset, asset_id)
    row = db.scalar(select(AssetClassification).where(AssetClassification.asset_id == asset_id))
    return {"sector": row.sector if row else None, "geography": row.geography if row else None}


@router.put("/assets/{asset_id}/classification", response_model=ClassificationInput)
def update_classification(db: DB, asset_id: UUID, data: ClassificationInput):
    require(db, Asset, asset_id)
    row = db.scalar(select(AssetClassification).where(AssetClassification.asset_id == asset_id))
    if row is None:
        row = AssetClassification(asset_id=asset_id)
        db.add(row)
    row.sector, row.geography = data.sector, data.geography
    db.flush()
    return data
