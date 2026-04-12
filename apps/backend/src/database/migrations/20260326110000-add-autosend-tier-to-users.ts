import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAutosendTierToUsers20260326110000 implements MigrationInterface {
  name = 'AddAutosendTierToUsers20260326110000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "autoSendTier" character varying NOT NULL DEFAULT 'MANUAL'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "autoSendTier"`,
    );
  }
}
