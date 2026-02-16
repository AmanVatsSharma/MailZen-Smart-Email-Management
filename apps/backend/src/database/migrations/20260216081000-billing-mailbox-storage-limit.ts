import { MigrationInterface, QueryRunner } from 'typeorm';

export class BillingMailboxStorageLimit20260216081000
  implements MigrationInterface
{
  name = 'BillingMailboxStorageLimit20260216081000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "billing_plans" ADD COLUMN IF NOT EXISTS "mailboxStorageLimitMb" integer NOT NULL DEFAULT 2048`,
    );

    await queryRunner.query(`
      UPDATE "billing_plans"
      SET "mailboxStorageLimitMb" = CASE
        WHEN UPPER("code") = 'FREE' THEN 2048
        WHEN UPPER("code") = 'PRO' THEN 10240
        WHEN UPPER("code") = 'BUSINESS' THEN 51200
        ELSE GREATEST(COALESCE("mailboxStorageLimitMb", 2048), 128)
      END
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "billing_plans" DROP COLUMN IF EXISTS "mailboxStorageLimitMb"`,
    );
  }
}
