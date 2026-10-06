from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.database import get_session
from app.main import app


@pytest.fixture
def client():
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


def test_liveness_does_not_require_database(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "finance-tracker-api"}


def test_readiness_checks_database(client):
    session = Mock(spec=Session)
    app.dependency_overrides[get_session] = lambda: session
    response = client.get("/api/health/ready")
    assert response.status_code == 200
    assert response.json()["database"] == "ok"
    assert str(session.execute.call_args.args[0]) == "SELECT 1"


def test_readiness_fails_without_leaking_connection_details(client):
    session = Mock(spec=Session)
    session.execute.side_effect = OperationalError("sensitive-host", {}, Exception("secret"))
    app.dependency_overrides[get_session] = lambda: session
    response = client.get("/api/health/ready")
    assert response.status_code == 503
    assert response.json() == {"status": "unavailable"}
