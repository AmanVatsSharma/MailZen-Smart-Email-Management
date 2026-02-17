import { MigrationInterface, QueryRunner } from 'typeorm';

export class EmailProviderOutlookPushSubscriptionState20260216041000 implements MigrationInterface {
  name = 'EmailProviderOutlookPushSubscriptionState20260216041000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "email_providers"
      ADD COLUMN IF NOT EXISTS "outlookPushSubscriptionId" TEXT
    `);
    await queryRunner.query(`
      ALTER TABLE "email_providers"
      ADD COLUMN IF NOT EXISTS "outlookPushSubscriptionExpiresAt" TIMESTAMP
    `);
    await queryRunner.query(`
      ALTER TABLE "email_providers"
      ADD COLUMN IF NOT EXISTS "outlookPushSubscriptionLastRenewedAt" TIMESTAMP
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "email_providers"
      DROP COLUMN IF EXISTS "outlookPushSubscriptionLastRenewedAt"
    `);
    await queryRunner.query(`
      ALTER TABLE "email_providers"
      DROP COLUMN IF EXISTS "outlookPushSubscriptionExpiresAt"
    `);
    await queryRunner.query(`
      ALTER TABLE "email_providers"
      DROP COLUMN IF EXISTS "outlookPushSubscriptionId"
    `);
  }
}
