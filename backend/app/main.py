from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Annotated, Literal

from fastapi import Depends, FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.automation_routes import router as automation_router
from app.database import get_engine, get_session
from app.ingestion_routes import router as ingestion_router
from app.routes import router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    yield
    if get_engine.cache_info().currsize:
        get_engine().dispose()
        get_engine.cache_clear()


app = FastAPI(
    title="Finance Tracker API",
    version="0.1.0",
    lifespan=lifespan,
    telemetry={
        "tracing": False,
        "metrics": False,
        "logs": False,
        "operation_spans": False,
        "auto_configure": False,
    },
)
app.include_router(router)
app.include_router(automation_router)
app.include_router(ingestion_router)


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
