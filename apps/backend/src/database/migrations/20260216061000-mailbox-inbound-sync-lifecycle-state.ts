import { MigrationInterface, QueryRunner } from 'typeorm';

export class MailboxInboundSyncLifecycleState20260216061000 implements MigrationInterface {
  name = 'MailboxInboundSyncLifecycleState20260216061000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "mailboxes"
      ADD COLUMN IF NOT EXISTS "inboundSyncStatus" TEXT
    `);
    await queryRunner.query(`
      ALTER TABLE "mailboxes"
      ADD COLUMN IF NOT EXISTS "inboundSyncLastErrorAt" TIMESTAMP
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_mailboxes_inboundSyncStatus"
      ON "mailboxes" ("inboundSyncStatus")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_mailboxes_inboundSyncStatus"
    `);
    await queryRunner.query(`
      ALTER TABLE "mailboxes"
      DROP COLUMN IF EXISTS "inboundSyncLastErrorAt"
    `);
    await queryRunner.query(`
      ALTER TABLE "mailboxes"
      DROP COLUMN IF EXISTS "inboundSyncStatus"
    `);
  }
}
