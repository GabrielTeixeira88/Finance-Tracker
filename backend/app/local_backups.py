"""WAL-consistent local backups. Restore is deliberately maintenance-mode only."""

import os
import re
import shutil
import sqlite3
import time
from contextlib import closing, contextmanager
from datetime import UTC, datetime
from urllib.parse import quote
from uuid import uuid4

from fastapi import HTTPException

from app.config import get_settings

MAX_BYTES = 128 * 1024 * 1024
BACKUP_ID = re.compile(r"^[0-9a-f]{32}$")


@contextmanager
def runtime_lease(path):
    """One API process per database, including maintenance, across OS processes."""
    path.parent.mkdir(parents=True, exist_ok=True)
    lease = path.with_suffix(path.suffix + ".runtime-lock")
    with lease.open("a+b") as handle:
        if lease.stat().st_size == 0:
            handle.write(b"0")
            handle.flush()
        handle.seek(0)
        try:
            if os.name == "nt":
                import msvcrt

                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl

                fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            raise RuntimeError("Another Finance Tracker process owns this database") from None
        try:
            yield
        finally:
            handle.seek(0)
            if os.name == "nt":
                import msvcrt

                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                import fcntl

                fcntl.flock(handle.fileno(), fcntl.LOCK_UN)


def folder():
    database = get_settings().resolved_database_path
    root = database.parent / (database.stem + ".backups")
    if root.is_symlink():
        raise HTTPException(409, "Backup storage must not be a symbolic link")
    root.mkdir(mode=0o700, parents=True, exist_ok=True)
    return root


def backup_path(identifier):
    if not BACKUP_ID.fullmatch(identifier):
        raise HTTPException(404, "Backup not found")
    path = folder() / (identifier + ".db")
    if not path.is_file() or path.is_symlink():
        raise HTTPException(404, "Backup not found")
    return path


def metadata(path):
    stat = path.stat()
    return {
        "id": path.stem,
        "bytes": stat.st_size,
        "created_at": datetime.fromtimestamp(stat.st_mtime, UTC).isoformat(),
    }


@contextmanager
def connect(path, readonly=True):
    uri = "file:" + quote(path.as_posix(), safe="/:") + ("?mode=ro" if readonly else "?mode=rw")
    connection = sqlite3.connect(uri, uri=True, timeout=5)
    connection.execute("PRAGMA trusted_schema=OFF")
    connection.execute("PRAGMA busy_timeout=5000")
    deadline = time.monotonic() + 15
    connection.set_progress_handler(lambda: int(time.monotonic() > deadline), 10000)
    try:
        yield connection
    finally:
        connection.close()


def copy_database(source, destination):
    deadline = time.monotonic() + 15

    def progress(_status, _remaining, _total):
        if time.monotonic() > deadline:
            raise HTTPException(409, "Database backup timed out; no data was replaced")

    source.backup(destination, pages=256, progress=progress, sleep=0.05)


def schema(connection):
    return connection.execute(
        "SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' "
        "ORDER BY type,name"
    ).fetchall()


def validate(candidate, current):
    with candidate.open("rb") as file:
        header = file.read(16)
    if candidate.stat().st_size > MAX_BYTES or header != b"SQLite format 3\x00":
        raise HTTPException(422, "Invalid or oversized SQLite backup")
    try:
        with connect(candidate) as source, connect(current) as live:
            if source.execute("PRAGMA integrity_check").fetchall() != [("ok",)]:
                raise ValueError
            if source.execute("PRAGMA foreign_key_check").fetchone():
                raise ValueError
            if schema(source) != schema(live):
                raise ValueError
            if (
                source.execute("SELECT version_num FROM alembic_version").fetchall()
                != live.execute("SELECT version_num FROM alembic_version").fetchall()
            ):
                raise ValueError
    except (sqlite3.Error, ValueError):
        raise HTTPException(
            422, "Backup integrity or schema differs; no data was replaced"
        ) from None


def create():
    source = get_settings().resolved_database_path
    if not source.is_file() or source.is_symlink():
        raise HTTPException(409, "Initialize the local database before making a backup")
    if source.stat().st_size > MAX_BYTES:
        raise HTTPException(413, "Database exceeds the in-app backup limit")
    root = folder()
    if shutil.disk_usage(root).free < MAX_BYTES * 3:
        raise HTTPException(507, "Insufficient free space for a safe backup")
    target = root / (uuid4().hex + ".db")
    staging = target.with_suffix(".staging")
    try:
        with connect(source) as src, closing(sqlite3.connect(staging)) as dst:
            copy_database(src, dst)
        os.chmod(staging, 0o600)
        validate(staging, source)
        os.replace(staging, target)
        return metadata(target)
    except sqlite3.Error:
        raise HTTPException(409, "Unable to create a consistent backup") from None
    finally:
        staging.unlink(missing_ok=True)


def pause_restored_integrations(path):
    """A restored snapshot must not silently resume old polling against current vault tokens."""
    from sqlalchemy import URL, update
    from sqlalchemy.orm import Session

    from app.database import make_engine
    from app.gmail_models import GmailConnection
    from app.market_models import MarketSettings

    engine = make_engine(URL.create("sqlite+pysqlite", database=str(path)))
    try:
        with Session(engine) as session, session.begin():
            session.execute(update(MarketSettings).values(automatic=False))
            session.execute(update(GmailConnection).values(paused=True))
    finally:
        engine.dispose()
    with connect(path, readonly=False) as database:
        if database.execute("PRAGMA wal_checkpoint(TRUNCATE)").fetchone()[0]:
            raise HTTPException(409, "Unable to checkpoint the staged restore")
        database.execute("PRAGMA journal_mode=DELETE")


def restore(identifier):
    if not get_settings().maintenance_mode:
        raise HTTPException(
            409, "Stop the server, restart with MAINTENANCE_MODE=true, then restore"
        )
    current = get_settings().resolved_database_path
    source = backup_path(identifier)
    validate(source, current)
    # No normal requests or integration workers exist in maintenance. Revalidate before publication.
    from app.database import get_engine

    if get_engine.cache_info().currsize:
        get_engine().dispose()
        get_engine.cache_clear()
    recovery = create()
    staging = current.with_name(current.name + ".restore-" + uuid4().hex)
    try:
        with connect(source) as src, closing(sqlite3.connect(staging)) as dst:
            copy_database(src, dst)
        pause_restored_integrations(staging)
        validate(staging, current)
        with connect(current, readonly=False) as db:
            if db.execute("PRAGMA wal_checkpoint(TRUNCATE)").fetchone()[0] != 0:
                raise HTTPException(
                    409, "Database is in use; stop other database tools before restoring"
                )
            db.execute("PRAGMA journal_mode=DELETE")
        os.chmod(staging, 0o600)
        os.replace(staging, current)
        return {
            "restored": identifier,
            "recovery_backup": recovery["id"],
            "restart_required": True,
            "integrations_paused": True,
        }
    except (OSError, sqlite3.Error):
        # os.replace is atomic: on publication failure the current file is retained.
        raise HTTPException(
            409, "Restore could not be published; recovery backup retained"
        ) from None
    finally:
        staging.unlink(missing_ok=True)
