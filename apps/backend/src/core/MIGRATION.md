# Migration Plan — Strangler Fig from old modules → new core/

The legacy `apps/backend/src/<feature>/` folders are **preserved** and continue to drive the runtime via the existing `apps/backend/src/app.module.ts`. The new `core/`, `interfaces/`, `composition/` layers are wired in parallel. To switch over, follow this per-context sequence.

## Per-context switch-over recipe

For each bounded context in the order below, the team does these five steps in a single PR. Behavior is preserved at every step (no schema changes, no API changes).

1. **Adapter implementations** — write `core/infrastructure/persistence/typeorm/repositories/typeorm-<x>.repository.ts` (and any gateway adapters). The use case does not change.
2. **Composition binding** — extend `composition/modules/<context>.module.ts` with `{ provide: <X>_REPOSITORY, useClass: TypeOrm<...>Repository }`. Do **not** add the new module to `composition/app.module.ts` yet.
3. **Strangler resolver** — add a thin GraphQL resolver in `interfaces/graphql/resolvers/<context>/` that delegates to the new use case. Keep the legacy resolver alive.
4. **Switch traffic** — in the legacy `apps/backend/src/<feature>/<x>.resolver.ts`, replace one method with a delegation call to the new use case. Run e2e; if green, continue.
5. **Remove** — once all methods in the legacy resolver delegate, delete the legacy service/resolver and remove the import from `apps/backend/src/app.module.ts`. The new module is the source of truth.

## Order (smallest first, validates the wiring pattern)

| # | Context | Approx. LOC | Risk | Notes |
|---|---|---|---|---|
| 1 | `health/` | ~50 | Trivial | No business logic, no persistence. Just a `IHealthCheck` port and a GET handler. |
| 2 | `feature/` | ~300 | Low | Feature flags are simple CRUD. |
| 3 | `organization/` (labels) | ~400 | Low | Pure CRUD. |
| 4 | `phone/` | ~500 | Low | SMS is a single gateway port. |
| 5 | `contacts/` | ~600 | Low | Simple aggregate. |
| 6 | `notification/` | ~800 | Medium | Cross-cuts multiple contexts via events. |
| 7 | `billing/` | ~1,200 | Medium | Stripe webhook signature verification. |
| 8 | `workspaces/` | ~1,500 | Medium | RBAC policies are the trickiest part. |
| 9 | `automation/` | ~1,800 | High | The event bus port + the immutability rule on `AutomationVersion`. |
| 10 | `inbox/` + `unified-inbox/` | ~1,200 | High | Reads across multiple providers; needs careful event ordering. |
| 11 | `mailbox/` + `gmail-sync/` + `outlook-sync/` | ~3,500 | High | OAuth flows + Pub/Sub + token refresh. |
| 12 | `smart-replies/` + `inbox-triage/` + `sender-intelligence/` | ~2,000 | High | AI gateway + async + retries. |
| 13 | `email/` | ~6,000 | **Highest** | The 880-LOC `EmailService` god class. Largest sub-dozer of filters, templates, warmup, attachments, assignments, scheduling. |

## Risk gates (don't skip these)

- **Schema diff**: `git diff src/schema.gql` after each context switch must be empty (no new fields, no renames, no removals). The new `EmailGraphql` type may differ from the old `Email` ORM entity — but the GraphQL **shape** exposed to clients must not change.
- **Behavior diff**: run `nx test backend` and the e2e Playwright suite. Both must pass.
- **Migration diff**: if you generated any TypeORM migrations, run `npm run check:migration:contracts`.
- **Boundary diff**: `dependency-cruiser` must show 0 violations in the new code paths.

## What's already done

- ✅ Skeleton: `core/domain/shared/{result,aggregate-root,domain-event,value-objects/ids,value-objects/email-address}`.
- ✅ Skeleton: `core/application/{exceptions,ports/event-bus,ports/persistence,ports/queue,ports/observability,ports/repositories/user.repository,ports/gateways/{mail,jwt,password-hasher,oauth,ai}}`.
- ✅ Skeleton: `core/infrastructure/persistence/typeorm/{typeorm.config + 29 ORM entities + typeorm-unit-of-work + mappers/email.mapper + repositories/{typeorm-email,typeorm-user}.repository}`.
- ✅ Skeleton: `core/infrastructure/external-services/{smtp,oauth/{google,microsoft},ai}`.
- ✅ Skeleton: `core/infrastructure/{queues/bull,observability/{pino-logger,prom-metrics},crypto/{jwt-token,argon2-hasher}}`.
- ✅ Skeleton: `interfaces/{event-bus/in-process-event-bus,graphql/error-mappers/domain-error.mapper}`.
- ✅ Skeleton: `composition/{guards/jwt-auth.guard,modules/{identity,workspaces,messaging,mailbox,billing,ai,automation,notifications,observability},app.module}`.
- ✅ Boundary: `dependency-cruiser` + ESLint boundary config.
- 🔄 **In progress** (subagent-fanout): identity, messaging, workspaces+billing+contacts, mailbox+sync+ai, automation+notifications+others.

## Rollback strategy

If a context's switch-over causes a regression, revert the single PR. The legacy `apps/backend/src/<feature>/` is untouched by every other context's switch-over, so the blast radius is one bounded context.
