import json
import tomllib
from pathlib import Path

from app._version import __version__
from app.main import app


def test_release_metadata_stays_synchronized():
    root = Path(__file__).resolve().parents[2]
    project = tomllib.loads((root / "backend/pyproject.toml").read_text())
    assert project["tool"]["hatch"]["version"]["path"] == "app/_version.py"
    package = json.loads((root / "frontend/package.json").read_text())
    lock = json.loads((root / "frontend/package-lock.json").read_text())
    assert package["version"] == lock["version"] == lock["packages"][""]["version"]
    assert package["version"] == app.version == __version__
    uv = tomllib.loads((root / "backend/uv.lock").read_text())
    # uv omits the version for projects using dynamic Hatch metadata.
    locked = next(p for p in uv["package"] if p["name"] == "finance-tracker-backend")
    assert "version" not in locked
