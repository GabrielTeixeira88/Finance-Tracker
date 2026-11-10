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
    def __init__(
        self, root: Path, normal_path: Path, scenario="real-market-br", *, household_root=None
    ):
        if scenario not in {
            "synthetic",
            "real-market-br",
            "etf-showcase",
            "income-showcase",
            "income-portfolio",
            "unified",
        }:
            raise ValueError("Unknown demo scenario")
        self.scenario = scenario
        self.version, self.seed = VERSION, seed
        self.household_root = household_root
        if scenario == "unified":
            from app.demo.unified import VERSION as unified_version
            from app.demo.unified import seed as unified_seed

            self.version, self.seed = unified_version, unified_seed
        if scenario == "real-market-br":
            from app.demo.real_market import VERSION as market_version
            from app.demo.real_market import seed as market_seed

            self.version, self.seed = market_version, market_seed
        if scenario == "etf-showcase":
            from app.demo.etf_showcase import VERSION as showcase_version
            from app.demo.etf_showcase import seed as showcase_seed

            self.version, self.seed = showcase_version, showcase_seed
        if scenario == "income-showcase":
            from app.demo.income_showcase import VERSION as income_version
            from app.demo.income_showcase import seed as income_seed

            self.version, self.seed = income_version, income_seed
        if scenario == "income-portfolio":
            from app.demo.income_portfolio import VERSION as portfolio_version
            from app.demo.income_portfolio import seed as portfolio_seed

            self.version, self.seed = portfolio_version, portfolio_seed
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
        expected = {"application": "finance-tracker-local-demo", "version": self.version}
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
            if baseline.exists():
                self.validate(baseline)
            if not baseline.exists() or self.revision(baseline) in {
                "sqlite_0013",
                "sqlite_0014",
                "sqlite_0015",
                "sqlite_0016",
                "sqlite_0017",
                "sqlite_0018",
                "sqlite_0019",
                "sqlite_0020",
            }:
                staging = self.owned(f"build-{uuid4().hex}.db")
                url = URL.create("sqlite+pysqlite", database=str(staging))
                config = Config(str(PROJECT_ROOT / "backend/alembic.ini"))
                config.attributes["database_url"] = url
                command.upgrade(config, "head")
                engine = make_engine(url)
                try:
                    with Session(engine) as session, session.begin():
                        self.seed(session)
                    with engine.connect() as connection:
                        connection.exec_driver_sql("PRAGMA wal_checkpoint(TRUNCATE)")
                finally:
                    engine.dispose()
                self.validate(staging)
                if baseline.exists():
                    self.backup(baseline, self.owned(f"baseline-archive-{uuid4().hex}.db"))
                staging.replace(baseline)
            self.validate(baseline)
            if self.needs_content_upgrade(baseline):
                staging = self.owned(f"build-{uuid4().hex}.db")
                self.extend_content_copy(baseline, staging)
                self.backup(baseline, self.owned(f"baseline-archive-{uuid4().hex}.db"))
                staging.replace(baseline)
            active = self.owned("active.json")
            if active.exists():
                name = json.loads(active.read_text())["database"]
                if not re.fullmatch(r"session-[a-f0-9]{32}\.db", name):
                    raise ValueError("Invalid demo session")
                self.path = self.owned(name)
                self.validate(self.path)
                if self.revision(self.path) in {
                    "sqlite_0013",
                    "sqlite_0014",
                    "sqlite_0015",
                    "sqlite_0016",
                    "sqlite_0017",
                    "sqlite_0018",
                    "sqlite_0019",
                    "sqlite_0020",
                }:
                    # Upgrade a copy, preserving edits and the prior generation on failure.
                    target = self.owned(f"session-{uuid4().hex}.db")
                    self.backup(self.path, target)
                    config = Config(str(PROJECT_ROOT / "backend/alembic.ini"))
                    config.attributes["database_url"] = URL.create(
                        "sqlite+pysqlite", database=str(target)
                    )
                    command.upgrade(config, "head")
                    self.validate(target)
                    pointer = self.owned("next.json")
                    with pointer.open("w") as stream:
                        json.dump({"database": target.name}, stream)
                        stream.flush()
                        os.fsync(stream.fileno())
                    pointer.replace(active)
                    self.path = target
                if self.needs_content_upgrade(self.path):
                    target = self.owned(f"session-{uuid4().hex}.db")
                    self.extend_content_copy(self.path, target)
                    pointer = self.owned("next.json")
                    with pointer.open("w") as stream:
                        json.dump({"database": target.name}, stream)
                        stream.flush()
                        os.fsync(stream.fileno())
                    pointer.replace(active)
                    self.path = target
                self.engine = make_engine(URL.create("sqlite+pysqlite", database=str(self.path)))
            elif not self.resume_household():
                self.reset()
            return self
        except Exception:
            self.close()
            raise

    def revision(self, path):
        with closing(sqlite3.connect(path.as_uri() + "?mode=ro", uri=True)) as db:
            return db.execute("SELECT version_num FROM alembic_version").fetchone()[0]

    def needs_content_upgrade(self, path):
        """Read only the ownership marker; never adopt arbitrary local financial files."""
        if self.scenario != "unified":
            return False
        from app.demo import (
            audit_content,
            dashboard_content,
            goal_content,
            holdings_activities,
            performance_content,
            settings_content,
            spending_content,
        )

        self.validate(path)
        with closing(sqlite3.connect(path.as_uri() + "?mode=ro", uri=True)) as db:
            payload = json.loads(
                db.execute(
                    "SELECT payload FROM demo_fixtures WHERE id = ?", (self.version,)
                ).fetchone()[0]
            )
        needs_upgrade = False
        for extension in (
            holdings_activities,
            spending_content,
            goal_content,
            performance_content,
            dashboard_content,
            settings_content,
            audit_content,
        ):
            version = payload.get(extension.MARKER, 0)
            if not isinstance(version, int) or version > extension.CONTENT_VERSION:
                raise ValueError("Unknown unified demo content version")
            needs_upgrade |= version < extension.CONTENT_VERSION
        return needs_upgrade

    def extend_content_copy(self, source, target):
        """Extend a backup atomically; a failure leaves original rows and pointers untouched."""
        from app.demo import (
            audit_content,
            dashboard_content,
            goal_content,
            holdings_activities,
            performance_content,
            settings_content,
            spending_content,
        )

        self.validate(source)
        self.backup(source, target)
        engine = make_engine(URL.create("sqlite+pysqlite", database=str(target)))
        try:
            with Session(engine) as session, session.begin():
                holdings_activities.extend(session)
                spending_content.extend(session)
                goal_content.extend(session)
                performance_content.extend(session)
                dashboard_content.extend(session)
                settings_content.extend(session)
                audit_content.extend(session)
            with engine.connect() as connection:
                connection.exec_driver_sql("PRAGMA wal_checkpoint(TRUNCATE)")
        finally:
            engine.dispose()
        self.validate(target)

    def resume_household(self):
        """Extend a backup of the prior owned demo; never mutate the source or personal DB."""
        if self.scenario != "unified" or self.household_root is None:
            return False
        source = DemoStore(self.household_root, self.normal_path, "real-market-br")
        if not source.root.exists():
            return False
        marker, active = source.owned("owner.json"), source.owned("active.json")
        if not marker.exists() or not active.exists():
            raise ValueError("Existing household workspace has no validated active generation")
        if json.loads(marker.read_text()) != {
            "application": "finance-tracker-local-demo",
            "version": source.version,
        }:
            raise ValueError("Unknown household workspace owner")
        name = json.loads(active.read_text())["database"]
        if not re.fullmatch(r"session-[a-f0-9]{32}\.db", name):
            raise ValueError("Invalid household session")
        original = source.owned(name)
        source.validate(original)
        target = self.owned(f"session-{uuid4().hex}.db")
        self.backup(original, target)
        config = Config(str(PROJECT_ROOT / "backend/alembic.ini"))
        config.attributes["database_url"] = URL.create("sqlite+pysqlite", database=str(target))
        command.upgrade(config, "head")
        engine = make_engine(config.attributes["database_url"])
        try:
            from app.demo.unified import extend

            with Session(engine) as session, session.begin():
                extend(session)
            with engine.connect() as connection:
                connection.exec_driver_sql("PRAGMA wal_checkpoint(TRUNCATE)")
            self.validate(target)
            pointer = self.owned("next.json")
            with pointer.open("w") as stream:
                json.dump({"database": target.name}, stream)
                stream.flush()
                os.fsync(stream.fileno())
            pointer.replace(self.owned("active.json"))
        except Exception:
            engine.dispose()
            raise
        self.engine, self.path = engine, target
        return True

    def backup(self, source, target):
        with (
            closing(sqlite3.connect(source.as_uri() + "?mode=ro", uri=True)) as src,
            closing(sqlite3.connect(target)) as dst,
        ):
            src.backup(dst)

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
            if db.execute("SELECT id FROM demo_fixtures").fetchall() != [(self.version,)]:
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
