"""Auth skill behavior tests."""

from fastapi.testclient import TestClient

from app.main import app


def test_auth_skill_returns_forgot_password_action() -> None:
    client = TestClient(app)
    payload = {
        "version": "v1",
        "skill": "auth",
        "requestId": "test-request-1",
        "messages": [
            {
                "role": "user",
                "content": "I forgot my password and cannot login",
            }
        ],
        "context": {
            "surface": "login",
            "locale": "en-IN",
            "email": "user@example.com",
            "metadata": {},
        },
        "allowedActions": ["auth.forgot_password", "auth.open_login"],
        "requestedAction": None,
        "requestedActionPayload": {},
    }

    response = client.post("/v1/agent/respond", json=payload)
    assert response.status_code == 200
    body = response.json()

    assert body["intent"] == "forgot_password"
    assert len(body["suggestedActions"]) >= 1
    assert body["suggestedActions"][0]["name"] == "auth.forgot_password"
