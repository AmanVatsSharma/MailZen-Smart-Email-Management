import { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationDigestLastSent20260216013000 implements MigrationInterface {
  name = 'NotificationDigestLastSent20260216013000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_notification_preferences"
      ADD COLUMN IF NOT EXISTS "notificationDigestLastSentAt" TIMESTAMPTZ
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_notification_preferences"
      DROP COLUMN IF EXISTS "notificationDigestLastSentAt"
    `);
  }
}
