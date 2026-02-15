# MailZen Backend

## Overview

MailZen backend is a NestJS GraphQL API for multi-provider email workflows
(Gmail, Outlook, and custom SMTP), analytics, warmup automation, smart replies,
and inbox management.

## Tech Stack

- Framework: NestJS + TypeScript
- API: GraphQL (Apollo)
- Database: PostgreSQL
- ORM: TypeORM
- Queues: Bull
- Cache: Redis
- Testing: Jest

## Project Structure

```text
src/
  app.module.ts
  auth/
  contacts/
  email/
  email-analytics/
  email-integration/
  feature/
  gmail-sync/
  inbox/
  mailbox/
  organization/
  phone/
  scheduled-email/
  smart-replies/
  template/
  workspace/
  unified-inbox/
  user/
  database/
    typeorm.config.ts
    data-source.ts
    migrations/
```

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Create env file:

```bash
cp .env.example .env
```

3. Ensure `DATABASE_URL` points to PostgreSQL.

4. Run migrations:

```bash
npm run migration:run
```

5. Start development server:

```bash
npm run start:dev
```

## Database Workflow

TypeORM is configured with a hybrid policy:

- Local development: schema sync can be enabled (default local behavior).
- Non-local environments (CI/staging/prod): use migrations.

### Migration Commands

```bash
# Create an empty migration
npm run migration:create --name=add-new-table

# Generate migration from entity changes
npm run migration:generate --name=sync-email-indexes

# Apply migrations
npm run migration:run

# Revert latest migration
npm run migration:revert

# List migration status
npm run migration:show
```

## Common Scripts

```bash
npm run build
npm run test
npm run lint
npm run check:schema:contracts
npm run mailbox:inbound:signature -- --mailboxEmail "sales@mailzen.com" --from "lead@example.com"
```

## References

- NestJS: https://nestjs.com
- TypeORM: https://typeorm.io
- GraphQL: https://graphql.org
- PostgreSQL: https://www.postgresql.org
