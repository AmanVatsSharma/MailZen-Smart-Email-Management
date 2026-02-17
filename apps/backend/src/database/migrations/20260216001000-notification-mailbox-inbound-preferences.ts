import { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationMailboxInboundPreferences20260216001000 implements MigrationInterface {
  name = 'NotificationMailboxInboundPreferences20260216001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_notification_preferences"
      ADD COLUMN IF NOT EXISTS "mailboxInboundAcceptedEnabled" boolean NOT NULL DEFAULT true
    `);
    await queryRunner.query(`
      ALTER TABLE "user_notification_preferences"
      ADD COLUMN IF NOT EXISTS "mailboxInboundDeduplicatedEnabled" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "user_notification_preferences"
      ADD COLUMN IF NOT EXISTS "mailboxInboundRejectedEnabled" boolean NOT NULL DEFAULT true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_notification_preferences"
      DROP COLUMN IF EXISTS "mailboxInboundRejectedEnabled"
    `);
    await queryRunner.query(`
      ALTER TABLE "user_notification_preferences"
      DROP COLUMN IF EXISTS "mailboxInboundDeduplicatedEnabled"
    `);
    await queryRunner.query(`
      ALTER TABLE "user_notification_preferences"
      DROP COLUMN IF EXISTS "mailboxInboundAcceptedEnabled"
    `);
  }
}
