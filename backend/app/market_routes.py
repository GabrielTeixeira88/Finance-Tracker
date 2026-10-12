from dataclasses import asdict
from datetime import date, timedelta
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import investments, ledger
from app.config import get_settings
from app.database import get_session
from app.market_models import AssetPricing, FXObservation, MarketSettings, SyncState
from app.market_providers import AlphaVantage, Brapi, Frankfurter, ProviderError, resolve
from app.market_sync import sync, sync_lock
from app.market_valuation import FXBook, PriceBook, history, preferences, reporting
from app.models import Asset, FinancialAccount, PriceObservation, Transaction
from app.routes import DB

router = APIRouter(prefix="/api/market-data", tags=["market data"])
Currency = Literal["BRL", "USD", "EUR", "JPY"]


class PreferencesInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    automatic: bool
    reporting_currency: Currency
    fx_provider: Literal["ECB", "SYNTHETIC"] = "ECB"


class PricingInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    mode: Literal["MANUAL", "AUTOMATIC"]
    provider: Literal["BRAPI", "ALPHA", "SYNTHETIC"] | None = None
    symbol_override: str | None = Field(default=None, pattern=r"^[A-Z0-9.^_-]{1,40}$")
    blocked_from: date | None = None
    blocked_to: date | None = None

    @model_validator(mode="after")
    def ordered(self):
        if self.blocked_to and (not self.blocked_from or self.blocked_to < self.blocked_from):
            raise ValueError("Invalid corporate-action coverage range")
        return self


class SyncInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    asset_id: UUID | None = None
    start: date | None = None
    end: date | None = None
    force: bool = False
    include_fx: bool = True


@router.get("/status")
def status(db: DB):
    settings = get_settings()
    providers = [
        {
            "id": "BRAPI",
            "configured": bool(settings.brapi_api_token.get_secret_value()),
            "capabilities": asdict(Brapi.capabilities),
            "detail": "Public: PETR4, MGLU3, VALE3, ITUB4. "
            "Raw history requires Pro and BRAPI_RAW_HISTORY=true.",
            "raw_history": settings.brapi_raw_history,
        },
        {
            "id": "ALPHA",
            "configured": bool(settings.alpha_vantage_api_key.get_secret_value()),
            "capabilities": asdict(AlphaVantage.capabilities),
            "detail": "Key required. 25 requests/day locally enforced; "
            "100 daily points on free plan. Latest is daily close.",
            "full_history": settings.alpha_vantage_full_history,
        },
        {
            "id": "ECB",
            "configured": True,
            "capabilities": asdict(Frankfurter.capabilities),
            "detail": "Frankfurter ECB reference rates. EUR base; BRL, USD and JPY. No key.",
        },
    ]
    symbols = {str(a.id): a.symbol for a in db.scalars(select(Asset))}
    states = [
        {**investments.wire(row), "symbol": symbols.get(row.scope, "FX")}
        for row in db.scalars(select(SyncState))
    ]
    return {
        "settings": preferences(db),
        "providers": providers,
        "running": sync_lock.locked(),
        "sync": states,
        "interval_minutes": settings.market_sync_interval_minutes,
    }


@router.put("/settings")
def settings(data: PreferencesInput, db: DB):
    row = db.scalar(select(MarketSettings))
    if row is None:
        row = MarketSettings()
        db.add(row)
    for key, value in data.model_dump().items():
        setattr(row, key, value)
    db.flush()
    return preferences(db)


@router.get("/assets/{asset_id}")
def asset_status(
    asset_id: UUID,
    db: DB,
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    as_of: date | None = None,
):
    asset = ledger.require(db, Asset, asset_id)
    config = db.scalar(select(AssetPricing).where(AssetPricing.asset_id == asset_id))
    mapping, error = None, None
    try:
        provider, instrument = resolve(
            asset, config.provider if config else None, config.symbol_override if config else None
        )
        mapping = {"provider": provider, **asdict(instrument)}
    except ProviderError as problem:
        error = problem.code
    current = PriceBook(db, as_of or date.today()).select(asset_id, as_of or date.today())
    return {
        "current": investments.wire(current),
        "pricing": investments.wire(config)
        if config
        else {
            "mode": "AUTOMATIC",
            "provider": None,
            "symbol_override": None,
            "blocked_from": None,
            "blocked_to": None,
        },
        "mapping": mapping,
        "mapping_error": error,
        "observations": investments.wire(
            list(
                db.scalars(
                    select(PriceObservation)
                    .where(PriceObservation.asset_id == asset_id)
                    .order_by(
                        PriceObservation.price_date.desc(),
                        PriceObservation.source,
                        PriceObservation.price_type,
                    )
                    .limit(limit)
                    .offset(offset)
                )
            )
        ),
        "sync": investments.wire(
            db.scalar(select(SyncState).where(SyncState.scope == str(asset_id)))
        ),
    }


