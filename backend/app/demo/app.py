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
from app.demo.seed import END, START
from app.error_codes import install_error_codes
from app.gmail_routes import get_service, local_request
from app.main import app as normal_app
from app.routes import DB


def create_demo_app(normal_path, root=DEFAULT_ROOT, scenario="unified", *, legacy_fixture=False):
    from app.demo.real_market_snapshot import scenario_root

    # Public startup has one complete household. Explicit older factory modes
    # survive for financial regression tests and archived workspace verification.
    roots = (
        {"unified": None}
        if scenario == "unified"
        else {
            "real-market-br": None,
            "etf-showcase": None,
            "income-showcase": None,
            "income-portfolio": None,
        }
    )
    if legacy_fixture and scenario != "unified":
        roots["synthetic"] = root

    def root_for(selected):
        if selected == "unified":
            from app.demo.unified import scenario_root as unified_root

            return unified_root(root)
        if selected == "income-portfolio":
            from app.demo.income_portfolio import scenario_root as portfolio_root

            return portfolio_root(root)
        if selected == "income-showcase":
            from app.demo.income_showcase import scenario_root as income_root

            return income_root(root)
        if selected == "etf-showcase":
            from app.demo.etf_showcase import scenario_root as showcase_root

            return showcase_root(root)
        return root if selected == "synthetic" else scenario_root(root)

    if scenario not in roots:
        raise ValueError("Unknown demo scenario")
    store = DemoStore(
        root_for(scenario),
        normal_path,
        scenario,
        household_root=scenario_root(root) if scenario == "unified" else None,
    )
    stores = {scenario: store}

    @asynccontextmanager
    async def lifespan(app):
        await run_in_threadpool(store.initialize)
        try:
            yield
        finally:
            for opened in stores.values():
                opened.close()

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
    install_error_codes(app)
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
            if path.startswith("/api/pluggy"):
                error = "Pluggy and external credential access are disabled in the demo"
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
            "profile": "Brazilian household and investment portfolio (fictional)"
            if store.scenario == "unified"
            else "Brazilian investor (fictional holdings)"
            if store.scenario == "real-market-br"
            else "Portfolio Showcase - Simulated ETFs (fictional)"
            if store.scenario == "etf-showcase"
            else "Income Showcase - Simulated ETF Distributions (fictional)"
            if store.scenario == "income-showcase"
            else "Income Portfolio - Dividend Showcase (fictional)"
            if store.scenario == "income-portfolio"
            else "Alex Morgan (fictional)",
            "start_date": START,
            "end_date": END,
            "dataset": store.version,
            "scenario": store.scenario,
            "scenarios": [
                {
                    "id": key,
                    "name": "Finance Tracker — Complete Demo"
                    if key == "unified"
                    else "Real Market Portfolio — Brazil"
                    if key == "real-market-br"
                    else "Portfolio Showcase \u2014 Simulated ETFs"
                    if key == "etf-showcase"
                    else "Income Showcase - Simulated ETF Distributions"
                    if key == "income-showcase"
                    else "Income Portfolio - Dividend Showcase"
                    if key == "income-portfolio"
                    else "Legacy regression fixture",
                }
                for key in roots
            ],
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

    class Scenario(BaseModel):
        model_config = ConfigDict(extra="forbid")
        scenario: str

    @app.post("/api/demo-control/scenario")
    def select_scenario(data: Scenario):
        nonlocal store
        if data.scenario not in roots:
            raise HTTPException(422, "Unknown demo scenario")
        if data.scenario not in stores:
            try:
                stores[data.scenario] = DemoStore(
                    root_for(data.scenario), normal_path, data.scenario
                ).initialize()
            except (ValueError, KeyError, OSError):
                raise HTTPException(
                    422, "Historical snapshot unavailable or invalid; review local setup"
                ) from None
        store = stores[data.scenario]
        app.state.demo_store = store
        return runtime()

    @app.get("/api/demo-control/market-evidence")
    def evidence(db: DB):
        from app.demo.real_market_report import report
        from app.models import DemoFixture

        fixture = db.get(DemoFixture, store.version)
        if store.scenario not in {"real-market-br", "unified"}:
            return {"enabled": False}
        return {"enabled": True, **fixture.payload["market_evidence"], **report(db)}

    @app.post("/api/demo-control/notification")
    def notification(db: DB):
        if store.scenario != "synthetic":
            raise HTTPException(
                409, "Notification examples belong to the synthetic household scenario"
            )
        batch = simulate_notification(db)
        return {"batch_id": str(batch.id), "simulation": True}

    @app.post("/api/demo-control/sample/{name}")
    def sample(name: str, db: DB):
        if store.scenario != "synthetic":
            raise HTTPException(409, "Import examples belong to the synthetic household scenario")
        if name not in sample_files():
            raise HTTPException(404, "Unknown synthetic sample")
        batch = upload_sample(db, name)
        return {"batch_id": str(batch.id)}

    @app.get("/api/demo-control/files/{name}")
    def download(name: str):
        if store.scenario != "synthetic":
            raise HTTPException(409, "Legacy import examples are not part of the Brazil portfolio")
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
