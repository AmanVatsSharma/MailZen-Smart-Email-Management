import { MigrationInterface, QueryRunner } from 'typeorm';

export class SmartReplyHistory20260216073000 implements MigrationInterface {
  name = 'SmartReplyHistory20260216073000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "smart_reply_history" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" character varying NOT NULL,
        "conversationPreview" text NOT NULL,
        "suggestions" jsonb NOT NULL DEFAULT '[]',
        "source" character varying NOT NULL DEFAULT 'internal',
        "blockedSensitive" boolean NOT NULL DEFAULT false,
        "fallbackUsed" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_smart_reply_history_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_smart_reply_history_user_createdAt"
      ON "smart_reply_history" ("userId", "createdAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_smart_reply_history_userId"
      ON "smart_reply_history" ("userId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_smart_reply_history_userId"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_smart_reply_history_user_createdAt"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "smart_reply_history"
    `);
  }
}
