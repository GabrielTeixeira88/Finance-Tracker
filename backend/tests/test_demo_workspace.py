"""Isolated showcase integration: real migrations, services and SQLite files."""

import json
import sqlite3
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from decimal import Decimal
from pathlib import Path
from uuid import UUID

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import URL, select
from sqlalchemy.orm import Session

from app import ledger
from app.database import make_engine
from app.demo.app import create_demo_app
from app.demo.runtime import DemoStore
from app.demo.seed import seed
from app.main import app as normal_app
from app.models import Category, Transaction
from app.seed_wealth_demo import seed_wealth_demo


def snapshot(path):
    with closing(sqlite3.connect(path)) as db:
        tables = db.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
        return {
            table: sorted(map(str, db.execute(f'SELECT * FROM "{table}"').fetchall()))
            for (table,) in tables
        }


@pytest.fixture
def demo(tmp_path, monkeypatch):
    def forbidden(*_args, **_kwargs):
        raise AssertionError("Demo attempted to start a real integration or normal engine")

    monkeypatch.setattr("app.market_scheduler.start_worker", forbidden)
    monkeypatch.setattr("app.gmail_scheduler.start_worker", forbidden)
    monkeypatch.setattr("app.gmail_routes.get_engine", forbidden)
    monkeypatch.setattr("app.gmail_service.GmailService.__init__", forbidden)
    normal = tmp_path / "normal.db"
    with closing(sqlite3.connect(normal)) as db:
        db.execute("PRAGMA journal_mode=WAL")
        db.execute("CREATE TABLE sentinel (value TEXT NOT NULL)")
        db.execute("INSERT INTO sentinel VALUES ('Synthetic normal workspace; never copy')")
        db.commit()
        db.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    normal_bytes, normal_rows = normal.read_bytes(), snapshot(normal)
    app = create_demo_app(normal, tmp_path / "demo")
    with TestClient(app, base_url="http://127.0.0.1:8001") as client:
        client.headers.update(
            {
                "X-Finance-Demo": "1",
                "X-Demo-Generation": client.get("/api/runtime").json()["generation"],
            }
        )
        yield client, app.state.demo_store
    assert normal.read_bytes() == normal_bytes
    assert snapshot(normal) == normal_rows


def test_seed_full_database_determinism_and_repeat_preserves_edits(tmp_path):
    first = DemoStore(tmp_path / "one", tmp_path / "normal.db").initialize()
    second = DemoStore(tmp_path / "two", tmp_path / "normal.db").initialize()
    try:
        assert snapshot(first.path) == snapshot(second.path)
        with Session(first.engine) as db, db.begin():
            row = db.scalar(select(Transaction).where(Transaction.transaction_type == "EXPENSE"))
            row.description = "Synthetic reviewer edit"
            db.flush()
            assert seed(db) is False
        before = snapshot(first.path)
        first.close()
        first = DemoStore(tmp_path / "one", tmp_path / "normal.db").initialize()
        assert snapshot(first.path) == before
    finally:
        first.close()
        second.close()


def test_seed_refuses_even_category_only_existing_workspace(db_engine):
    with Session(db_engine) as db, db.begin():
        db.add(Category(name="Synthetic existing category"))
        db.flush()
        with pytest.raises(ValueError, match="empty"):
            seed(db)
        assert db.scalar(select(Category.name)) == "Synthetic existing category"


def test_populated_v011_copy_upgrade_preserves_all_rows(tmp_path):
    # v0.11 and v0.12 share sqlite_0013; exercise upgrade/check on a real backup.
    prior, copied = tmp_path / "prior-v011.db", tmp_path / "upgrade-copy.db"
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    url = URL.create("sqlite+pysqlite", database=str(prior))
    config.attributes["database_url"] = url
    command.upgrade(config, "sqlite_0013")
    engine = make_engine(url)
    try:
        with Session(engine) as db, db.begin():
            assert seed_wealth_demo(db)
    finally:
        engine.dispose()
    before = snapshot(prior)
    with closing(sqlite3.connect(prior)) as source, closing(sqlite3.connect(copied)) as target:
        source.backup(target)
    config.attributes["database_url"] = URL.create("sqlite+pysqlite", database=str(copied))
    command.upgrade(config, "head")
    command.check(config)
    assert snapshot(copied) == before
    assert snapshot(prior) == before


