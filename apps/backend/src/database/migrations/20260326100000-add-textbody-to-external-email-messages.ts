import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTextbodyToExternalEmailMessages20260326100000 implements MigrationInterface {
  name = 'AddTextbodyToExternalEmailMessages20260326100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "external_email_messages" ADD COLUMN IF NOT EXISTS "textBody" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "external_email_messages" DROP COLUMN IF EXISTS "textBody"`,
    );
  }
}
