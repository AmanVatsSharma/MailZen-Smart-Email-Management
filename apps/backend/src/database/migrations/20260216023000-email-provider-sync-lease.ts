import { MigrationInterface, QueryRunner } from 'typeorm';

export class EmailProviderSyncLease20260216023000
  implements MigrationInterface
{
  name = 'EmailProviderSyncLease20260216023000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "email_providers"
      ADD COLUMN IF NOT EXISTS "syncLeaseExpiresAt" TIMESTAMP
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_email_providers_syncLeaseExpiresAt"
      ON "email_providers" ("syncLeaseExpiresAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_email_providers_syncLeaseExpiresAt"
    `);
    await queryRunner.query(`
      ALTER TABLE "email_providers"
      DROP COLUMN IF EXISTS "syncLeaseExpiresAt"
    `);
  }
}
