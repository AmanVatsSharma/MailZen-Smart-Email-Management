# Question Module

## Goal

Expose a guarded placeholder endpoint while Question-domain implementation is pending.

## Responsibilities

- Provide authenticated `questionModuleStatus` query
- Reserve module boundary for future Question domain services/entities

## GraphQL API

- `questionModuleStatus`: returns current module readiness status string

## Flow

```mermaid
flowchart TD
  Client[Authenticated GraphQL client] --> Resolver[QuestionResolver]
  Resolver --> Guard[JwtAuthGuard]
  Guard --> Resolver
  Resolver --> Client
```

## Notes

- This module is intentionally minimal and acts as a future expansion point.
