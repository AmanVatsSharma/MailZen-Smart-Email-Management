import { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationPushSubscriptions20260216017000 implements MigrationInterface {
  name = 'NotificationPushSubscriptions20260216017000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notification_push_subscriptions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" character varying NOT NULL,
        "workspaceId" character varying,
        "endpoint" text NOT NULL,
        "p256dh" character varying NOT NULL,
        "auth" character varying NOT NULL,
        "userAgent" character varying,
        "isActive" boolean NOT NULL DEFAULT true,
        "failureCount" integer NOT NULL DEFAULT 0,
        "lastDeliveredAt" TIMESTAMPTZ,
        "lastFailureAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notification_push_subscriptions_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_notification_push_subscriptions_endpoint" UNIQUE ("endpoint")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notification_push_subscriptions_userId"
      ON "notification_push_subscriptions" ("userId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notification_push_subscriptions_workspaceId"
      ON "notification_push_subscriptions" ("workspaceId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notification_push_subscriptions_endpoint"
      ON "notification_push_subscriptions" ("endpoint")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_notification_push_subscriptions_endpoint"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_notification_push_subscriptions_workspaceId"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_notification_push_subscriptions_userId"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "notification_push_subscriptions"
    `);
  }
}
