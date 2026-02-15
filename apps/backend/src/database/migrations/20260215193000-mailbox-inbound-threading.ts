import { MigrationInterface, QueryRunner } from 'typeorm';

export class MailboxInboundThreading20260215193000 implements MigrationInterface {
  name = 'MailboxInboundThreading20260215193000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "emails" ADD COLUMN IF NOT EXISTS "inboundMessageId" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "emails" ADD COLUMN IF NOT EXISTS "inboundThreadKey" character varying`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_emails_inboundMessageId" ON "emails" ("inboundMessageId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_emails_inboundThreadKey" ON "emails" ("inboundThreadKey")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_emails_inboundThreadKey"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_emails_inboundMessageId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "emails" DROP COLUMN IF EXISTS "inboundThreadKey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "emails" DROP COLUMN IF EXISTS "inboundMessageId"`,
    );
  }
}
