"""Inbox skill and failure-path tests."""

from fastapi.testclient import TestClient

from app.main import app


def test_inbox_skill_returns_compose_action() -> None:
    client = TestClient(app)
    payload = {
        "version": "v1",
        "skill": "inbox",
        "requestId": "inbox-test-1",
        "messages": [
            {
                "role": "user",
                "content": "Please draft a quick reply for this thread",
            }
        ],
        "context": {
            "surface": "inbox",
            "locale": "en-IN",
            "metadata": {
                "threadId": "thread-1",
                "subject": "Q4 planning notes",
            },
        },
        "allowedActions": ["inbox.compose_reply_draft", "inbox.summarize_thread"],
        "requestedAction": None,
        "requestedActionPayload": {},
    }

    response = client.post("/v1/agent/respond", json=payload)
    assert response.status_code == 200
    body = response.json()

    assert body["skill"] == "inbox"
    assert body["intent"] == "compose_reply_draft"
    assert len(body["suggestedActions"]) >= 1
    assert body["suggestedActions"][0]["name"] == "inbox.compose_reply_draft"


def test_invalid_skill_returns_400() -> None:
    client = TestClient(app)
    payload = {
        "version": "v1",
        "skill": "unknown-skill",
        "requestId": "invalid-skill-1",
        "messages": [{"role": "user", "content": "hello"}],
        "context": {"surface": "unknown", "locale": "en-IN"},
        "allowedActions": [],
        "requestedAction": None,
        "requestedActionPayload": {},
    }

    response = client.post("/v1/agent/respond", json=payload)
    assert response.status_code == 400
    assert "unsupported skill" in response.json()["detail"]
