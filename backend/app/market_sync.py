"""Single-worker refresh orchestration. HTTP happens outside database transactions."""

from datetime import UTC, date, datetime, timedelta
from decimal import Decimal, localcontext
from threading import Lock

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.market_models import AssetPricing, FXObservation, ProviderBudget, SyncState
from app.market_providers import AlphaVantage, Brapi, Frankfurter, ProviderError, Transport, resolve
from app.market_valuation import preferences
from app.models import Asset, FinancialAccount, InvestmentActivity, PriceObservation, Transaction

sync_lock = Lock()


def write_session(engine):
    session = Session(engine, expire_on_commit=False)
    session.connection(execution_options={"sqlite_write": True})
    return session


def reserve(engine, provider):
    now = datetime.now(UTC)
    with write_session(engine) as session:
        row = session.scalar(select(ProviderBudget).where(ProviderBudget.provider == provider))
        if row is None:
            row = ProviderBudget(provider=provider, usage_date=now.date(), requests=0)
            session.add(row)
        if row.retry_at and row.retry_at > now:
            raise ProviderError("COOLDOWN", int((row.retry_at - now).total_seconds()))
        if row.usage_date != now.date():
            row.usage_date, row.requests = now.date(), 0
        if provider == "ALPHA" and row.requests >= 25:
            raise ProviderError("RATE_LIMIT", 86400)
        row.requests += 1
        session.commit()


def registry(engine, cancel=None):
    settings = get_settings()

    def pause(seconds):
        import time

        if cancel is None:
            time.sleep(seconds)
        elif cancel.wait(seconds):
            raise ProviderError("INTERRUPTED")

    transport = Transport(reserve=lambda provider: reserve(engine, provider), sleep=pause)
    return {
        "BRAPI": Brapi(
            transport,
            settings.brapi_api_token.get_secret_value(),
            settings.brapi_raw_history,
            settings.brapi_batch_size,
        ),
        "ALPHA": AlphaVantage(
            transport,
            settings.alpha_vantage_api_key.get_secret_value(),
            settings.alpha_vantage_full_history,
        ),
        "ECB": Frankfurter(transport),
    }


def save_quotes(engine, asset, provider, instrument, quotes):
    # Validate complete response first; malformed data must not partially replace a series.
    from app.market_providers import quote

    unique = {}
    for point in quotes:
        if point.symbol != instrument.symbol:
            raise ProviderError("IDENTITY_MISMATCH")
        if point.currency != asset.currency:
            raise ProviderError("CURRENCY_MISMATCH")
        quote(
            point.symbol,
            point.currency,
            point.day,
            point.price,
            point.convention,
            point.observed_at,
        )
        if point.convention not in {"RAW_CLOSE", "LATEST", "ADJUSTED"}:
            raise ProviderError("INVALID_CONVENTION")
        key = point.day, point.convention
        if key in unique and unique[key].price != point.price:
            raise ProviderError("CONFLICTING_OBSERVATIONS")
        unique[key] = point
    with write_session(engine) as session:
        existing = {
            (p.price_date, p.price_type): p
            for p in session.scalars(
                select(PriceObservation).where(
                    PriceObservation.asset_id == asset.id, PriceObservation.source == provider
                )
            )
        }
        for key, point in unique.items():
            row = existing.get(key)
            if row is None:
                row = PriceObservation(
                    asset_id=asset.id,
                    currency=asset.currency,
                    source=provider,
                    price_date=point.day,
                    price_type=point.convention,
                )
                session.add(row)
            row.price, row.fetched_at = point.price, datetime.now(UTC)
            row.observed_at = point.observed_at
        session.commit()
    return len(unique)


def save_state(engine, scope, provider, error=None, dates=()):
    now = datetime.now(UTC)
    with write_session(engine) as session:
        row = session.scalar(select(SyncState).where(SyncState.scope == scope))
        if row is None:
            row = SyncState(scope=scope, provider=provider)
            session.add(row)
        row.provider, row.attempted_at = provider, now
        row.error = error.code if error else None
        row.retry_at = now + timedelta(seconds=max(3600, error.retry_after)) if error else None
        if not error:
            row.succeeded_at = now
        if dates:
            row.first_date = min([min(dates)] + ([row.first_date] if row.first_date else []))
            row.last_date = max([max(dates)] + ([row.last_date] if row.last_date else []))
        if error and error.code in {"AUTHENTICATION", "PLAN_REQUIRED", "RATE_LIMIT"}:
            budget = session.scalar(
                select(ProviderBudget).where(ProviderBudget.provider == provider)
            )
            if budget is None:
                budget = ProviderBudget(provider=provider, usage_date=now.date(), requests=0)
                session.add(budget)
            budget.retry_at = row.retry_at
        session.commit()


