"""FastAPI entrypoint for the AI agent platform service."""

from __future__ import annotations

from fastapi import Depends, FastAPI, Header, HTTPException

from app.config.settings import settings
from app.contracts.agent_request import AgentRequest
from app.contracts.agent_response import AgentResponse
from app.core.agent_runtime import AgentRuntime

app = FastAPI(title=settings.service_name, version=settings.api_version)
runtime = AgentRuntime()


def verify_inbound_key(
    x_agent_platform_key: str | None = Header(default=None),
) -> None:
    """Validate inbound service key when key protection is enabled."""

    if settings.inbound_api_key and x_agent_platform_key != settings.inbound_api_key:
        raise HTTPException(status_code=401, detail="Invalid agent platform key")


@app.get("/health")
def health() -> dict[str, str]:
    """Basic service health endpoint for local/dev orchestration."""

    return {"status": "ok", "service": settings.service_name, "version": "v1"}


@app.post(
    "/v1/agent/respond",
    response_model=AgentResponse,
    dependencies=[Depends(verify_inbound_key)],
)
def respond(
    request: AgentRequest,
    x_request_id: str | None = Header(default=None),
) -> AgentResponse:
    """Respond to a skill-scoped agent request."""

    # Request ID can be sourced from header or payload.
    request.requestId = x_request_id or request.requestId
    return runtime.respond(request)
