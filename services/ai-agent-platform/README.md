# AI Agent Platform Service

Python microservice that hosts reusable AI skills with a LangGraph runtime.

## Purpose

- Provide a general-purpose agent runtime for multiple app surfaces.
- Keep privileged operations in backend policy layers.
- Support both `auth` and `inbox` skills with shared contracts.

## Endpoints

- `GET /health`
- `POST /v1/agent/respond`

## Local Run

```bash
cd services/ai-agent-platform
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8100
```

Prod profile:

```bash
npx nx run ai-agent-platform:serve:prod
```

## Environment

- `AGENT_PLATFORM_INBOUND_API_KEY` (optional)
- `AGENT_PLATFORM_SERVICE_NAME` (default: `ai-agent-platform`)
- `AGENT_PLATFORM_API_VERSION` (default: `v1`)
- `AGENT_PLATFORM_LATENCY_WARN_MS` (default: `1200`)
- `AGENT_PLATFORM_ERROR_RATE_WARN_PERCENT` (default: `5.0`)

## Changelog

- 2026-02-14: Initial service scaffold with contracts, runtime, auth skill graph, and tests.
- 2026-02-15: Added inbox skill, request tracing middleware, health metrics, and alert thresholds.
