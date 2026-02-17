import { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationMailboxInboundSlaCooldown20260216011000 implements MigrationInterface {
  name = 'NotificationMailboxInboundSlaCooldown20260216011000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_notification_preferences"
      ADD COLUMN IF NOT EXISTS "mailboxInboundSlaAlertCooldownMinutes" integer NOT NULL DEFAULT 60
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_notification_preferences"
      DROP COLUMN IF EXISTS "mailboxInboundSlaAlertCooldownMinutes"
    `);
  }
}
