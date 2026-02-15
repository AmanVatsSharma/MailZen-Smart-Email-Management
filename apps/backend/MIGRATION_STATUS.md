# TypeORM Adoption Status

## Current Status

- ORM: TypeORM only
- Runtime services: TypeORM repositories and query builders
- Tests: migrated service specs use repository mocks via `getRepositoryToken`
- Tooling: TypeORM CLI scripts and DataSource added under `src/database`

## Completed Work

- Centralized runtime DB config in `src/database/typeorm.config.ts`
- Added TypeORM DataSource in `src/database/data-source.ts`
- Added migration scripts in `package.json`
- Added baseline migration marker in `src/database/migrations`
- Added workspace scope + entitlement migration:
  - `20260215161000-workspace-scoping-and-entitlements.ts`
- Added mailbox inbound threading migration:
  - `20260215193000-mailbox-inbound-threading.ts`
- Added mailbox inbound idempotency event-store migration:
  - `20260215202000-mailbox-inbound-events.ts`
- Added mailbox inbound notification preference migration:
  - `20260216001000-notification-mailbox-inbound-preferences.ts`
- Added mailbox inbound SLA threshold preference migration:
  - `20260216003000-notification-mailbox-inbound-sla-thresholds.ts`
- Updated service specs that previously used legacy ORM mocks
- Removed stale ORM references from backend docs/modules

## Environment Policy

- Local dev: schema sync allowed (controlled by env)
- CI/staging/prod: migration-first workflow

## Verification Checklist

- `npm run migration:show` executes successfully
- `npm run migration:run` applies pending migrations
- `npm run build` succeeds
- backend unit tests pass for migrated specs
- repository scan shows no legacy ORM references

## Next Maintenance Steps

- Keep `synchronize` disabled outside local development
- Generate migration for each schema change before release
- Run migration checks in CI before deployment
- Ensure workspace seeding/backfill strategy is executed in production:
  - create personal workspace rows for existing users
  - assign `workspaceId` to existing providers/mailboxes
  - run `npm run backfill:workspace-scopes` (dry run), then `npm run backfill:workspace-scopes:apply`
  - execute post-backfill verification SQL checks from `TYPEORM_MIGRATION.md`