def test_reset_restores_baseline_and_rejects_stale_writes(demo):
    client, store = demo
    baseline = snapshot(store.path)
    response = client.post("/api/categories", json={"name": "Synthetic edit"})
    assert response.status_code == 201, response.text
    assert snapshot(store.path) != baseline
    reset = client.post("/api/demo-control/reset", json={"confirmation": "RESET FICTIONAL DEMO"})
    assert reset.status_code == 200
    assert snapshot(store.path) == baseline
    assert client.post("/api/categories", json={"name": "Stale"}).status_code == 409
    client.headers["X-Demo-Generation"] = reset.json()["generation"]
    assert client.post("/api/categories", json={"name": "Fresh"}).status_code == 201
    for _ in range(3):
        reset = client.post(
            "/api/demo-control/reset", json={"confirmation": "RESET FICTIONAL DEMO"}
        )
        assert reset.status_code == 200
        client.headers["X-Demo-Generation"] = reset.json()["generation"]
        assert snapshot(store.path) == baseline


def test_reset_failure_keeps_edits_and_pointer(demo, monkeypatch):
    client, store = demo
    client.post("/api/categories", json={"name": "Keep edit"})
    before, path = snapshot(store.path), store.path
    original = store.validate

    def invalid(path):
        if path.name.startswith("session-") and path != store.path:
            raise ValueError("Injected validation failure before publication")
        return original(path)

    monkeypatch.setattr(store, "validate", invalid)
    with pytest.raises(ValueError):
        store.reset()
    assert store.path == path
    assert json.loads((store.root / "active.json").read_text())["database"] == path.name
    assert snapshot(store.path) == before


def test_concurrent_reset_and_writer_are_serialized(demo):
    client, store = demo
    with ThreadPoolExecutor(2) as pool:
        write = pool.submit(client.post, "/api/categories", json={"name": "Concurrent edit"})
        reset = pool.submit(
            client.post, "/api/demo-control/reset", json={"confirmation": "RESET FICTIONAL DEMO"}
        )
        assert write.result().status_code in {201, 409}
        assert reset.result().status_code == 200
    assert snapshot(store.path) == snapshot(store.root / "baseline.db")


def test_normal_reset_absent_and_normal_routes_untouched(api, tmp_path):
    overrides = dict(normal_app.dependency_overrides)
    create_demo_app(tmp_path / "normal.db", tmp_path / "demo")
    assert normal_app.dependency_overrides == overrides
    assert api.get("/api/runtime").json() == {"mode": "normal"}
    assert api.post("/api/demo-control/reset", json={}).status_code == 404


def test_reject_unknown_root_paths_links_and_process_sharing(tmp_path):
    root, normal = tmp_path / "demo", tmp_path / "normal.db"
    with pytest.raises(ValueError):
        DemoStore(root, root / "normal.db")
    root.mkdir()
    (root / "foreign.txt").write_text("must survive")
    with pytest.raises(ValueError):
        DemoStore(root, normal).initialize()
    assert (root / "foreign.txt").read_text() == "must survive"
    store = DemoStore(tmp_path / "safe", normal).initialize()
    try:
        with pytest.raises(ValueError):
            store.owned("../normal.db")
        with pytest.raises(ValueError):
            DemoStore(tmp_path / "safe", normal).initialize()
        normal.write_text("private")
        linked = store.root / "linked.db"
        linked.hardlink_to(normal)
        with pytest.raises(ValueError):
            store.owned(linked.name)
        assert normal.read_text() == "private"
    finally:
        store.close()


