import { MigrationInterface, QueryRunner } from 'typeorm';

export class AgentActionAuditRetentionIndex20260216083000
  implements MigrationInterface
{
  name = 'AgentActionAuditRetentionIndex20260216083000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_agent_action_audits_createdAt" ON "agent_action_audits" ("createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_agent_action_audits_createdAt"`,
    );
  }
}
