import { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationMailboxInboundSlaThresholds20260216003000 implements MigrationInterface {
  name = 'NotificationMailboxInboundSlaThresholds20260216003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_notification_preferences"
      ADD COLUMN IF NOT EXISTS "mailboxInboundSlaTargetSuccessPercent" double precision NOT NULL DEFAULT 99
    `);
    await queryRunner.query(`
      ALTER TABLE "user_notification_preferences"
      ADD COLUMN IF NOT EXISTS "mailboxInboundSlaWarningRejectedPercent" double precision NOT NULL DEFAULT 1
    `);
    await queryRunner.query(`
      ALTER TABLE "user_notification_preferences"
      ADD COLUMN IF NOT EXISTS "mailboxInboundSlaCriticalRejectedPercent" double precision NOT NULL DEFAULT 5
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_notification_preferences"
      DROP COLUMN IF EXISTS "mailboxInboundSlaCriticalRejectedPercent"
    `);
    await queryRunner.query(`
      ALTER TABLE "user_notification_preferences"
      DROP COLUMN IF EXISTS "mailboxInboundSlaWarningRejectedPercent"
    `);
    await queryRunner.query(`
      ALTER TABLE "user_notification_preferences"
      DROP COLUMN IF EXISTS "mailboxInboundSlaTargetSuccessPercent"
    `);
  }
}
