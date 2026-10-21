"""A separately owned local workspace; reset never uses the normal engine."""

import json
import os
import re
import sqlite3
from contextlib import closing
from pathlib import Path
from uuid import uuid4

from alembic import command
from alembic.config import Config
from sqlalchemy import URL
from sqlalchemy.orm import Session

from app.config import PROJECT_ROOT
from app.database import make_engine
from app.demo.seed import VERSION, seed

DEFAULT_ROOT = PROJECT_ROOT / "data" / "demo-v012"


class DemoStore:
    def __init__(self, root: Path, normal_path: Path):
        self.root = root.absolute()
        # Refuse symlinks/junctions before any filesystem mutation.
        for path in [self.root, *self.root.parents]:
            if path.is_symlink() or path.is_junction():
                raise ValueError("Demo storage cannot use links or junctions")
        self.root = self.root.resolve()
        self.normal_path = normal_path.resolve()
        if normal_path.resolve().is_relative_to(self.root):
            raise ValueError("Normal data cannot be inside demo storage")
        self.engine = None
        self.lock_file = None

    def owned(self, name):
        path = self.root / name
        if path.is_symlink() or path.is_junction() or path.resolve().parent != self.root:
            raise ValueError("Invalid demo storage identity")
        if path.exists() and (
            path.stat().st_nlink != 1
            or (self.normal_path.exists() and path.samefile(self.normal_path))
        ):
            raise ValueError("Demo storage cannot share a file with other data")
        return path

    def initialize(self):
        self.root.mkdir(parents=True, exist_ok=True)
        marker = self.owned("owner.json")
        expected = {"application": "finance-tracker-local-demo", "version": VERSION}
        if marker.exists():
            if json.loads(marker.read_text()) != expected:
                raise ValueError("Unknown demo storage owner")
        elif any(self.root.iterdir()):
            raise ValueError("Refusing to adopt a nonempty directory")
        else:
            with marker.open("x") as stream:
                json.dump(expected, stream)
        self.lock_file = self.owned("process.lock").open("a+b")
        try:
            if os.name == "nt":
                import msvcrt

                self.lock_file.seek(0)
                self.lock_file.write(b"0")
                self.lock_file.flush()
                self.lock_file.seek(0)
                msvcrt.locking(self.lock_file.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl

                fcntl.flock(self.lock_file, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            self.lock_file.close()
            self.lock_file = None
            raise ValueError("Demo is already running; use one process") from None
        try:
            baseline = self.owned("baseline.db")
            if not baseline.exists():
                staging = self.owned(f"build-{uuid4().hex}.db")
                url = URL.create("sqlite+pysqlite", database=str(staging))
                config = Config(str(PROJECT_ROOT / "backend/alembic.ini"))
                config.attributes["database_url"] = url
                command.upgrade(config, "head")
                engine = make_engine(url)
                try:
                    with Session(engine) as session, session.begin():
                        seed(session)
                    with engine.connect() as connection:
                        connection.exec_driver_sql("PRAGMA wal_checkpoint(TRUNCATE)")
                finally:
                    engine.dispose()
                self.validate(staging)
                staging.replace(baseline)
            self.validate(baseline)
            active = self.owned("active.json")
            if active.exists():
                name = json.loads(active.read_text())["database"]
                if not re.fullmatch(r"session-[a-f0-9]{32}\.db", name):
                    raise ValueError("Invalid demo session")
                self.path = self.owned(name)
                self.validate(self.path)
                self.engine = make_engine(URL.create("sqlite+pysqlite", database=str(self.path)))
            else:
                self.reset()
            return self
        except Exception:
            self.close()
            raise

    def validate(self, path):
        path = self.owned(path.name)
        if not path.exists():
            raise ValueError("Demo database missing")
        with closing(sqlite3.connect(path.as_uri() + "?mode=ro", uri=True)) as db:
            if (
                db.execute("PRAGMA integrity_check").fetchone()[0] != "ok"
                or db.execute("PRAGMA foreign_key_check").fetchall()
            ):
                raise ValueError("Demo integrity check failed")
            if db.execute("SELECT id FROM demo_fixtures").fetchall() != [(VERSION,)]:
                raise ValueError("Not an authorized demo database")

    def reset(self):
        """Caller holds the app-wide request gate. Publish only a validated generation."""
        if self.lock_file is None:
            raise ValueError("Demo storage is not owned by this process")
        baseline = self.owned("baseline.db")
        self.validate(baseline)
        target = self.owned(f"session-{uuid4().hex}.db")
        with (
            closing(sqlite3.connect(baseline.as_uri() + "?mode=ro", uri=True)) as src,
            closing(sqlite3.connect(target)) as dst,
        ):
            src.backup(dst)
        self.validate(target)
        engine = make_engine(URL.create("sqlite+pysqlite", database=str(target)))
        pointer = self.owned("next.json")
        try:
            with pointer.open("w") as stream:
                json.dump({"database": target.name}, stream)
                stream.flush()
                os.fsync(stream.fileno())
            pointer.replace(self.owned("active.json"))
        except Exception:
            engine.dispose()
            raise
        previous = self.engine
        self.engine, self.path = engine, target
        if previous:
            previous.dispose()
        # Retain current and previous generation. Only owned UUID-named demo files qualify.
        files = sorted(
            self.root.glob("session-*.db"), key=lambda p: p.stat().st_mtime, reverse=True
        )
        for path in files[2:]:
            if path == self.path or not re.fullmatch(r"session-[a-f0-9]{32}\.db", path.name):
                continue
            try:
                self.validate(self.owned(path.name))
                for suffix in ["-wal", "-shm", ""]:
                    self.owned(path.name + suffix).unlink(missing_ok=True)
            except (OSError, ValueError, sqlite3.Error):
                # A failed cleanup cannot invalidate the already published generation.
                # Unknown files are retained, never adopted or deleted.
                continue

    def close(self):
        if self.engine:
            self.engine.dispose()
            self.engine = None
        if self.lock_file:
            self.lock_file.close()
            self.lock_file = None