@router.put("/assets/{asset_id}")
def pricing(asset_id: UUID, data: PricingInput, db: DB):
    asset = ledger.require(db, Asset, asset_id)
    if data.mode == "AUTOMATIC":
        try:
            resolve(asset, data.provider, data.symbol_override)
        except ProviderError as problem:
            raise HTTPException(422, problem.code) from None
    row = db.scalar(select(AssetPricing).where(AssetPricing.asset_id == asset_id))
    if row is None:
        row = AssetPricing(asset_id=asset_id)
        db.add(row)
    for key, value in data.model_dump().items():
        setattr(row, key, value)
    db.flush()
    return investments.wire(row)


@router.post("/sync")
def synchronize(data: SyncInput, session: Annotated[Session, Depends(get_session)]):
    # Deliberately not DB: no request-wide writer lock while HTTP is in flight.
    return sync(session.get_bind(), **data.model_dump())


@router.get("/valuation")
def valuation(
    db: DB,
    as_of: date | None = None,
    account_id: UUID | None = None,
    reporting_currency: Currency | None = None,
):
    portfolio = investments.portfolio(db, account_id=account_id, as_of=as_of, serialize=False)
    return investments.wire(
        {**portfolio, "reporting": reporting(db, portfolio, reporting_currency)}
    )


@router.get("/assets/{asset_id}/history")
def security_history(asset_id: UUID, db: DB, end: date, start: date | None = None):
    asset = ledger.require(db, Asset, asset_id)
    start = start or end - timedelta(days=365)
    if start > end or (end - start).days > 3660 or end > date.today():
        raise HTTPException(422, "Invalid historical range")
    book = PriceBook(db, end)
    points = []
    day = start
    while day <= end:
        point = book.select(asset_id, day, historical=True)
        points.append(
            {
                "date": day,
                "value": point.price if point else None,
                "known_value": point.price if point else "0",
                "missing_assets": [] if point else [str(asset_id)],
                "missing_fx": [],
            }
        )
        day += timedelta(days=1)
    return investments.wire(
        {
            "currency": asset.currency,
            "fx_provider": "NONE",
            "points": points,
            "warning": "Eligible raw/manual daily observations; seven-day bounded carry-forward. "
            "Adjusted prices are excluded.",
        }
    )


@router.get("/history")
def portfolio_history(
    db: DB,
    end: date,
    start: date | None = None,
    account_id: UUID | None = None,
    reporting_currency: Currency | None = None,
):
    if start is None:
        query = (
            select(func.min(Transaction.transaction_date))
            .join(FinancialAccount, Transaction.account_id == FinancialAccount.id)
            .where(FinancialAccount.type == "INVESTMENT", Transaction.deleted_at.is_(None))
        )
        if account_id:
            query = query.where(FinancialAccount.id == account_id)
        start = db.scalar(query) or end
    return history(db, start, end, account_id, reporting_currency)


@router.get("/fx")
def fx_history(
    db: DB,
    start: date,
    end: date,
    provider: Literal["ECB", "SYNTHETIC"] = "ECB",
    limit: int = Query(1000, ge=1, le=5000),
):
    rows = list(
        db.scalars(
            select(FXObservation)
            .where(FXObservation.rate_date.between(start, end), FXObservation.provider == provider)
            .order_by(FXObservation.rate_date.desc(), FXObservation.quote_currency)
            .limit(limit)
        )
    )
    return [{**investments.wire(row), "rate": format(row.rate, "f")} for row in rows]


@router.get("/fx/rate")
def fx_rate(db: DB, source: Currency, target: Currency, day: date):
    from decimal import Decimal

    book = FXBook(db, day, preferences(db)["fx_provider"])
    _, info = book.convert(Decimal(1), source, target, day)
    return {
        "source": source,
        "target": target,
        "valuation_date": day.isoformat(),
        "observation": info,
    }
