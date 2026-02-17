import { MigrationInterface, QueryRunner } from 'typeorm';

export class MailboxInboundSyncLeaseState20260216052000 implements MigrationInterface {
  name = 'MailboxInboundSyncLeaseState20260216052000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "mailboxes"
      ADD COLUMN IF NOT EXISTS "inboundSyncLeaseToken" TEXT
    `);
    await queryRunner.query(`
      ALTER TABLE "mailboxes"
      ADD COLUMN IF NOT EXISTS "inboundSyncLeaseExpiresAt" TIMESTAMP
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_mailboxes_inboundSyncLeaseExpiresAt"
      ON "mailboxes" ("inboundSyncLeaseExpiresAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_mailboxes_inboundSyncLeaseExpiresAt"
    `);
    await queryRunner.query(`
      ALTER TABLE "mailboxes"
      DROP COLUMN IF EXISTS "inboundSyncLeaseExpiresAt"
    `);
    await queryRunner.query(`
      ALTER TABLE "mailboxes"
      DROP COLUMN IF EXISTS "inboundSyncLeaseToken"
    `);
  }
}
