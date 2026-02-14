# AI Agent Platform

## Overview

The AI Agent Platform is a Python microservice that handles agentic reasoning and skill routing.  
The Nest backend remains the policy and execution authority for privileged actions.

## Components

- `services/ai-agent-platform`: FastAPI + LangGraph runtime, skill registry, request/response contracts.
- `apps/backend/src/ai-agent-gateway`: GraphQL mutation gateway with sanitization and policy checks.
- `apps/frontend/components/ai`: Reusable assistant UI shell.
- `apps/frontend/components/auth/LoginAssistantAdapter.tsx`: Auth skill adapter for login experience.

## Request Flow

1. Frontend sends `agentAssist` mutation with chat messages, skill, and context.
2. Backend gateway sanitizes content and enforces action policy.
3. Backend forwards request to Python `/v1/agent/respond` with request ID.
4. Python skill returns `assistantText`, `intent`, `confidence`, and suggested actions.
5. Backend optionally executes approved action (example: forgot password), then returns response.

## Security Notes

- Password and token-like values are redacted before agent orchestration.
- Shared secret key can be enforced between backend and Python service.
- Action execution is constrained to backend-approved actions.

## Changelog

- 2026-02-14: Added first platform version with auth skill and login adapter integration.
