# AI Agent Gateway Module

Backend gateway that exposes `agentAssist` GraphQL mutation and connects to the Python AI Agent Platform service.

## Responsibilities

- Validate and sanitize inbound assistant requests.
- Enforce skill and action policy boundaries.
- Propagate request IDs and service auth headers to Python runtime.
- Execute approved privileged actions safely in backend:
  - `auth.forgot_password`
  - `inbox.summarize_thread` (authenticated, ownership-scoped thread summary)
  - `inbox.compose_reply_draft` (authenticated, ownership-scoped draft generation)
  - `inbox.schedule_followup` (authenticated follow-up reminder notification)
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
- 2026-02-15: Added executable inbox actions:
  - `inbox.summarize_thread`
  - `inbox.compose_reply_draft`
  - `inbox.schedule_followup`
  with thread-aware summary/draft generation from synced messages.
- 2026-02-15: Enriched follow-up action notifications with workspace/provider
  context metadata (`workspaceId`, `providerId`) for workspace-aware UX.
