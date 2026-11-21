from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import URL, inspect, text

from app.database import make_engine


def test_populated_0018_upgrade_preserves_all_existing_rows_and_backfills_archives(tmp_path):
    url = URL.create("sqlite+pysqlite", database=str(tmp_path / "synthetic-goal-upgrade.db"))
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    config.attributes["database_url"] = url
    command.upgrade(config, "sqlite_0018")
    engine = make_engine(url)
    with engine.begin() as db:
        db.execute(
            text(
                "INSERT INTO goals "
                "(id,name,mode,currency,target,start_date,deadline,status,notes,archived_date,"
                "created_at,updated_at) VALUES "
                "('11111111111111111111111111111111','Fictional archived course','MANUAL','BRL',"
                "'000000000000001000000000','2025-01-01','2027-01-01','ARCHIVED','',"
                "'2026-01-01','2025-01-01','2026-01-01')"
            )
        )
    with engine.connect() as db:
        tables = [t for t in inspect(db).get_table_names() if t != "alembic_version"]
        before = {t: list(db.execute(text(f'SELECT * FROM "{t}" ORDER BY rowid'))) for t in tables}
    command.upgrade(config, "head")
    command.check(config)
    with engine.connect() as db:
        for table in tables:
            assert (
                list(db.execute(text(f'SELECT * FROM "{table}" ORDER BY rowid'))) == before[table]
            )
        assert db.scalar(text("SELECT status FROM goal_lifecycle")) == "ARCHIVED"
        assert not list(db.execute(text("PRAGMA foreign_key_check")))
        assert db.scalar(text("PRAGMA integrity_check")) == "ok"
    engine.dispose()
