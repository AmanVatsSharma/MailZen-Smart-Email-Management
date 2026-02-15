# TypeORM Usage Guide

## Purpose

This guide documents the backend TypeORM setup and the standard patterns for
services, modules, and migrations.

## Configuration

- Runtime config: `src/database/typeorm.config.ts`
- CLI DataSource: `src/database/data-source.ts`
- Migration folder: `src/database/migrations`

### Runtime Rules

- Local development can use schema sync.
- Non-local environments must use migrations.
- `DATABASE_URL` is required.

## Module Pattern

```typescript
@Module({
  imports: [TypeOrmModule.forFeature([EmailProvider, ExternalEmailMessage])],
  providers: [MyService, MyResolver],
  exports: [MyService],
})
export class MyModule {}
```

## Service Pattern

```typescript
@Injectable()
export class MyService {
  constructor(
    @InjectRepository(MyEntity)
    private readonly myEntityRepo: Repository<MyEntity>,
  ) {}

  async listForUser(userId: string) {
    return this.myEntityRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }
}
```

## Query Patterns

### Find one

```typescript
await userRepo.findOne({ where: { id } });
```

### Create + save

```typescript
const entity = repo.create(payload);
return repo.save(entity);
```

### Update

```typescript
await repo.update(id, { status: 'ACTIVE' });
```

### Delete

```typescript
await repo.delete(id);
```

### Relations

```typescript
await emailRepo.find({
  where: { userId },
  relations: ['provider', 'analytics'],
});
```

### QueryBuilder

```typescript
return messageRepo
  .createQueryBuilder('m')
  .where('m.userId = :userId', { userId })
  .orderBy('m.internalDate', 'DESC')
  .take(limit)
  .skip(offset)
  .getMany();
```

## Migration Commands

```bash
# Create empty migration
npm run migration:create --name=add-email-index

# Generate from entity changes
npm run migration:generate --name=email-schema-update

# Apply
npm run migration:run

# Revert last
npm run migration:revert

# Show status
npm run migration:show
```

## Production Checklist

- `synchronize` disabled
- migrations reviewed and committed
- migration run validated in CI
- build + test passing before deploy

## Workspace Scope Rollout Notes (2026-02-15)

New migration: `20260215161000-workspace-scoping-and-entitlements.ts`

This migration introduces:

- `workspaces` table
- `workspace_members` table
- `users.activeWorkspaceId`
- `email_providers.workspaceId`
- `mailboxes.workspaceId`
- `billing_plans.workspaceLimit`

### Safe rollout sequence

1. Deploy backend image containing migration and code.
2. Run `npm run migration:run` before shifting traffic.
3. Validate migration status with `npm run migration:show`.
4. Run smoke checks:
   - `npm run check:schema:contracts`
   - `npm run build`
5. Run backfill command for existing users/resources:
   - default dry run: `npm run backfill:workspace-scopes`
   - apply changes: `npm run backfill:workspace-scopes:apply`
6. Verify workspace-aware GraphQL paths:
   - `myWorkspaces`
   - `myActiveWorkspace`
   - `setActiveWorkspace`
   - `providers(workspaceId)`
   - `myMailboxes(workspaceId)`

### Staging verification SQL (post-backfill)

Run these in staging DB to verify backfill outcomes:

```sql
-- Users should have active workspace after backfill
SELECT COUNT(*) AS users_without_active_workspace
FROM users
WHERE "activeWorkspaceId" IS NULL;

-- Providers/mailboxes should be workspace-tagged
SELECT COUNT(*) AS providers_without_workspace
FROM email_providers
WHERE "workspaceId" IS NULL;

SELECT COUNT(*) AS mailboxes_without_workspace
FROM mailboxes
WHERE "workspaceId" IS NULL;

-- Personal workspace cardinality sanity check (one personal per user expected)
SELECT "ownerUserId", COUNT(*) AS personal_workspace_count
FROM workspaces
WHERE "isPersonal" = true
GROUP BY "ownerUserId"
HAVING COUNT(*) > 1;
```
