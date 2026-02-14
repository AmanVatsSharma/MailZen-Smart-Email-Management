# AI Agent Gateway Module

Backend gateway that exposes `agentAssist` GraphQL mutation and connects to the Python AI Agent Platform service.

## Responsibilities

- Validate and sanitize inbound assistant requests.
- Enforce skill and action policy boundaries.
- Propagate request IDs and service auth headers to Python runtime.
- Execute approved privileged actions (currently `auth.forgot_password`) safely in backend.

## Env Variables

- `AI_AGENT_PLATFORM_URL` (default `http://localhost:8100`)
- `AI_AGENT_PLATFORM_KEY` (optional shared secret)
- `AI_AGENT_PLATFORM_TIMEOUT_MS` (default `4000`)
- `AI_AGENT_PLATFORM_RETRIES` (default `1`)
- `AI_AGENT_GATEWAY_RATE_LIMIT` (default `40` requests/minute/IP)

## Changelog

- 2026-02-14: Added initial GraphQL gateway, policy enforcement, retries, and request-ID propagation.
