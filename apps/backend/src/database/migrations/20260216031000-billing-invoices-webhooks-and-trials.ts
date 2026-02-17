import { MigrationInterface, QueryRunner } from 'typeorm';

export class BillingInvoicesWebhooksAndTrials20260216031000 implements MigrationInterface {
  name = 'BillingInvoicesWebhooksAndTrials20260216031000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_subscriptions"
      ADD COLUMN IF NOT EXISTS "isTrial" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "user_subscriptions"
      ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "billing_invoices" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" character varying NOT NULL,
        "subscriptionId" character varying,
        "planCode" character varying NOT NULL,
        "invoiceNumber" character varying NOT NULL,
        "provider" character varying NOT NULL DEFAULT 'INTERNAL',
        "providerInvoiceId" character varying,
        "status" character varying NOT NULL DEFAULT 'open',
        "amountCents" integer NOT NULL DEFAULT 0,
        "currency" character varying NOT NULL DEFAULT 'USD',
        "periodStart" TIMESTAMP NOT NULL,
        "periodEnd" TIMESTAMP NOT NULL,
        "dueAt" TIMESTAMP,
        "paidAt" TIMESTAMP,
        "metadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_billing_invoices_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_billing_invoices_provider_invoice"
          UNIQUE ("provider", "providerInvoiceId")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_billing_invoices_userId"
      ON "billing_invoices" ("userId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_billing_invoices_subscriptionId"
      ON "billing_invoices" ("subscriptionId")
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "billing_webhook_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "provider" character varying NOT NULL,
        "eventType" character varying NOT NULL,
        "externalEventId" character varying NOT NULL,
        "status" character varying NOT NULL DEFAULT 'received',
        "processedAt" TIMESTAMP,
        "errorMessage" text,
        "payload" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_billing_webhook_events_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_billing_webhooks_provider_external"
          UNIQUE ("provider", "externalEventId")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_billing_webhooks_externalEventId"
      ON "billing_webhook_events" ("externalEventId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_billing_webhooks_externalEventId"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "billing_webhook_events"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_billing_invoices_subscriptionId"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_billing_invoices_userId"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "billing_invoices"
    `);
    await queryRunner.query(`
      ALTER TABLE "user_subscriptions"
      DROP COLUMN IF EXISTS "trialEndsAt"
    `);
    await queryRunner.query(`
      ALTER TABLE "user_subscriptions"
      DROP COLUMN IF EXISTS "isTrial"
    `);
  }
}
