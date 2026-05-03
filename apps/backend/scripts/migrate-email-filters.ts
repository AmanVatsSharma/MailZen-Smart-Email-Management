/**
 * File:        apps/backend/scripts/migrate-email-filters.ts
 * Module:      Automation Engine · One-time migration runner
 * Purpose:     Bootstrap NestJS context, call AutomationMigrationFromFilterService.migrateAll(),
 *              and print results. Run once per environment when deploying the Automation Engine.
 *
 * Exports:
 *   - none (standalone script, invoked via ts-node)
 *
 * Depends on:
 *   - AutomationMigrationFromFilterService — migration logic
 *   - AppModule                            — full DI context (DB, Bull, etc.)
 *
 * Side-effects:
 *   - DB writes: creates automations + automation_versions rows for each unmigrated EmailFilter
 *   - Idempotent: skips filters already tagged [migrated:<id>] in automation.description
 *
 * Key invariants:
 *   - Pass --dry-run to see what would be migrated without writing to DB
 *   - Pass --workspace-id <id> to migrate filters for a specific workspace only
 *   - Pass --user-id <id> to migrate filters owned by a specific user only
 *   - All migrated automations enter as DISABLED (Architecture Invariant #2)
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/migrate-email-filters.ts [flags]
 *   Flags:
 *     --dry-run              Show what would be migrated without writing
 *     --workspace-id <uuid>  Scope to one workspace
 *     --user-id <uuid>       Scope to one user
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-03
 */

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AutomationMigrationFromFilterService } from '../src/automation/automation-migration-from-filter.service';

const parseArgs = () => {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  const workspaceIdIdx = args.indexOf('--workspace-id');
  const workspaceId = workspaceIdIdx !== -1 ? args[workspaceIdIdx + 1] : undefined;

  const userIdIdx = args.indexOf('--user-id');
  const userId = userIdIdx !== -1 ? args[userIdIdx + 1] : undefined;

  return { dryRun, workspaceId, userId };
};

const run = async () => {
  const { dryRun, workspaceId, userId } = parseArgs();

  console.log('Starting EmailFilter → Automation migration...');
  if (dryRun) console.log('  DRY RUN — no writes will occur');
  if (workspaceId) console.log(`  Scope: workspace ${workspaceId}`);
  if (userId) console.log(`  Scope: user ${userId}`);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const migrationService = app.get(AutomationMigrationFromFilterService);
    const result = await migrationService.migrateAll({ userId, workspaceId, dryRun });

    console.log('\nMigration complete:');
    console.log(`  Total filters:   ${result.total}`);
    console.log(`  Migrated:        ${result.migrated}`);
    console.log(`  Skipped:         ${result.skipped}`);
    console.log(`  Failed:          ${result.failed}`);

    if (result.errors.length > 0) {
      console.log('\nErrors:');
      for (const e of result.errors) {
        console.log(`  Filter ${e.filterId}: ${e.error}`);
      }
      process.exitCode = 1;
    } else {
      console.log('\nAll filters processed successfully.');
    }
  } finally {
    await app.close();
  }
};

void run().catch((err) => {
  console.error('Fatal error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
