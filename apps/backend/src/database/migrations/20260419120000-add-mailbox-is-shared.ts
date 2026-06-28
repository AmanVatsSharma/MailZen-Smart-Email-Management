/**
 * File:        apps/backend/src/database/migrations/20260419120000-add-mailbox-is-shared.ts
 * Module:      Database · Migrations
 * Purpose:     Adds isShared boolean column to mailboxes table to support workspace-level
 *              mailbox sharing, alongside any pending schema changes captured in the diff.
 *
 * Exports:
 *   - AddMailboxIsShared20260419120000 — TypeORM MigrationInterface class
 *
 * Depends on:
 *   - typeorm — MigrationInterface, QueryRunner
 *
 * Side-effects:
 *   - DB write: alters mailboxes table, creates suppressed_senders and email_assignments tables
 *
 * Key invariants:
 *   - isShared defaults to false for all existing rows
 *   - down() is fully reversible: drops column and all created tables/indexes/types
 *
 * Read order:
 *   1. up() — forward migration
 *   2. down() — rollback
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-04-19
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMailboxIsShared20260419120000 implements MigrationInterface {
  name = 'AddMailboxIsShared20260419120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "suppressed_senders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" character varying NOT NULL, "senderEmail" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_397c84453e4520de14925a6e30f" UNIQUE ("userId", "senderEmail"), CONSTRAINT "PK_0d3eefd94d985fb5e05c4a59b0f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_1e35c668a81368bebb1fb6fbb1" ON "suppressed_senders" ("userId") `,
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
      `CREATE INDEX IF NOT EXISTS "IDX_ac520da2bbc175ba04af7e0eeb" ON "email_assignments" ("workspaceId") `,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_f330053612e25cc7638f0fcb0f" ON "email_assignments" ("emailId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "mailboxes" ADD "isShared" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "mailboxes" DROP COLUMN "isShared"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f330053612e25cc7638f0fcb0f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ac520da2bbc175ba04af7e0eeb"`,
    );
    await queryRunner.query(`DROP TABLE "email_assignments"`);
    await queryRunner.query(
      `DROP TYPE "public"."email_assignments_status_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1e35c668a81368bebb1fb6fbb1"`,
    );
    await queryRunner.query(`DROP TABLE "suppressed_senders"`);
  }
}
