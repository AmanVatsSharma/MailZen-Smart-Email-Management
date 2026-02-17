import { MigrationInterface, QueryRunner } from 'typeorm';

export class MailboxSyncRuns20260216070000 implements MigrationInterface {
  name = 'MailboxSyncRuns20260216070000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "mailbox_sync_runs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "mailboxId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "workspaceId" uuid,
        "triggerSource" text NOT NULL DEFAULT 'SCHEDULER',
        "runCorrelationId" text NOT NULL,
        "status" text NOT NULL DEFAULT 'SUCCESS',
        "fetchedMessages" integer NOT NULL DEFAULT 0,
        "acceptedMessages" integer NOT NULL DEFAULT 0,
        "deduplicatedMessages" integer NOT NULL DEFAULT 0,
        "rejectedMessages" integer NOT NULL DEFAULT 0,
        "nextCursor" text,
        "errorMessage" text,
        "startedAt" TIMESTAMP NOT NULL,
        "completedAt" TIMESTAMP NOT NULL,
        "durationMs" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_mailbox_sync_runs_mailboxId"
      ON "mailbox_sync_runs" ("mailboxId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_mailbox_sync_runs_userId"
      ON "mailbox_sync_runs" ("userId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_mailbox_sync_runs_workspaceId"
      ON "mailbox_sync_runs" ("workspaceId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_mailbox_sync_runs_triggerSource"
      ON "mailbox_sync_runs" ("triggerSource")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_mailbox_sync_runs_runCorrelationId"
      ON "mailbox_sync_runs" ("runCorrelationId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_mailbox_sync_runs_status"
      ON "mailbox_sync_runs" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_mailbox_sync_runs_startedAt"
      ON "mailbox_sync_runs" ("startedAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_mailbox_sync_runs_completedAt"
      ON "mailbox_sync_runs" ("completedAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_mailbox_sync_runs_completedAt"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_mailbox_sync_runs_startedAt"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_mailbox_sync_runs_status"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_mailbox_sync_runs_runCorrelationId"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_mailbox_sync_runs_triggerSource"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_mailbox_sync_runs_workspaceId"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_mailbox_sync_runs_userId"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_mailbox_sync_runs_mailboxId"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "mailbox_sync_runs"
    `);
  }
}
