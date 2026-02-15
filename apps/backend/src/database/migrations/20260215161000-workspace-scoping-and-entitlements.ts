import { MigrationInterface, QueryRunner } from 'typeorm';

export class WorkspaceScopingAndEntitlements20260215161000 implements MigrationInterface {
  name = 'WorkspaceScopingAndEntitlements20260215161000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "workspaces" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "ownerUserId" uuid NOT NULL,
        "name" character varying NOT NULL,
        "slug" character varying NOT NULL,
        "isPersonal" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_workspaces_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_workspaces_slug" UNIQUE ("slug")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_workspaces_ownerUserId" ON "workspaces" ("ownerUserId")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "workspace_members" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspaceId" uuid NOT NULL,
        "userId" uuid,
        "email" character varying NOT NULL,
        "role" character varying NOT NULL DEFAULT 'MEMBER',
        "status" character varying NOT NULL DEFAULT 'active',
        "invitedByUserId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_workspace_members_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_workspace_members_workspace_email" UNIQUE ("workspaceId", "email")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_workspace_members_workspaceId" ON "workspace_members" ("workspaceId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_workspace_members_userId" ON "workspace_members" ("userId")`,
    );

    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "activeWorkspaceId" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "email_providers" ADD COLUMN IF NOT EXISTS "workspaceId" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "mailboxes" ADD COLUMN IF NOT EXISTS "workspaceId" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "billing_plans" ADD COLUMN IF NOT EXISTS "workspaceLimit" integer NOT NULL DEFAULT 1`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_email_providers_workspaceId" ON "email_providers" ("workspaceId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mailboxes_workspaceId" ON "mailboxes" ("workspaceId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_mailboxes_workspaceId"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_email_providers_workspaceId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "billing_plans" DROP COLUMN IF EXISTS "workspaceLimit"`,
    );
    await queryRunner.query(
      `ALTER TABLE "mailboxes" DROP COLUMN IF EXISTS "workspaceId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "email_providers" DROP COLUMN IF EXISTS "workspaceId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "activeWorkspaceId"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_workspace_members_userId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_workspace_members_workspaceId"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "workspace_members"`);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_workspaces_ownerUserId"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "workspaces"`);
  }
}
