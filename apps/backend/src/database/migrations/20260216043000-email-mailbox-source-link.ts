import { MigrationInterface, QueryRunner } from 'typeorm';

export class EmailMailboxSourceLink20260216043000 implements MigrationInterface {
  name = 'EmailMailboxSourceLink20260216043000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "emails"
      ADD COLUMN IF NOT EXISTS "mailboxId" character varying
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_emails_mailboxId"
      ON "emails" ("mailboxId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_emails_mailboxId_inboundMessageId"
      ON "emails" ("mailboxId", "inboundMessageId")
    `);
    await queryRunner.query(`
      UPDATE "emails" e
      SET "mailboxId" = m.id
      FROM "mailboxes" m
      WHERE e."mailboxId" IS NULL
        AND e."providerId" IS NULL
        AND e."userId" = m."userId"
        AND (
          POSITION(LOWER(m.email) IN LOWER(COALESCE(e."from", ''))) > 0
          OR EXISTS (
            SELECT 1
            FROM UNNEST(COALESCE(e."to", ARRAY[]::text[])) AS recipient
            WHERE LOWER(recipient) = LOWER(m.email)
          )
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_emails_mailboxId_inboundMessageId"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_emails_mailboxId"
    `);
    await queryRunner.query(`
      ALTER TABLE "emails"
      DROP COLUMN IF EXISTS "mailboxId"
    `);
  }
}
