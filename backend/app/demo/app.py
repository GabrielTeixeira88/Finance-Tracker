"""Local-only demo app factory. No normal lifespan, engine, vault or sync worker."""

import asyncio
from contextlib import asynccontextmanager
from urllib.parse import urlsplit

from fastapi import APIRouter, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app._version import __version__
from app.config import PROJECT_ROOT
from app.database import get_session
from app.demo.runtime import DEFAULT_ROOT, DemoStore
from app.demo.scenarios import sample_files, simulate_notification, upload_sample
from app.demo.seed import END, START, VERSION
from app.gmail_routes import get_service, local_request
from app.main import app as normal_app
from app.routes import DB


def create_demo_app(normal_path, root=DEFAULT_ROOT):
    store = DemoStore(root, normal_path)

    @asynccontextmanager
    async def lifespan(app):
        await run_in_threadpool(store.initialize)
        try:
            yield
        finally:
            store.close()

    app = FastAPI(
        title="Finance Tracker — Local Fictional Demo",
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
    app.state.demo_store = store
    gate = asyncio.Lock()

    def session():
        with Session(store.engine) as db:
            yield db

    app.dependency_overrides[get_session] = session
    app.dependency_overrides[local_request] = lambda: None

    def forbidden_service():
        raise HTTPException(403, "External Gmail services are disabled in demo mode")

    app.dependency_overrides[get_service] = forbidden_service

    class IsolationMiddleware:
        def __init__(self, app):
            self.app = app

        async def __call__(self, scope, receive, send):
            if scope["type"] != "http":
                return await self.app(scope, receive, send)
            request = Request(scope)
            host = urlsplit("http://" + request.headers.get("host", "")).hostname
            origin = request.headers.get("origin")
            allowed = {
                "http://127.0.0.1:8001",
                "http://localhost:8001",
                "http://127.0.0.1:5174",
                "http://localhost:5174",
            }
            error = None
            status = 403
            writing = request.method not in {"GET", "HEAD", "OPTIONS"}
            if host not in {"localhost", "127.0.0.1", "::1"} or (origin and origin not in allowed):
                error = "Demo requires an approved local origin"
            elif writing and request.headers.get("x-finance-demo") != "1":
                error = "Demo writes require the local application header"
            path = request.url.path
            if path.startswith("/api/gmail") and not (
                path in {"/api/gmail/queue", "/api/gmail/approve"}
                or path.startswith("/api/gmail/candidates/")
            ):
                error = "Real Gmail is disabled. Use Notification Simulation."
            if path.startswith("/api/market-data") and (
                writing or path == "/api/market-data/status"
            ):
                error = (
                    "External integrations are disabled; use synthetic history or manual prices."
                )

            async def uncached(message):
                if message["type"] == "http.response.start":
                    message.setdefault("headers", []).append((b"cache-control", b"no-store"))
                await send(message)

            # Hold through dependency cleanup and response completion, not just headers.
            async with gate:
                if (
                    writing
                    and not error
                    and request.headers.get("x-demo-generation") != store.path.stem
                ):
                    error = "Demo was reset. Reload before making further changes."
                    status = 409
                if error:
                    return await JSONResponse(status_code=status, content={"detail": error})(
                        scope, receive, uncached
                    )
                await self.app(scope, receive, uncached)

    app.add_middleware(IsolationMiddleware)

    @app.get("/api/runtime")
    def runtime():
        return {
            "mode": "local_demo",
            "profile": "Alex Morgan (fictional)",
            "start_date": START,
            "end_date": END,
            "dataset": VERSION,
            "generation": store.path.stem,
            "hosted": False,
        }

    class Reset(BaseModel):
        model_config = ConfigDict(extra="forbid")
        confirmation: str

    @app.post("/api/demo-control/reset")
    def reset(data: Reset):
        if data.confirmation != "RESET FICTIONAL DEMO":
            raise HTTPException(422, "Confirm reset of fictional demo only")
        store.reset()
        return runtime()

    @app.post("/api/demo-control/notification")
    def notification(db: DB):
        batch = simulate_notification(db)
        return {"batch_id": str(batch.id), "simulation": True}

    @app.post("/api/demo-control/sample/{name}")
    def sample(name: str, db: DB):
        if name not in sample_files():
            raise HTTPException(404, "Unknown synthetic sample")
        batch = upload_sample(db, name)
        return {"batch_id": str(batch.id)}

    @app.get("/api/demo-control/files/{name}")
    def download(name: str):
        files = sample_files()
        if name not in files:
            raise HTTPException(404, "Unknown synthetic sample")
        return Response(
            files[name],
            media_type="text/plain",
            headers={"Content-Disposition": f'attachment; filename="{name}"'},
        )

    # include_router clones routes with this app's dependency overrides; normal app is untouched.
    # A new router copies routes only, never normal startup/shutdown workers.
    app.include_router(
        APIRouter(
            routes=[
                route
                for route in normal_app.router.routes
                if getattr(route, "path", None)
                not in {
                    "/api/runtime",
                    "/openapi.json",
                    "/docs",
                    "/docs/oauth2-redirect",
                    "/redoc",
                }
            ]
        )
    )
    dist = PROJECT_ROOT / "frontend/dist"
    if dist.is_dir():
        app.mount("/", StaticFiles(directory=dist, html=True), name="demo-ui")
    return app
