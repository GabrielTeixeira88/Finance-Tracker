from app.config import PROJECT_ROOT, Settings


def test_database_path_is_local_and_independent_of_working_directory(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    settings = Settings(_env_file=None, database_path="data/finance-tracker.db")
    assert settings.database_url.drivername == "sqlite+pysqlite"
    assert settings.resolved_database_path == PROJECT_ROOT / "data/finance-tracker.db"
    assert (
        Settings(_env_file=None, database_path=tmp_path / "custom.db").resolved_database_path
        == tmp_path / "custom.db"
    )
