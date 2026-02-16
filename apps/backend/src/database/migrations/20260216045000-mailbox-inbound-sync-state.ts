import { MigrationInterface, QueryRunner } from 'typeorm';

export class MailboxInboundSyncState20260216045000 implements MigrationInterface {
  name = 'MailboxInboundSyncState20260216045000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "mailboxes"
      ADD COLUMN IF NOT EXISTS "inboundSyncCursor" TEXT
    `);
    await queryRunner.query(`
      ALTER TABLE "mailboxes"
      ADD COLUMN IF NOT EXISTS "inboundSyncLastPolledAt" TIMESTAMP
    `);
    await queryRunner.query(`
      ALTER TABLE "mailboxes"
      ADD COLUMN IF NOT EXISTS "inboundSyncLastError" TEXT
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_mailboxes_inboundSyncLastPolledAt"
      ON "mailboxes" ("inboundSyncLastPolledAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_mailboxes_inboundSyncLastPolledAt"
    `);
    await queryRunner.query(`
      ALTER TABLE "mailboxes"
      DROP COLUMN IF EXISTS "inboundSyncLastError"
    `);
    await queryRunner.query(`
      ALTER TABLE "mailboxes"
      DROP COLUMN IF EXISTS "inboundSyncLastPolledAt"
    `);
    await queryRunner.query(`
      ALTER TABLE "mailboxes"
      DROP COLUMN IF EXISTS "inboundSyncCursor"
    `);
  }
}
