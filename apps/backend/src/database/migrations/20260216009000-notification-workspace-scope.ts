import { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationWorkspaceScope20260216009000 implements MigrationInterface {
  name = 'NotificationWorkspaceScope20260216009000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_notifications"
      ADD COLUMN IF NOT EXISTS "workspaceId" character varying
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_notifications_workspaceId"
      ON "user_notifications" ("workspaceId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_user_notifications_workspaceId"
    `);
    await queryRunner.query(`
      ALTER TABLE "user_notifications"
      DROP COLUMN IF EXISTS "workspaceId"
    `);
  }
}
