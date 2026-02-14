"""FastAPI entrypoint for the AI agent platform service."""

from __future__ import annotations

import logging
from time import perf_counter
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse

from app.config.settings import settings
from app.contracts.agent_request import AgentRequest
from app.contracts.agent_response import AgentResponse
from app.core.agent_runtime import AgentRuntime

app = FastAPI(title=settings.service_name, version=settings.api_version)
runtime = AgentRuntime()
logger = logging.getLogger("ai_agent_platform")

if not logger.handlers:
    logging.basicConfig(level=logging.INFO)

metrics_state = {
    "request_count": 0,
    "error_count": 0,
    "total_latency_ms": 0.0,
}


def _record_metrics(latency_ms: float, is_error: bool) -> None:
    metrics_state["request_count"] += 1
    metrics_state["total_latency_ms"] += latency_ms
    if is_error:
        metrics_state["error_count"] += 1


def _error_rate_percent() -> float:
    request_count = metrics_state["request_count"]
    if request_count <= 0:
        return 0.0
    return (metrics_state["error_count"] / request_count) * 100


def _avg_latency_ms() -> float:
    request_count = metrics_state["request_count"]
    if request_count <= 0:
        return 0.0
    return metrics_state["total_latency_ms"] / request_count


@app.middleware("http")
async def request_trace_middleware(request: Request, call_next):
    """Capture request id, latency, and error metrics for each request."""

    request_id = request.headers.get("x-request-id") or f"agent-{uuid4()}"
    request.state.request_id = request_id

    started = perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        latency_ms = (perf_counter() - started) * 1000
        _record_metrics(latency_ms, is_error=True)
        logger.exception(
            "request_failed path=%s request_id=%s latency_ms=%.2f",
            request.url.path,
            request_id,
            latency_ms,
        )
        raise

    latency_ms = (perf_counter() - started) * 1000
    is_error = response.status_code >= 500
    _record_metrics(latency_ms, is_error=is_error)

    if latency_ms >= settings.latency_warn_ms:
        logger.warning(
            "request_slow path=%s request_id=%s status=%s latency_ms=%.2f",
            request.url.path,
            request_id,
            response.status_code,
            latency_ms,
        )
    else:
        logger.info(
            "request_complete path=%s request_id=%s status=%s latency_ms=%.2f",
            request.url.path,
            request_id,
            response.status_code,
            latency_ms,
        )

    response.headers["x-request-id"] = request_id
    response.headers["x-agent-latency-ms"] = f"{latency_ms:.2f}"
    return response


def verify_inbound_key(
    x_agent_platform_key: str | None = Header(default=None),
) -> None:
    """Validate inbound service key when key protection is enabled."""

    if settings.inbound_api_key and x_agent_platform_key != settings.inbound_api_key:
        raise HTTPException(status_code=401, detail="Invalid agent platform key")


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError) -> JSONResponse:
    """Map deterministic runtime validation errors to 400 responses."""

    request_id = getattr(request.state, "request_id", None)
    return JSONResponse(
        status_code=400,
        content={
            "detail": str(exc),
            "requestId": request_id,
        },
    )


@app.get("/health")
def health() -> dict[str, object]:
    """Basic service health endpoint for local/dev orchestration."""

    error_rate_percent = _error_rate_percent()
    avg_latency_ms = _avg_latency_ms()
    alerting_state = (
        "warn"
        if error_rate_percent >= settings.error_rate_warn_percent
        or avg_latency_ms >= settings.latency_warn_ms
        else "healthy"
    )

    return {
        "status": "ok",
        "service": settings.service_name,
        "version": "v1",
        "registeredSkills": runtime.registered_skills(),
        "requestCount": metrics_state["request_count"],
        "errorCount": metrics_state["error_count"],
        "errorRatePercent": round(error_rate_percent, 2),
        "avgLatencyMs": round(avg_latency_ms, 2),
        "latencyWarnMs": settings.latency_warn_ms,
        "errorRateWarnPercent": settings.error_rate_warn_percent,
        "alertingState": alerting_state,
    }


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
