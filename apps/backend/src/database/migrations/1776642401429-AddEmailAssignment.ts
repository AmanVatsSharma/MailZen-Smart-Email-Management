/**
 * File:        apps/backend/src/database/migrations/1776642401429-AddEmailAssignment.ts
 * Module:      Database · Migrations
 * Purpose:     Creates the email_assignments table and its associated enum type and
 *              indexes to support email thread assignment tracking within workspaces.
 *
 * Exports:
 *   - AddEmailAssignment1776642401429  — TypeORM MigrationInterface implementation
 *
 * Depends on:
 *   - none (auto-generated migration; no direct imports beyond typeorm)
 *
 * Side-effects:
 *   - DB write: creates email_assignments table, email_assignments_status_enum type,
 *     indexes on workspaceId and emailId
 *   - Also creates suppressed_senders table and an isShared column on mailboxes
 *     (these were detected as pending schema diffs at migration generation time)
 *
 * Key invariants:
 *   - Migration is irreversible if email_assignments rows exist (down() drops the table)
 *   - Must run after the emails table migration (emailId references it conceptually)
 *
 * Read order:
 *   1. up()   — applies the schema changes
 *   2. down() — reverts the schema changes
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-04-19
 */

import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEmailAssignment1776642401429 implements MigrationInterface {
    name = 'AddEmailAssignment1776642401429'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "suppressed_senders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" character varying NOT NULL, "senderEmail" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_397c84453e4520de14925a6e30f" UNIQUE ("userId", "senderEmail"), CONSTRAINT "PK_0d3eefd94d985fb5e05c4a59b0f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_1e35c668a81368bebb1fb6fbb1" ON "suppressed_senders" ("userId") `);
        await queryRunner.query(`CREATE TYPE "public"."email_assignments_status_enum" AS ENUM('open', 'in_progress', 'resolved', 'transferred')`);
        await queryRunner.query(`CREATE TABLE "email_assignments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "emailId" character varying NOT NULL, "assignedToUserId" character varying NOT NULL, "assignedByUserId" character varying NOT NULL, "status" "public"."email_assignments_status_enum" NOT NULL DEFAULT 'open', "notes" text, "dueAt" TIMESTAMP WITH TIME ZONE, "resolvedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a9824bf29342cb9056b54a2c7c6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ac520da2bbc175ba04af7e0eeb" ON "email_assignments" ("workspaceId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f330053612e25cc7638f0fcb0f" ON "email_assignments" ("emailId") `);
        await queryRunner.query(`ALTER TABLE "mailboxes" ADD "isShared" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "mailboxes" DROP COLUMN "isShared"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f330053612e25cc7638f0fcb0f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ac520da2bbc175ba04af7e0eeb"`);
        await queryRunner.query(`DROP TABLE "email_assignments"`);
        await queryRunner.query(`DROP TYPE "public"."email_assignments_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1e35c668a81368bebb1fb6fbb1"`);
        await queryRunner.query(`DROP TABLE "suppressed_senders"`);
    }

}
