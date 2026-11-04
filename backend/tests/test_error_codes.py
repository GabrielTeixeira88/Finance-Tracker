from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.error_codes import install_error_codes


def test_stable_error_codes_preserve_existing_response_contract():
    app = FastAPI()
    install_error_codes(app)

    @app.get("/conflict")
    def conflict():
        raise HTTPException(409, "Synthetic conflict")

    @app.get("/validate")
    def validate(count: int):
        return count

    client = TestClient(app)
    response = client.get("/conflict")
    assert response.status_code == 409
    assert response.headers["X-Error-Code"] == "HTTP_409"
    assert response.json() == {"detail": "Synthetic conflict"}
    response = client.get("/validate?count=invalid")
    assert response.status_code == 422
    assert response.headers["X-Error-Code"] == "VALIDATION_ERROR"
    assert response.json()["detail"][0]["loc"] == ["query", "count"]
