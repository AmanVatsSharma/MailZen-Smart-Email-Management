import { MigrationInterface, QueryRunner } from 'typeorm';

export class MailboxInboundEvents20260215202000 implements MigrationInterface {
  name = 'MailboxInboundEvents20260215202000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "mailbox_inbound_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "mailboxId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "messageId" character varying,
        "emailId" uuid,
        "inboundThreadKey" character varying,
        "status" character varying NOT NULL DEFAULT 'ACCEPTED',
        "sourceIp" character varying,
        "signatureValidated" boolean NOT NULL DEFAULT false,
        "errorReason" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_mailbox_inbound_events_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_mailbox_inbound_events_mailbox_message" UNIQUE ("mailboxId", "messageId")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mailbox_inbound_events_mailboxId" ON "mailbox_inbound_events" ("mailboxId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mailbox_inbound_events_userId" ON "mailbox_inbound_events" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mailbox_inbound_events_messageId" ON "mailbox_inbound_events" ("messageId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mailbox_inbound_events_emailId" ON "mailbox_inbound_events" ("emailId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_mailbox_inbound_events_emailId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_mailbox_inbound_events_messageId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_mailbox_inbound_events_userId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_mailbox_inbound_events_mailboxId"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "mailbox_inbound_events"`);
  }
}
