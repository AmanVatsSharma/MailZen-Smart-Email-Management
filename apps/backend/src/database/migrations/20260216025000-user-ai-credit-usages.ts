import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserAiCreditUsages20260216025000 implements MigrationInterface {
  name = 'UserAiCreditUsages20260216025000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_ai_credit_usages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" character varying NOT NULL,
        "periodStart" date NOT NULL,
        "usedCredits" integer NOT NULL DEFAULT 0,
        "lastConsumedAt" TIMESTAMP,
        "lastRequestId" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_ai_credit_usages_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_ai_credit_usages_user_period" UNIQUE ("userId", "periodStart")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_ai_credit_usages_userId"
      ON "user_ai_credit_usages" ("userId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_ai_credit_usages_periodStart"
      ON "user_ai_credit_usages" ("periodStart")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_user_ai_credit_usages_periodStart"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_user_ai_credit_usages_userId"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "user_ai_credit_usages"
    `);
  }
}
