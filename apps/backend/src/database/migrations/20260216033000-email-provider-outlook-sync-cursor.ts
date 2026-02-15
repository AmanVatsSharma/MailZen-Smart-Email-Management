import { MigrationInterface, QueryRunner } from 'typeorm';

export class EmailProviderOutlookSyncCursor20260216033000 implements MigrationInterface {
  name = 'EmailProviderOutlookSyncCursor20260216033000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "email_providers"
      ADD COLUMN IF NOT EXISTS "outlookSyncCursor" TEXT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "email_providers"
      DROP COLUMN IF EXISTS "outlookSyncCursor"
    `);
  }
}
