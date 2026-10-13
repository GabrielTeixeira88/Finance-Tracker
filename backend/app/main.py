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
from app.analytics_routes import router as analytics_router
from app.automation_routes import router as automation_router
from app.budget_routes import router as budget_router
from app.database import get_engine, get_session
from app.ingestion_routes import router as ingestion_router
from app.investment_import_routes import router as investment_import_router
from app.investment_routes import router as investment_router
from app.market_routes import router as market_router
from app.routes import router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    from app.market_scheduler import start_worker

    stop, thread = start_worker()
    yield
    stop.set()
    thread.join(timeout=20)
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
app.include_router(investment_router)
app.include_router(analytics_router)
app.include_router(market_router)
app.include_router(investment_import_router)
app.include_router(router)
app.include_router(automation_router)
app.include_router(ingestion_router)
app.include_router(budget_router)


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
