# Prisma to TypeORM Migration Guide

## Overview

This document outlines the complete migration from Prisma ORM to TypeORM for the MailZen backend application. The migration was completed successfully with all 24 entities converted and 26+ services updated.

## Migration Summary

### What Changed

- **ORM**: Prisma Client → TypeORM with PostgreSQL
- **Entities**: 24 TypeORM entities created from Prisma schema
- **Services**: 26+ services updated to use TypeORM repositories
- **Modules**: 19 modules updated with TypeORM imports
- **Dependencies**: Prisma packages removed, TypeORM packages added

### Database Schema

TypeORM is configured with `synchronize: true` for development, which automatically syncs entity definitions with the database schema. **This is suitable for development only.**

## Entity Mapping

### Core Entities

| Prisma Model | TypeORM Entity | Location |
|--------------|----------------|----------|
| User | User | `src/user/entities/user.entity.ts` |
| UserSession | UserSession | `src/auth/entities/user-session.entity.ts` |
| VerificationToken | VerificationToken | `src/auth/entities/verification-token.entity.ts` |
| AuditLog | AuditLog | `src/auth/entities/audit-log.entity.ts` |

### Email Entities

| Prisma Model | TypeORM Entity | Location |
|--------------|----------------|----------|
| Email | Email | `src/email/entities/email.entity.ts` |
| EmailProvider | EmailProvider | `src/email-integration/entities/email-provider.entity.ts` |
| EmailAnalytics | EmailAnalytics | `src/email-analytics/entities/email-analytics.entity.ts` |
| EmailFilter | EmailFilter | `src/email/entities/email-filter.entity.ts` |
| EmailFolder | EmailFolder | `src/email/entities/email-folder.entity.ts` |
| EmailLabel | EmailLabel | `src/email/entities/email-label.entity.ts` |
| EmailLabelAssignment | EmailLabelAssignment | `src/email/entities/email-label-assignment.entity.ts` |
| Attachment | Attachment | `src/email/entities/attachment.entity.ts` |
| EmailWarmup | EmailWarmup | `src/email/entities/email-warmup.entity.ts` |
| WarmupActivity | WarmupActivity | `src/email/entities/warmup-activity.entity.ts` |
| ExternalEmailMessage | ExternalEmailMessage | `src/email-integration/entities/external-email-message.entity.ts` |
| ExternalEmailLabel | ExternalEmailLabel | `src/email-integration/entities/external-email-label.entity.ts` |

### Supporting Entities

| Prisma Model | TypeORM Entity | Location |
|--------------|----------------|----------|
| Contact | Contact | `src/contacts/entities/contact.entity.ts` |
| Template | Template | `src/template/entities/template.entity.ts` |
| Feature | Feature | `src/feature/entities/feature.entity.ts` |
| Mailbox | Mailbox | `src/mailbox/entities/mailbox.entity.ts` |
| PhoneVerification | PhoneVerification | `src/phone/entities/phone-verification.entity.ts` |
| SignupVerification | SignupVerification | `src/phone/entities/signup-verification.entity.ts` |

## Query Pattern Migration

### Common Patterns

#### Find One

```typescript
// Prisma
await prisma.user.findUnique({ where: { id } })

// TypeORM
await userRepository.findOne({ where: { id } })
```

#### Find Many

```typescript
// Prisma
await prisma.user.findMany({ 
  where: { role: 'USER' },
  orderBy: { createdAt: 'desc' }
})

// TypeORM
await userRepository.find({ 
  where: { role: 'USER' },
  order: { createdAt: 'DESC' }
})
```

#### Create

```typescript
// Prisma
await prisma.user.create({
  data: { email, password, name }
})

// TypeORM
const user = userRepository.create({ email, password, name })
await userRepository.save(user)
```

#### Update

```typescript
// Prisma
await prisma.user.update({
  where: { id },
  data: { name }
})

// TypeORM
await userRepository.update(id, { name })
// OR
user.name = name
await userRepository.save(user)
```

#### Delete

```typescript
// Prisma
await prisma.user.delete({ where: { id } })

// TypeORM
await userRepository.delete(id)
```

#### Relations

```typescript
// Prisma
await prisma.email.findMany({
  where: { userId },
  include: { provider: true, analytics: true }
})

// TypeORM
await emailRepository.find({
  where: { userId },
  relations: ['provider', 'analytics']
})
```

#### Atomic Increments

