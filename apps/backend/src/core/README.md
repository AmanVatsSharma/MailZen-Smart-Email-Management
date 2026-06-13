# Backend Architecture (Clean / Onion)

The backend is organized as a **Clean Architecture / Onion** project. The dependency rule is strict:
**source code dependencies point only inward**, never outward.

## Layers

```
┌─────────────────────────────────────────────────────────┐
│ composition/          NestJS wiring — the only DI site  │  ← outer
├─────────────────────────────────────────────────────────┤
│ interfaces/           GraphQL resolvers, HTTP, error    │
│                       mappers, in-process event bus     │
├─────────────────────────────────────────────────────────┤
│ core/infrastructure/  TypeORM adapters, SMTP, OAuth,    │
│                       Bull queue, crypto, observability │
├─────────────────────────────────────────────────────────┤
│ core/application/     Use-case handlers, ports,         │
│                       DTOs, policies, decorators        │
├─────────────────────────────────────────────────────────┤
│ core/domain/          Aggregates, value objects,        │
│                       domain events, shared kernel      │  ← inner
└─────────────────────────────────────────────────────────┘
```

## Hard rules (enforced by `dependency-cruiser` + ESLint)

- `core/domain/**` cannot import from `@nestjs/*`, `typeorm`, `graphql`, `@apollo/*`, `interfaces/`, `infrastructure/`, `composition/`.
- `core/application/**` cannot import from `core/infrastructure/`, `interfaces/`, or `composition/`.
- `core/infrastructure/**` cannot import from `interfaces/`.

## Folders

| Path | Purpose |
|---|---|
| `core/domain/shared/` | Cross-context primitives: `Result<T,E>`, `AggregateRoot<T>`, `DomainEvent`, branded IDs, `EmailAddress` VO |
| `core/domain/bounded-contexts/<name>/` | One folder per context. Each contains its aggregates, VOs, and events. |
| `core/application/ports/` | Interfaces the outer layers must implement. Has matching `Symbol` tokens. |
| `core/application/use-cases/<context>/<action>/` | One folder per use case: `*.handler.ts`, `*.dto.ts`, `*.spec.ts`. |
| `core/application/policies/` | Cross-cutting rules: `PlanGatePolicy`, `FeatureFlagPolicy`. |
| `core/application/decorators/` | `@Timed`, `@Traced`, `@CurrentUser`. |
| `core/application/guards/` | `JwtAuthGuardMarker` (real binding in `composition/`). |
| `core/infrastructure/persistence/typeorm/` | All ORM entities + repository adapters + mappers. |
| `core/infrastructure/external-services/` | Adapters for SMTP, OAuth, AI, SMS, Pub/Sub. |
| `core/infrastructure/queues/bull/` | Bull-backed job queue adapter. |
| `core/infrastructure/observability/` | Pino logger, Prom metrics. |
| `core/infrastructure/crypto/` | argon2, JWT, AES. |
| `interfaces/graphql/` | Thin resolvers, scalars, error mapper, directives. |
| `interfaces/http/` | REST controllers (OAuth callbacks, webhooks, tracking pixel). |
| `interfaces/event-bus/` | In-process RxJS event bus (impl of `IEventBus`). |
| `composition/modules/` | One NestJS module per bounded context that wires ports to adapters. |
| `composition/app.module.ts` | Imports only `composition/modules/*`. |
| `core/testing/` | In-memory fakes for ports. Use these in `*.spec.ts`. |

## Adding a new use case (3-step recipe)

1. **Define the port** (if it doesn't exist) in `core/application/ports/`.
2. **Write the handler** in `core/application/use-cases/<context>/<action>/`. Inject ports via `@Inject(SYMBOL)`.
3. **Bind the port in composition** by adding the adapter to the relevant `composition/modules/<context>.module.ts`.

## Adding a new bounded context (4-step recipe)

1. Create `core/domain/bounded-contexts/<name>/` with the aggregate, VOs, events.
2. Create `core/application/use-cases/<name>/` with handlers + DTOs + specs.
3. Create `core/application/ports/repositories/<name>.repository.ts` (port).
4. Create `core/infrastructure/persistence/typeorm/repositories/typeorm-<name>.repository.ts` (adapter).
5. Create `composition/modules/<name>.module.ts` (wiring). Add the import to `composition/app.module.ts`.

## Testing

Use-case tests are pure. No NestJS test module. No DB. No HTTP. Just the handler + fakes from `core/testing/`:

```ts
import { FakeUnitOfWork, FakeEventBus } from '../testing';
import { InMemoryXxxRepository } from '../testing';
import { XxxHandler } from './xxx.handler';

it('works', async () => {
  const handler = new XxxHandler(new InMemoryXxxRepository(), new FakeUnitOfWork(), new FakeEventBus());
  const result = await handler.execute({...}, { userId, workspaceId });
  expect(result.isOk()).toBe(true);
});
```

## Migration status

The legacy `apps/backend/src/<feature>/` folders are **preserved** and continue to drive the runtime via the existing `apps/backend/src/app.module.ts`. The new `core/`, `interfaces/`, `composition/` layers are wired in parallel and ready for incremental cutover. See `MIGRATION.md` for the per-context switch-over plan.
