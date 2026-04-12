import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: add-sender-profiles
 *
 * Creates the sender_profiles table for Phase 6 Sender Intelligence.
 */
export class AddSenderProfiles20260411100002 implements MigrationInterface {
  name = 'AddSenderProfiles20260411100002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sender_profiles" (
        "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId"              VARCHAR NOT NULL,
        "senderEmail"         VARCHAR NOT NULL,
        "displayName"         VARCHAR,
        "domain"              VARCHAR,
        "emailCount"          INTEGER NOT NULL DEFAULT 0,
        "avgResponseTimeSec"  FLOAT,
        "relationshipScore"   FLOAT NOT NULL DEFAULT 0,
        "topics"              JSONB NOT NULL DEFAULT '[]',
        "isVip"               BOOLEAN NOT NULL DEFAULT false,
        "lastEmailAt"         TIMESTAMPTZ,
        "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "uq_sender_profiles_user_email" UNIQUE ("userId", "senderEmail")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_sender_profiles_userId"
       ON "sender_profiles" ("userId")`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_sender_profiles_senderEmail"
       ON "sender_profiles" ("senderEmail")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "sender_profiles"`);
  }
}
