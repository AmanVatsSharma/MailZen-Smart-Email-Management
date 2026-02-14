# AI Agent Gateway Module

Backend gateway that exposes `agentAssist` GraphQL mutation and connects to the Python AI Agent Platform service.

## Responsibilities

- Validate and sanitize inbound assistant requests.
- Enforce skill and action policy boundaries.
- Propagate request IDs and service auth headers to Python runtime.
- Execute approved privileged actions (currently `auth.forgot_password`) safely in backend.
- Provide `agentPlatformHealth` GraphQL probe with gateway metrics snapshot.

## Env Variables

- `AI_AGENT_PLATFORM_URL` (default `http://localhost:8100`)
- `AI_AGENT_PLATFORM_KEY` (optional shared secret)
- `AI_AGENT_PLATFORM_TIMEOUT_MS` (default `4000`)
- `AI_AGENT_PLATFORM_RETRIES` (default `1`)
- `AI_AGENT_PLATFORM_CHECK_ON_STARTUP` (default `true`)
- `AI_AGENT_PLATFORM_REQUIRED` (default `false`)
- `AI_AGENT_GATEWAY_RATE_LIMIT` (default `40` requests/minute/IP)
- `AI_AGENT_GATEWAY_USE_REDIS` (default `true`)
- `AI_AGENT_GATEWAY_REDIS_URL` (fallback to `REDIS_URL`)
- `AI_AGENT_ALERT_LATENCY_MS` (default `1500`)
- `AI_AGENT_ALERT_ERROR_RATE_PERCENT` (default `5`)

## Changelog

- 2026-02-14: Added initial GraphQL gateway, policy enforcement, retries, and request-ID propagation.
- 2026-02-15: Added skill access policy map, Redis-backed rate limiting, and health metrics query.
