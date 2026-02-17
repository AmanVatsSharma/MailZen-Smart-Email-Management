import { MigrationInterface, QueryRunner } from 'typeorm';

export class EmailProviderGmailWatchState20260216035000 implements MigrationInterface {
  name = 'EmailProviderGmailWatchState20260216035000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "email_providers"
      ADD COLUMN IF NOT EXISTS "gmailWatchExpirationAt" TIMESTAMP
    `);
    await queryRunner.query(`
      ALTER TABLE "email_providers"
      ADD COLUMN IF NOT EXISTS "gmailWatchLastRenewedAt" TIMESTAMP
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "email_providers"
      DROP COLUMN IF EXISTS "gmailWatchLastRenewedAt"
    `);
    await queryRunner.query(`
      ALTER TABLE "email_providers"
      DROP COLUMN IF EXISTS "gmailWatchExpirationAt"
    `);
  }
}
