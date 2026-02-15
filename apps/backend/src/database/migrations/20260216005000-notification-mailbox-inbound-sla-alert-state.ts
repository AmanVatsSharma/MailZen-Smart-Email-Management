import { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationMailboxInboundSlaAlertState20260216005000 implements MigrationInterface {
  name = 'NotificationMailboxInboundSlaAlertState20260216005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_notification_preferences"
      ADD COLUMN IF NOT EXISTS "mailboxInboundSlaAlertsEnabled" boolean NOT NULL DEFAULT true
    `);
    await queryRunner.query(`
      ALTER TABLE "user_notification_preferences"
      ADD COLUMN IF NOT EXISTS "mailboxInboundSlaLastAlertStatus" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "user_notification_preferences"
      ADD COLUMN IF NOT EXISTS "mailboxInboundSlaLastAlertedAt" TIMESTAMPTZ
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_notification_preferences"
      DROP COLUMN IF EXISTS "mailboxInboundSlaLastAlertedAt"
    `);
    await queryRunner.query(`
      ALTER TABLE "user_notification_preferences"
      DROP COLUMN IF EXISTS "mailboxInboundSlaLastAlertStatus"
    `);
    await queryRunner.query(`
      ALTER TABLE "user_notification_preferences"
      DROP COLUMN IF EXISTS "mailboxInboundSlaAlertsEnabled"
    `);
  }
}