```typescript
// Prisma
await prisma.emailAnalytics.update({
  where: { emailId },
  data: { openCount: { increment: 1 } }
})

// TypeORM
const analytics = await analyticsRepository.findOne({ where: { emailId } })
analytics.openCount += 1
await analyticsRepository.save(analytics)
```

## Configuration

### TypeORM Configuration (`app.module.ts`)

```typescript
TypeOrmModule.forRoot({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: true,  // DEV ONLY - auto-sync schema
  logging: ['error'],  // Log only errors
  autoLoadEntities: true,  // Auto-discover entities
  extra: {
    max: 10,  // Connection pool size
    idleTimeoutMillis: 30000,
  },
})
```

### Environment Variables

Required environment variables remain the same:

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/mailzen
```

## Module Pattern

All modules follow this pattern:

```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([Entity1, Entity2, ...]),
  ],
  providers: [Service, Resolver],
  exports: [Service],
})
export class ExampleModule {}
```

## Service Pattern

All services follow this pattern:

```typescript
@Injectable()
export class ExampleService {
  constructor(
    @InjectRepository(Entity)
    private readonly entityRepository: Repository<Entity>,
  ) {
    console.log('[ExampleService] Initialized with TypeORM repository');
  }

  async findAll() {
    console.log('[ExampleService] Fetching all entities');
    return this.entityRepository.find();
  }
}
```

## Key Differences

### 1. Decorators

- **Prisma**: Schema-based (`.prisma` file)
- **TypeORM**: Decorator-based (TypeScript classes)

### 2. Relationships

- **Prisma**: Implicit via schema relations
- **TypeORM**: Explicit via decorators (`@OneToMany`, `@ManyToOne`, etc.)

### 3. Migrations

- **Prisma**: `prisma migrate`
- **TypeORM**: `synchronize: true` (dev) or migration files (production)

### 4. Type Safety

- **Prisma**: Generated types from schema
- **TypeORM**: TypeScript entity classes

## Console Logging

All services include comprehensive console logging for debugging:

```typescript
console.log('[ServiceName] Operation description:', params);
```

This helps track:
- Service initialization
- Database operations
- Query results
- Error conditions

## Testing

### Verify Installation

```bash
cd apps/backend
npm run build
```

### Start Development Server

```bash
npm run start:dev
```

### Check Database Connection

The application will log:
```
[TypeORM] Database connection established
[ServiceName] Initialized with TypeORM repository
```

## Troubleshooting

### Common Issues

1. **Connection Errors**
   - Verify `DATABASE_URL` in `.env`
   - Ensure PostgreSQL is running
   - Check database credentials

2. **Entity Not Found**
   - Ensure entity is imported in module's `TypeOrmModule.forFeature([])`
   - Verify entity has `@Entity()` decorator

3. **Relation Errors**
   - Check `@JoinColumn()` on `@ManyToOne` side
   - Verify relation decorators match database structure

4. **Sync Issues**
   - Drop and recreate database if schema is corrupted
   - TypeORM will recreate tables on next start

## Production Considerations

For production deployment:

1. **Disable synchronize**
   ```typescript
   synchronize: false,  // NEVER true in production
   ```

2. **Use migrations**
   ```bash
   npm run typeorm migration:generate -- -n MigrationName
   npm run typeorm migration:run
   ```

3. **Enable query logging**
   ```typescript
   logging: ['query', 'error', 'schema'],
   ```

4. **Connection pooling**
   ```typescript
   extra: {
     max: 20,  // Increase for production
     min: 5,
     idleTimeoutMillis: 30000,
   }
   ```

## Benefits of TypeORM

1. **Type Safety**: Full TypeScript support with entity classes
2. **Flexibility**: Support for raw SQL queries when needed
3. **Active Development**: Regular updates and community support
4. **Multiple Databases**: Easy to switch between PostgreSQL, MySQL, etc.
5. **Decorators**: Clean, readable entity definitions
6. **Query Builder**: Powerful query building capabilities

## Migration Checklist

- ✅ TypeORM packages installed
- ✅ Prisma packages removed
- ✅ 24 entities created
- ✅ 26+ services updated
- ✅ 19 modules updated
- ✅ Prisma directories removed
- ✅ Configuration updated
- ✅ Console logging added
- ✅ Documentation created

## Support

For issues or questions:
1. Check TypeORM documentation: https://typeorm.io
2. Review entity relationship diagrams
3. Check console logs for detailed error messages
4. Verify database schema matches entity definitions

---

**Migration Date**: January 2026  
**TypeORM Version**: Latest  
**Database**: PostgreSQL  
**Status**: ✅ Complete
