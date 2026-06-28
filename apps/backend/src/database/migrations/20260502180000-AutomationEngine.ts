/**
 * File:        apps/backend/src/database/migrations/20260502180000-AutomationEngine.ts
 * Module:      Database · Migration
 * Purpose:     Creates the 5 automation engine tables, adds 2 columns to workspaces,
 *              and consolidates pending schema (suppressed_senders, email_assignments,
 *              mailboxes.isShared) that was previously applied via synchronize=true.
 *
 * Exports:
 *   - AutomationEngine20260502 — TypeORM migration class
 *
 * Side-effects:
 *   - Creates tables: automations, automation_versions, automation_runs,
 *     automation_step_runs, workspace_integrations
 *   - Alters workspaces: adds automationsEnabled (bool default true),
 *     automationConcurrencyCap (int default 20)
 *   - Also consolidates: suppressed_senders, email_assignments, mailboxes.isShared
 *     (previously synced; included here for clean migration history on fresh DB installs)
 *
 * Key invariants:
 *   - All automation IDs are UUID; jsonb columns hold flexible trigger/step payloads
 *   - UNIQUE(automationId, version) ensures version monotonicity per automation
 *   - UNIQUE(runId, stepIndex, attempt) enables full retry audit trail per step
 *   - UNIQUE(workspaceId, provider) enforces one active integration per type
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-05-02
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AutomationEngine20260502180000 implements MigrationInterface {
  name = 'AutomationEngine20260502180000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Previously-synced tables now formalized in migration history ──────────
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "suppressed_senders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" character varying NOT NULL, "senderEmail" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_397c84453e4520de14925a6e30f" UNIQUE ("userId", "senderEmail"), CONSTRAINT "PK_0d3eefd94d985fb5e05c4a59b0f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_1e35c668a81368bebb1fb6fbb1" ON "suppressed_senders" ("userId")`,
    );
    await queryRunner.query(
      `DO $$ BEGIN
        CREATE TYPE "public"."email_assignments_status_enum" AS ENUM('open', 'in_progress', 'resolved', 'transferred');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "email_assignments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "emailId" character varying NOT NULL, "assignedToUserId" character varying NOT NULL, "assignedByUserId" character varying NOT NULL, "status" "public"."email_assignments_status_enum" NOT NULL DEFAULT 'open', "notes" text, "dueAt" TIMESTAMP WITH TIME ZONE, "resolvedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a9824bf29342cb9056b54a2c7c6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ac520da2bbc175ba04af7e0eeb" ON "email_assignments" ("workspaceId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_f330053612e25cc7638f0fcb0f" ON "email_assignments" ("emailId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "mailboxes" ADD COLUMN IF NOT EXISTS "isShared" boolean NOT NULL DEFAULT false`,
    );

    // ── Automation engine tables ───────────────────────────────────────────────
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "workspace_integrations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" character varying NOT NULL, "provider" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'ACTIVE', "displayName" text, "encryptedSecret" text NOT NULL, "config" jsonb, "installedByUserId" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_8f8001c6ad8c43eb76a09aa1b61" UNIQUE ("workspaceId", "provider"), CONSTRAINT "PK_28e9815605e2f1adafa65df23fd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ec2e6b5983e8c4198789912633" ON "workspace_integrations" ("workspaceId")`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "automations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" character varying NOT NULL, "ownerUserId" character varying, "name" character varying NOT NULL, "description" text, "status" character varying NOT NULL DEFAULT 'DRAFT', "currentVersionId" uuid, "createdByUserId" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_34c2cc382fc780ea36f7c478192" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_42fd873aa9c947616b652df05b" ON "automations" ("workspaceId")`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "automation_versions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "automationId" character varying NOT NULL, "version" integer NOT NULL, "trigger" jsonb NOT NULL, "conditions" jsonb, "steps" jsonb NOT NULL, "publishedAt" TIMESTAMP WITH TIME ZONE, "publishedByUserId" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_670625268844d3e2d8a96afb242" UNIQUE ("automationId", "version"), CONSTRAINT "PK_fa1aa22126ed3f167f655bc8e81" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_1a4774f64f5555d6f213fc2aec" ON "automation_versions" ("automationId")`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "automation_step_runs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "runId" character varying NOT NULL, "stepIndex" integer NOT NULL, "stepType" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'PENDING', "input" jsonb, "output" jsonb, "attempt" integer NOT NULL DEFAULT '1', "errorCode" text, "errorMessage" text, "startedAt" TIMESTAMP WITH TIME ZONE, "finishedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_83e104edd3811992522f0733f9d" UNIQUE ("runId", "stepIndex", "attempt"), CONSTRAINT "PK_bfe739b260f027ebf9e0c3feb88" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_c50b8ce361c496b0bc2e8df7cf" ON "automation_step_runs" ("runId")`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "automation_runs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "automationId" character varying NOT NULL, "automationVersionId" character varying NOT NULL, "workspaceId" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'QUEUED', "triggerEvent" jsonb NOT NULL, "context" jsonb, "startedAt" TIMESTAMP WITH TIME ZONE, "finishedAt" TIMESTAMP WITH TIME ZONE, "errorCode" text, "errorMessage" text, "correlationId" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_273137fa78ff9340128ab98445f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_4cdbc1a681a31bbe3c73a87971" ON "automation_runs" ("automationId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_f4e73ddd8257353306b01e87f5" ON "automation_runs" ("workspaceId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_07d594efd64f37eeff766f0667" ON "automation_runs" ("workspaceId", "status", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ad5da040cb4f1cf3e587e5b5ea" ON "automation_runs" ("automationId", "createdAt")`,
    );

    // ── New workspace columns ──────────────────────────────────────────────────
    await queryRunner.query(
      `ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "automationsEnabled" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "automationConcurrencyCap" integer NOT NULL DEFAULT '20'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "workspaces" DROP COLUMN IF EXISTS "automationConcurrencyCap"`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspaces" DROP COLUMN IF EXISTS "automationsEnabled"`,
    );
    await queryRunner.query(
      `ALTER TABLE "mailboxes" DROP COLUMN IF EXISTS "isShared"`,
    );

    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_ad5da040cb4f1cf3e587e5b5ea"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_07d594efd64f37eeff766f0667"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_f4e73ddd8257353306b01e87f5"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_4cdbc1a681a31bbe3c73a87971"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "automation_runs"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_c50b8ce361c496b0bc2e8df7cf"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "automation_step_runs"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_1a4774f64f5555d6f213fc2aec"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "automation_versions"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_42fd873aa9c947616b652df05b"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "automations"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_ec2e6b5983e8c4198789912633"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "workspace_integrations"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_f330053612e25cc7638f0fcb0f"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_ac520da2bbc175ba04af7e0eeb"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "email_assignments"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."email_assignments_status_enum"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_1e35c668a81368bebb1fb6fbb1"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "suppressed_senders"`);
  }
}
