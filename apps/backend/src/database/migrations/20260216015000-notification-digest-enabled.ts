import { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationDigestEnabled20260216015000 implements MigrationInterface {
  name = 'NotificationDigestEnabled20260216015000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_notification_preferences"
      ADD COLUMN IF NOT EXISTS "notificationDigestEnabled" boolean NOT NULL DEFAULT true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_notification_preferences"
      DROP COLUMN IF EXISTS "notificationDigestEnabled"
    `);
  }
}
