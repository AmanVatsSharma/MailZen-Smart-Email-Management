import { MigrationInterface, QueryRunner } from 'typeorm';

export class AgentActionAudits20260216021000 implements MigrationInterface {
  name = 'AgentActionAudits20260216021000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "agent_action_audits" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" character varying,
        "requestId" character varying NOT NULL,
        "skill" character varying NOT NULL,
        "action" character varying NOT NULL,
        "executed" boolean NOT NULL DEFAULT false,
        "approvalRequired" boolean NOT NULL DEFAULT false,
        "approvalTokenSuffix" character varying,
        "message" text NOT NULL,
        "metadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_agent_action_audits_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_agent_action_audits_userId"
      ON "agent_action_audits" ("userId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_agent_action_audits_requestId"
      ON "agent_action_audits" ("requestId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_agent_action_audits_requestId"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_agent_action_audits_userId"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "agent_action_audits"
    `);
  }
}