def test_external_services_and_untrusted_requests_blocked(demo):
    client, _ = demo
    for path in [
        "/api/gmail",
        "/api/gmail/labels",
        "/api/gmail/oauth/start",
        "/api/market-data/status",
        "/api/market-data/sync",
    ]:
        assert client.get(path).status_code in {403, 404, 405}
        assert client.post(path, json={}).status_code == 403
    assert (
        client.get("/api/accounts", headers={"Origin": "https://evil.invalid"}).status_code == 403
    )
    assert client.get("/api/accounts", headers={"Host": "evil.invalid"}).status_code == 403
    assert (
        client.post(
            "/api/categories", json={"name": "No header"}, headers={"X-Finance-Demo": ""}
        ).status_code
        == 403
    )
    assert (
        client.post(
            "/api/demo-control/reset",
            json={
                "confirmation": "RESET FICTIONAL DEMO",
                "path": "../normal.db",
            },
        ).status_code
        == 422
    )
    assert client.get("/api/health/ready").status_code == 200


def test_financial_dataset_coverage_and_real_analytics(demo):
    client, store = demo
    data = snapshot(store.path)
    assert 700 <= len(data["transactions"]) <= 1200
    assert len(data["financial_accounts"]) == 7
    assert len(data["investment_activities"]) == 28
    assert len(data["budget_targets"]) == 13
    assert len(data["schedules"]) == 6
    assert len(data["goals"]) == 5
    assert len(data["gmail_connections"]) == 0
    accounts = client.get("/api/accounts").json()
    assert all(Decimal(a["balance"]) >= 0 for a in accounts if a["type"] != "CREDIT_CARD")
    with Session(store.engine) as db:
        balances = ledger.balances(db)
        assert all(Decimal(a["balance"]) == balances[UUID(a["id"])] for a in accounts)
    performance = client.get(
        "/api/investments/analytics/performance?start=2024-10-01&end=2026-09-30"
    ).json()
    assert performance["twr"]["quality"] == "COMPLETE", performance
    assert performance["xirr"]["value"] is not None
    wealth = client.get("/api/net-worth/history?start=2026-09-01&end=2026-09-30")
    assert wealth.status_code == 200, wealth.text


def test_notification_parser_review_and_idempotent_evidence(demo):
    client, store = demo
    before = snapshot(store.path)
    created = client.post("/api/demo-control/notification").json()
    assert client.post("/api/demo-control/notification").json() == created
    assert snapshot(store.path)["transactions"] == before["transactions"]
    queue = client.get("/api/gmail/queue").json()
    assert len(queue) == 1
    batch = queue[0]
    result = client.post(
        "/api/gmail/approve",
        json={
            "items": [
                {
                    "batch_id": batch["id"],
                    "preview_token": batch["preview_token"],
                }
            ]
        },
    )
    assert result.status_code == 200, result.text
    assert len(snapshot(store.path)["transactions"]) == len(before["transactions"]) + 1
    with closing(sqlite3.connect(store.path)) as db:
        assert (
            db.execute(
                "SELECT count(*) FROM source_records WHERE transaction_id IN "
                "(SELECT transaction_id FROM source_records GROUP BY transaction_id "
                "HAVING count(*)=2)"
            ).fetchone()[0]
            == 2
        )
        assert db.execute("PRAGMA foreign_key_check").fetchall() == []


def test_downloads_are_allowlisted_synthetic_and_preview_only(demo):
    client, store = demo
    before = snapshot(store.path)["transactions"]
    for name in ["demo-checking.csv", "demo-credit-card.csv", "demo-checking.ofx"]:
        response = client.get(f"/api/demo-control/files/{name}")
        assert response.status_code == 200
        assert "synthetic" in response.text.lower()
        assert client.post(f"/api/demo-control/sample/{name}").status_code == 200
    assert client.get("/api/demo-control/files/normal.db").status_code == 404
    assert snapshot(store.path)["transactions"] == before
