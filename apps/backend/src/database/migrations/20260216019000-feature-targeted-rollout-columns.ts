import { MigrationInterface, QueryRunner } from 'typeorm';

export class FeatureTargetedRolloutColumns20260216019000 implements MigrationInterface {
  name = 'FeatureTargetedRolloutColumns20260216019000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "features"
      ADD COLUMN IF NOT EXISTS "targetType" character varying NOT NULL DEFAULT 'GLOBAL'
    `);
    await queryRunner.query(`
      ALTER TABLE "features"
      ADD COLUMN IF NOT EXISTS "targetValue" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "features"
      ADD COLUMN IF NOT EXISTS "rolloutPercentage" integer NOT NULL DEFAULT 100
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "features"
      DROP COLUMN IF EXISTS "rolloutPercentage"
    `);
    await queryRunner.query(`
      ALTER TABLE "features"
      DROP COLUMN IF EXISTS "targetValue"
    `);
    await queryRunner.query(`
      ALTER TABLE "features"
      DROP COLUMN IF EXISTS "targetType"
    `);
  }
}
