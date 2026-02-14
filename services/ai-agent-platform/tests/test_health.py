"""Health endpoint tests."""

from fastapi.testclient import TestClient

from app.main import app


def test_health_endpoint() -> None:
    client = TestClient(app)
    response = client.get("/health", headers={"x-request-id": "health-test-1"})

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert "registeredSkills" in body
    assert "auth" in body["registeredSkills"]
    assert response.headers["x-request-id"] == "health-test-1"
