import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Add AI metadata columns to emails table
 * - ai_priority: triage priority classification (urgent/high/normal/low)
 * - ai_category: triage category classification (work/personal/newsletter/etc.)
 * - ai_summary: short AI-generated thread summary
 * - ai_requires_reply: whether AI detected a reply is expected
 * Also creates ai_feedback table for user preference learning.
 */
export class EmailAiMetadata20260411100000 implements MigrationInterface {
  name = 'EmailAiMetadata20260411100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add AI metadata columns to emails
    await queryRunner.query(`
      ALTER TABLE "emails"
        ADD COLUMN IF NOT EXISTS "aiPriority" character varying(10) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS "aiCategory" character varying(24) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS "aiSummary" text DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS "aiRequiresReply" boolean DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS "aiScoredAt" TIMESTAMP DEFAULT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_emails_aiPriority"
      ON "emails" ("aiPriority")
      WHERE "aiPriority" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_emails_aiCategory"
      ON "emails" ("aiCategory")
      WHERE "aiCategory" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_emails_aiScoredAt"
      ON "emails" ("aiScoredAt")
      WHERE "aiScoredAt" IS NULL
    `);

    // Create AI feedback table for user preference learning
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ai_feedback" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" character varying NOT NULL,
        "agentSkill" character varying(32) NOT NULL,
        "action" character varying(64) NOT NULL,
        "signal" character varying(16) NOT NULL DEFAULT 'accept',
        "context" jsonb DEFAULT '{}',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ai_feedback_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ai_feedback_userId_skill"
      ON "ai_feedback" ("userId", "agentSkill")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ai_feedback_createdAt"
      ON "ai_feedback" ("createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ai_feedback_createdAt"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ai_feedback_userId_skill"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_feedback"`);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_emails_aiScoredAt"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_emails_aiCategory"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_emails_aiPriority"`,
    );

    await queryRunner.query(`
      ALTER TABLE "emails"
        DROP COLUMN IF EXISTS "aiScoredAt",
        DROP COLUMN IF EXISTS "aiRequiresReply",
        DROP COLUMN IF EXISTS "aiSummary",
        DROP COLUMN IF EXISTS "aiCategory",
        DROP COLUMN IF EXISTS "aiPriority"
    `);
  }
}
