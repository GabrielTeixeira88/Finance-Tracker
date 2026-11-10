from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Annotated, Literal

from fastapi import Depends, FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app._version import __version__
from app.allocation_routes import router as allocation_router
from app.analytics_routes import router as analytics_router
from app.automation_routes import router as automation_router
from app.backup_routes import router as backup_router
from app.budget_routes import router as budget_router
from app.database import get_engine, get_session
from app.error_codes import install_error_codes
from app.fixed_income_routes import router as fixed_income_router
from app.gmail_routes import router as gmail_router
from app.ingestion_routes import router as ingestion_router
from app.investment_import_routes import router as investment_import_router
from app.investment_routes import router as investment_router
from app.life_event_routes import router as life_event_router
from app.market_routes import router as market_router
from app.pluggy_routes import router as pluggy_router
from app.reconciliation_routes import router as reconciliation_router
from app.routes import router
from app.settings_routes import router as settings_router
from app.wealth_routes import router as wealth_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    from app.config import get_settings
    from app.local_backups import runtime_lease

    with runtime_lease(get_settings().resolved_database_path):
        async with normal_lifespan(app):
            yield


@asynccontextmanager
async def normal_lifespan(app: FastAPI) -> AsyncIterator[None]:
    from app.config import get_settings

    if get_settings().maintenance_mode:
        yield
        return
    from app.market_scheduler import start_worker

    stop, thread = start_worker()
    from app.gmail_scheduler import start_worker as start_gmail_worker

    gmail_stop, gmail_thread = start_gmail_worker()
    yield
    gmail_stop.set()
    gmail_thread.join(timeout=2)
    from app.gmail_routes import get_service

    if get_service.cache_info().currsize:
        get_service().stop.set()
        get_service().oauth_stop.set()
        get_service.cache_clear()
    stop.set()
    thread.join(timeout=20)
    from app.pluggy_routes import cached_service

    if cached_service.cache_info().currsize:
        cached_service().provider.clear()
        cached_service.cache_clear()
    if get_engine.cache_info().currsize:
        get_engine().dispose()
        get_engine.cache_clear()


app = FastAPI(
    title="Finance Tracker API",
    version=__version__,
    lifespan=lifespan,
    telemetry={
        "tracing": False,
        "metrics": False,
        "logs": False,
        "operation_spans": False,
        "auto_configure": False,
    },
)
install_error_codes(app)
app.include_router(fixed_income_router)
app.include_router(investment_router)
app.include_router(analytics_router)
app.include_router(allocation_router)
app.include_router(market_router)
app.include_router(investment_import_router)
app.include_router(router)
app.include_router(automation_router)
app.include_router(ingestion_router)
app.include_router(budget_router)
app.include_router(gmail_router)
app.include_router(reconciliation_router)
app.include_router(wealth_router)
app.include_router(life_event_router)
app.include_router(pluggy_router)
app.include_router(settings_router)
app.include_router(backup_router)


class MaintenanceGate:
    """Maintenance never runs financial routes, workers or concurrent backup operations."""

    def __init__(self, app):
        import asyncio

        self.app = app
        self.lock = asyncio.Lock()

    async def __call__(self, scope, receive, send):
        from app.config import get_settings

        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        path = scope["path"]
        if (
            get_settings().maintenance_mode
            and path.startswith("/api/")
            and not (
                path in {"/api/health", "/api/runtime"} or path.startswith("/api/settings/backups")
            )
        ):
            return await JSONResponse(
                {"detail": "Database maintenance in progress"}, status_code=503
            )(scope, receive, send)
        if path.startswith("/api/settings/backups"):
            async with self.lock:
                return await self.app(scope, receive, send)
        return await self.app(scope, receive, send)


app.add_middleware(MaintenanceGate)


@app.get("/api/runtime")
def runtime():
    from app.config import get_settings

    return {"mode": "normal", **({"maintenance": True} if get_settings().maintenance_mode else {})}


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    service: Literal["finance-tracker-api"] = "finance-tracker-api"


class ReadyResponse(HealthResponse):
    database: Literal["ok"] = "ok"


@app.get("/api/health", response_model=HealthResponse, tags=["health"])
def health() -> HealthResponse:
    """Process liveness, deliberately independent of database availability."""
    return HealthResponse()


@app.get("/api/health/ready", response_model=ReadyResponse, tags=["health"])
def ready(session: Annotated[Session, Depends(get_session)]) -> ReadyResponse | JSONResponse:
    """Readiness requires a successful query against the local SQLite file."""
    try:
        session.execute(text("SELECT 1"))
    except SQLAlchemyError:
        return JSONResponse(status_code=503, content={"status": "unavailable"})
    return ReadyResponse()
