# Template Module

## Goal

Provide reusable email templates with admin-managed CRUD operations.

## Responsibilities

- Maintain template catalog in service memory (current implementation)
- Expose authenticated read operations
- Restrict create/update/delete operations to admin users

## GraphQL API

- `getAllTemplates`
- `getTemplate(id)`
- `createTemplate(createTemplateInput)` (admin-only)
- `updateTemplate(updateTemplateInput)` (admin-only)
- `deleteTemplate(id)` (admin-only)

## Flow

```mermaid
flowchart TD
  Client[Authenticated GraphQL client] --> Resolver[TemplateResolver]
  Resolver --> JwtGuard[JwtAuthGuard]
  Resolver -->|admin mutations| AdminGuard[AdminGuard]
  Resolver --> Service[TemplateService]
  Service --> Memory[(In-memory template array)]
  Memory --> Service
  Service --> Resolver
  Resolver --> Client
```

## Notes

- Template persistence is currently in-memory; data resets on backend restart.
- Module is structured so storage can be migrated to TypeORM with minimal API changes.
- Structured observability events:
  - `template_create_start`
  - `template_create_completed`
  - `template_list_completed`
  - `template_get_missing`
  - `template_update_start`
  - `template_update_completed`
  - `template_delete_start`
  - `template_delete_missing`
  - `template_delete_completed`
