import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserMicrosoftSub20260326000000 implements MigrationInterface {
  name = 'UserMicrosoftSub20260326000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "microsoftSub" character varying UNIQUE`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_microsoftSub" ON "users" ("microsoftSub") WHERE "microsoftSub" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_users_microsoftSub"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "microsoftSub"`,
    );
  }
}
