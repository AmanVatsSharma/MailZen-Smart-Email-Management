import { MigrationInterface, QueryRunner } from 'typeorm';

export class EmailProviderSyncErrorState20260216024000
  implements MigrationInterface
{
  name = 'EmailProviderSyncErrorState20260216024000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "email_providers"
      ADD COLUMN IF NOT EXISTS "lastSyncErrorAt" TIMESTAMP
    `);
    await queryRunner.query(`
      ALTER TABLE "email_providers"
      ADD COLUMN IF NOT EXISTS "lastSyncError" TEXT
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_email_providers_lastSyncErrorAt"
      ON "email_providers" ("lastSyncErrorAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_email_providers_lastSyncErrorAt"
    `);
    await queryRunner.query(`
      ALTER TABLE "email_providers"
      DROP COLUMN IF EXISTS "lastSyncError"
    `);
    await queryRunner.query(`
      ALTER TABLE "email_providers"
      DROP COLUMN IF EXISTS "lastSyncErrorAt"
    `);
  }
}
