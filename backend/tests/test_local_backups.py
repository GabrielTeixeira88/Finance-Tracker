"""Only temporary migrated databases; never the personal or saved demo database."""

import sqlite3
from contextlib import closing
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi import HTTPException

from app import local_backups
from app.config import Settings


@pytest.fixture
def workspace(db_engine, monkeypatch):
    settings = Settings(database_path=Path(db_engine.url.database), maintenance_mode=True)
    monkeypatch.setattr(local_backups, "get_settings", lambda: settings)
    return settings


def test_wal_backup_restore_and_recovery_snapshot(workspace):
    path = workspace.resolved_database_path
    with closing(sqlite3.connect(path)) as db:
        before = db.execute("SELECT COUNT(*) FROM categories").fetchone()
    snapshot = local_backups.create()
    with closing(sqlite3.connect(path)) as db, db:
        db.execute(
            "INSERT INTO categories(id,name) VALUES (?,?)", ("0" * 31 + "1", "Fictional changed")
        )
    result = local_backups.restore(snapshot["id"])
    assert result["restart_required"]
    with closing(sqlite3.connect(path)) as db:
        assert db.execute("SELECT COUNT(*) FROM categories").fetchone() == before
    recovery = local_backups.backup_path(result["recovery_backup"])
    with closing(sqlite3.connect(recovery)) as db:
        assert db.execute("SELECT COUNT(*) FROM categories").fetchone()[0] == before[0] + 1


def test_restore_requires_maintenance_and_rejects_path_traversal(workspace):
    snapshot = local_backups.create()
    workspace.maintenance_mode = False
    with pytest.raises(HTTPException, match="409"):
        local_backups.restore(snapshot["id"])
    with pytest.raises(HTTPException, match="404"):
        local_backups.backup_path("../finance-tracker")


def test_invalid_backup_schema_and_missing_fk_cannot_replace_database(workspace):
    path = workspace.resolved_database_path
    snapshot = local_backups.create()
    candidate = local_backups.backup_path(snapshot["id"])
    with closing(sqlite3.connect(candidate)) as db, db:
        db.execute("CREATE TABLE unwanted(secret TEXT)")
    before = path.read_bytes()
    with pytest.raises(HTTPException, match="422"):
        local_backups.restore(snapshot["id"])
    assert path.read_bytes() == before
    candidate.write_bytes(b"not a database")
    with pytest.raises(HTTPException, match="422"):
        local_backups.validate(candidate, path)


def test_publish_failure_retains_current_database_and_recovery(workspace):
    snapshot = local_backups.create()
    original_replace = local_backups.os.replace

    def fail_publish(source, destination):
        if Path(destination) == workspace.resolved_database_path:
            raise OSError("Fictional failure")
        return original_replace(source, destination)

    with patch.object(local_backups.os, "replace", side_effect=fail_publish):
        with pytest.raises(HTTPException, match="409"):
            local_backups.restore(snapshot["id"])
    assert len(list(local_backups.folder().glob("*.db"))) == 2
    with closing(sqlite3.connect(workspace.resolved_database_path)) as db:
        assert db.execute("PRAGMA integrity_check").fetchone() == ("ok",)


def test_runtime_lease_rejects_second_process_owner(tmp_path):
    with local_backups.runtime_lease(tmp_path / "fictional.db"):
        with pytest.raises(RuntimeError, match="Another Finance Tracker"):
            with local_backups.runtime_lease(tmp_path / "fictional.db"):
                pytest.fail("Second owner acquired the database")


def test_backup_admin_requires_header_and_loopback(api):
    assert api.get("/api/settings/backups").status_code == 403
    assert (
        api.post(
            "/api/settings/backups",
            headers={"X-Finance-Admin": "1", "Origin": "https://untrusted.invalid"},
        ).status_code
        == 403
    )


def test_maintenance_http_restore_upload_validation_and_financial_gate(workspace, monkeypatch):
    from fastapi.testclient import TestClient

    from app import backup_routes, config, market_scheduler
    from app.main import app

    monkeypatch.setattr(config, "get_settings", lambda: workspace)
    monkeypatch.setattr(backup_routes, "get_settings", lambda: workspace)

    def no_workers():
        pytest.fail("Integration workers must not start in maintenance")

    monkeypatch.setattr(market_scheduler, "start_worker", no_workers)
    headers = {"X-Finance-Admin": "1"}
    with TestClient(app, base_url="http://127.0.0.1:8000") as client:
        assert client.get("/api/runtime").json()["maintenance"]
        assert client.get("/api/accounts").status_code == 503
        snapshot = client.post("/api/settings/backups", headers=headers)
        assert snapshot.status_code == 201, snapshot.text
        identifier = snapshot.json()["id"]
        downloaded = client.get(f"/api/settings/backups/{identifier}/download", headers=headers)
        assert downloaded.content.startswith(b"SQLite format 3")
        assert (
            client.post(
                "/api/settings/backups/upload", content=b"fake", headers=headers
            ).status_code
            == 422
        )
        uploaded = client.post(
            "/api/settings/backups/upload", content=downloaded.content, headers=headers
        )
        assert uploaded.status_code == 201
        assert (
            client.post(
                f"/api/settings/backups/{identifier}/restore",
                json={"confirmation": "no"},
                headers=headers,
            ).status_code
            == 422
        )
        restored = client.post(
            f"/api/settings/backups/{identifier}/restore",
            json={"confirmation": "RESTORE"},
            headers=headers,
        )
        assert restored.status_code == 200, restored.text
        assert restored.json()["recovery_backup"] != identifier
        assert client.get("/api/accounts").status_code == 503
        assert not list(local_backups.folder().glob("*.upload"))


def test_backup_with_orphaned_membership_is_rejected(workspace):
    snapshot = local_backups.create()
    candidate = local_backups.backup_path(snapshot["id"])
    with closing(sqlite3.connect(candidate)) as db, db:
        db.execute(
            "INSERT INTO account_group_members(group_id,account_id) VALUES (?,?)",
            ("0" * 32, "1" * 32),
        )
    with pytest.raises(HTTPException, match="422"):
        local_backups.restore(snapshot["id"])


def test_restore_pauses_polling_without_changing_the_source_backup(workspace, db_engine):
    from sqlalchemy.orm import Session

    from app.gmail_models import GmailConnection
    from app.market_models import MarketSettings

    with Session(db_engine) as db, db.begin():
        db.add(MarketSettings(automatic=True))
        db.add(
            GmailConnection(status="CONNECTED", paused=False, mailbox="fictional@example.invalid")
        )
    db_engine.dispose()
    snapshot = local_backups.create()
    result = local_backups.restore(snapshot["id"])
    assert result["integrations_paused"]
    with closing(sqlite3.connect(workspace.resolved_database_path)) as db:
        assert db.execute("SELECT automatic FROM market_settings").fetchone() == (0,)
        assert db.execute("SELECT paused FROM gmail_connections").fetchone() == (1,)
    with closing(sqlite3.connect(local_backups.backup_path(snapshot["id"]))) as db:
        assert db.execute("SELECT automatic FROM market_settings").fetchone() == (1,)
        assert db.execute("SELECT paused FROM gmail_connections").fetchone() == (0,)