def sync(
    engine,
    asset_id=None,
    start=None,
    end=None,
    force=False,
    providers=None,
    include_fx=True,
    cancel=None,
):
    if not sync_lock.acquire(blocking=False):
        raise HTTPException(409, "A market-data refresh is already running")
    try:
        return _sync(
            engine,
            asset_id,
            start,
            end,
            force,
            providers or registry(engine, cancel),
            include_fx,
            cancel,
        )
    finally:
        sync_lock.release()


def _sync(engine, asset_id, start, end, force, providers, include_fx, cancel=None):
    today = date.today()
    end = end or today
    if end > today or (start and (start > end or (end - start).days > 3660)):
        raise HTTPException(422, "Invalid historical range (maximum ten years)")
    with Session(engine, expire_on_commit=False) as session:
        assets = list(session.scalars(select(Asset)))
        if asset_id:
            assets = [a for a in assets if a.id == asset_id]
            if not assets:
                raise HTTPException(404, "Asset not found")
        configs = {c.asset_id: c for c in session.scalars(select(AssetPricing))}
        states = {s.scope: s for s in session.scalars(select(SyncState))}
        rows = list(
            session.scalars(
                select(InvestmentActivity)
                .where(InvestmentActivity.voided_at.is_(None))
                .order_by(InvestmentActivity.activity_date, InvestmentActivity.sequence)
            )
        )
        coverage = {
            (aid, source): (first, last)
            for aid, source, first, last in session.execute(
                select(
                    PriceObservation.asset_id,
                    PriceObservation.source,
                    func.min(PriceObservation.price_date),
                    func.max(PriceObservation.price_date),
                )
                .where(PriceObservation.price_type == "RAW_CLOSE")
                .group_by(PriceObservation.asset_id, PriceObservation.source)
            )
        }
        prefs = preferences(session)
        first_cash_date = session.scalar(
            select(func.min(Transaction.transaction_date))
            .join(FinancialAccount, FinancialAccount.id == Transaction.account_id)
            .where(FinancialAccount.type == "INVESTMENT", Transaction.deleted_at.is_(None))
        )
    quantities, firsts, lasts = {}, {}, {}
    with localcontext() as context:
        context.prec = 60
        for row in rows:
            if row.asset_id:
                firsts.setdefault(row.asset_id, row.activity_date)
                lasts[row.asset_id] = row.activity_date
                quantities[row.asset_id] = quantities.get(row.asset_id, Decimal(0)) + (
                    row.quantity
                    if row.activity_type == "BUY"
                    else -row.quantity
                    if row.activity_type == "SELL"
                    else Decimal(0)
                )

    def eligible(asset):
        config = configs.get(asset.id)
        state = states.get(str(asset.id))
        now = datetime.now(UTC)
        relevant = (
            asset_id
            or quantities.get(asset.id, 0)
            or lasts.get(asset.id, date.min) >= (start or today - timedelta(days=90))
        )
        paused = config and (config.mode == "MANUAL" or config.provider == "SYNTHETIC")
        cooldown = state and (
            (state.retry_at and state.retry_at > now)
            or (
                not force
                and not start
                and state.succeeded_at
                and now - state.succeeded_at < timedelta(hours=6)
            )
        )
        return relevant and not paused and not cooldown

    latest_batch = {}
    brapi = providers.get("BRAPI")
    if brapi and getattr(brapi, "batch_size", 1) > 1:
        batch = []
        for asset in assets:
            if not eligible(asset):
                continue
            config = configs.get(asset.id)
            try:
                provider_id, instrument = resolve(
                    asset,
                    config.provider if config else None,
                    config.symbol_override if config else None,
                )
                if provider_id == "BRAPI" and (brapi.token or instrument.symbol in brapi.public):
                    batch.append((asset.id, instrument))
            except ProviderError:
                continue
        for offset in range(0, len(batch), brapi.batch_size):
            if cancel and cancel.is_set():
                break
            selected = batch[offset : offset + brapi.batch_size]
            try:
                quotes = brapi.latest([i for _, i in selected])
                for aid, instrument in selected:
                    latest_batch[aid] = [q for q in quotes if q.symbol == instrument.symbol]
            except ProviderError as error:
                for aid, _ in selected:
                    latest_batch[aid] = error

    results = []
    for asset in assets:
        if cancel and cancel.is_set():
            break
        if not asset_id and not (
            quantities.get(asset.id, 0)
            or lasts.get(asset.id, date.min) >= (start or today - timedelta(days=90))
        ):
            continue
        config = configs.get(asset.id)
        scope = str(asset.id)
        if config and (config.mode == "MANUAL" or config.provider == "SYNTHETIC"):
            results.append(
                {
                    "asset_id": scope,
                    "status": "MANUAL" if config.mode == "MANUAL" else "SYNTHETIC",
                    "observations": 0,
                }
            )
            continue
        state = states.get(scope)
        now = datetime.now(UTC)
        if state and (
            (state.retry_at and state.retry_at > now)
            or (
                not force
                and not start
                and state.succeeded_at
                and now - state.succeeded_at < timedelta(hours=6)
            )
        ):
            results.append(
                {
                    "asset_id": scope,
                    "status": "COOLDOWN" if state.retry_at else "CACHED",
                    "observations": 0,
                }
            )
            continue
        provider_id = (
            config.provider
            if config and config.provider
            else "BRAPI"
            if asset.exchange in {"B3", "XBSP", "BVMF"}
            else "ALPHA"
        )
        count, dates = 0, []
        try:
            provider_id, instrument = resolve(
                asset, provider_id, config.symbol_override if config else None
            )
            provider = providers[provider_id]
            if provider_id == "BRAPI":
                latest = latest_batch.get(asset.id)
                if isinstance(latest, ProviderError):
                    if latest.code != "INVALID_SYMBOL":
                        raise latest
                    latest = []
                if latest is None:
                    try:
                        latest = provider.latest([instrument])
                    except ProviderError as error:
                        if error.code != "INVALID_SYMBOL":
                            raise
                        latest = []  # Delisted securities may still have raw history.
                count += save_quotes(engine, asset, provider_id, instrument, latest)
                dates.extend(q.day for q in latest)
            first = start or firsts.get(asset.id, end) - timedelta(days=7)
            cached = coverage.get((asset.id, provider_id))
            if cached and not start and cached[0] <= first + timedelta(days=7):
                first = min(end, max(first, cached[1] - timedelta(days=7)))
            history = provider.history(instrument, first, end)
            count += save_quotes(engine, asset, provider_id, instrument, history)
            dates.extend(q.day for q in history)
            usable = [q for q in history if q.convention == "RAW_CLOSE"]
            if not usable:
                raise ProviderError("RAW_HISTORY_UNAVAILABLE")
            if first < min(q.day for q in usable) - timedelta(days=7):
                raise ProviderError("PARTIAL_HISTORY")
            save_state(engine, scope, provider_id, dates=dates)
            results.append({"asset_id": scope, "status": "UPDATED", "observations": count})
        except ProviderError as error:
            save_state(engine, scope, provider_id, error, dates)
            results.append({"asset_id": scope, "status": error.code, "observations": count})
    if include_fx and prefs["fx_provider"] != "SYNTHETIC" and not (cancel and cancel.is_set()):
        state = states.get("FX")
        now = datetime.now(UTC)
        if state and (
            (state.retry_at and state.retry_at > now)
            or (
                not force
                and not start
                and state.succeeded_at
                and now - state.succeeded_at < timedelta(hours=6)
            )
        ):
            results.append({"asset_id": None, "status": "FX_CACHED", "observations": 0})
        else:
            required_start = min([*firsts.values(), first_cash_date or end]) - timedelta(days=7)
            first = start or (
                state.last_date - timedelta(days=7)
                if state
                and state.last_date
                and state.first_date
                and state.first_date <= required_start + timedelta(days=7)
                else required_start
            )
            try:
                rates = []
                cursor = first
                while cursor <= end:
                    if cancel and cancel.is_set():
                        raise ProviderError("INTERRUPTED")
                    stop = min(cursor + timedelta(days=365), end)
                    rates.extend(providers["ECB"].rates(cursor, stop))
                    cursor = stop + timedelta(days=1)
                if not rates:
                    raise ProviderError("HISTORY_UNAVAILABLE")
                with write_session(engine) as session:
                    existing = {
                        (r.rate_date, r.quote_currency): r
                        for r in session.scalars(
                            select(FXObservation).where(FXObservation.provider == "ECB")
                        )
                    }
                    for day, currency, rate in rates:
                        row = existing.get((day, currency))
                        if row is None:
                            row = FXObservation(
                                base_currency="EUR",
                                quote_currency=currency,
                                rate_date=day,
                                provider="ECB",
                            )
                            session.add(row)
                            existing[(day, currency)] = row
                        row.rate, row.fetched_at = rate, now
                    session.commit()
                save_state(engine, "FX", "ECB", dates=[r[0] for r in rates])
                results.append(
                    {"asset_id": None, "status": "FX_UPDATED", "observations": len(rates)}
                )
            except ProviderError as error:
                save_state(engine, "FX", "ECB", error)
                results.append({"asset_id": None, "status": error.code, "observations": 0})
    return {"results": results}
