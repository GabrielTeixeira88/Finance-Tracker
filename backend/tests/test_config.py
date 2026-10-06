from app.config import Settings


def test_database_url_preserves_special_password_characters():
    settings = Settings(_env_file=None, postgres_password="fake:p@ss/%word")
    assert settings.database_url.drivername == "postgresql+psycopg"
    assert settings.database_url.password == "fake:p@ss/%word"
    assert "fake:p@ss/%word" not in repr(settings)
    assert "fake:p@ss/%word" not in str(settings.database_url)
