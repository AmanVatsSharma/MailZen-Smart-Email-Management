/**
 * File: apps/backend/src/database/migrations/20260214000000-initial-baseline.ts
 * Module: database
 * Purpose: Baseline migration marker for TypeORM-managed schema lifecycle.
 * Author: Aman Sharma / Novologic/ Codex
 * Last-updated: 2026-02-14
 * Notes:
 * - This migration marks the handoff point from ad-hoc schema sync to migrations
 * - Use generated migrations for all schema changes after this baseline
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialBaseline20260214000000 implements MigrationInterface {
  name = 'InitialBaseline20260214000000';

  public async up(_queryRunner: QueryRunner): Promise<void> {
    // Intentionally empty: existing environments are already provisioned.
    // Subsequent schema changes must be managed through explicit migrations.
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // No rollback action for baseline marker migration.
  }
}
