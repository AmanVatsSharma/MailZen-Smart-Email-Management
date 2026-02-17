import { MigrationInterface, QueryRunner } from 'typeorm';

export class BillingWorkspaceMemberLimit20260216090000 implements MigrationInterface {
  name = 'BillingWorkspaceMemberLimit20260216090000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "billing_plans" ADD COLUMN IF NOT EXISTS "workspaceMemberLimit" integer NOT NULL DEFAULT 3`,
    );

    await queryRunner.query(`
      UPDATE "billing_plans"
      SET "workspaceMemberLimit" = CASE
        WHEN UPPER("code") = 'FREE' THEN 3
        WHEN UPPER("code") = 'PRO' THEN 25
        WHEN UPPER("code") = 'BUSINESS' THEN 200
        ELSE GREATEST(COALESCE("workspaceMemberLimit", 3), 1)
      END
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "billing_plans" DROP COLUMN IF EXISTS "workspaceMemberLimit"`,
    );
  }
}
