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
