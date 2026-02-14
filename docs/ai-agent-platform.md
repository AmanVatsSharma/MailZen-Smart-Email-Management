# AI Agent Platform

## Overview

The AI Agent Platform is a Python microservice that handles agentic reasoning and skill routing.  
The Nest backend remains the policy and execution authority for privileged actions.

## Components

- `services/ai-agent-platform`: FastAPI + LangGraph runtime, skill registry, request/response contracts.
- `apps/backend/src/ai-agent-gateway`: GraphQL mutation gateway with sanitization and policy checks.
- `apps/frontend/components/ai`: Reusable assistant UI shell.
- `apps/frontend/components/auth/LoginAssistantAdapter.tsx`: Auth skill adapter for login experience.
- `apps/frontend/components/email/InboxAssistantAdapter.tsx`: Inbox skill adapter for inbox workspace.
- `apps/frontend/lib/voice/voice-io.ts`: Browser voice I/O abstraction for assistant surfaces.

## Request Flow

1. Frontend sends `agentAssist` mutation with chat messages, skill, and context.
2. Backend gateway sanitizes content, enforces access/rate/action policy, and traces request IDs.
3. Backend forwards request to Python `/v1/agent/respond` with request ID.
4. Python skill returns `assistantText`, `intent`, `confidence`, and suggested actions.
5. Backend optionally executes approved action (example: forgot password), then returns response.

## Security Notes

- Password and token-like values are redacted before agent orchestration.
- Shared secret key can be enforced between backend and Python service.
- Action execution is constrained to backend-approved actions.
- Auth skill is public; non-auth skills (for example inbox) require valid auth token.

## Observability

- Frontend attaches `x-request-id` per GraphQL call through Apollo link middleware.
- Backend logs structured lifecycle events with `requestId`, skill, latency, and failure state.
- Python middleware emits request-level logs and returns `x-request-id` and `x-agent-latency-ms`.
- Backend exposes `agentPlatformHealth` query with gateway metrics and platform availability.

## Alert Thresholds

- Backend:
  - `AI_AGENT_ALERT_LATENCY_MS` (default `1500`)
  - `AI_AGENT_ALERT_ERROR_RATE_PERCENT` (default `5`)
- Python:
  - `AGENT_PLATFORM_LATENCY_WARN_MS` (default `1200`)
  - `AGENT_PLATFORM_ERROR_RATE_WARN_PERCENT` (default `5.0`)

## Runtime Profiles

- Dev full stack: `npm run dev:full`
- Dev backend + platform only: `npm run dev:platform`
- Dev platform only: `npm run dev:ai-agent`
- Prod platform profile: `npm run start:ai-agent:prod`

## Changelog

- 2026-02-14: Added first platform version with auth skill and login adapter integration.
- 2026-02-15: Added inbox skill, Redis-ready rate limiting, health probe query, request tracing, and voice I/O abstraction.
