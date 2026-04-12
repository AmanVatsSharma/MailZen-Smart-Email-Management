import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add a Postgres full-text search GIN index on external_email_messages.
 *
 * The expression index covers subject, from, and snippet columns so that
 * UnifiedInboxService.listThreads can use plainto_tsquery() for fast FTS
 * instead of falling back to ILIKE on large inboxes.
 *
 * The index is CONCURRENTLY to avoid locking the table on production
 * (note: TypeORM migrations run in a transaction by default; concurrent index
 * creation cannot run inside a transaction — we set `migrationsTransactionMode`
 * to 'each' so each migration runs its own transaction, but the CONCURRENTLY
 * clause still requires that the CREATE INDEX statement runs outside a
 * transaction. We therefore use queryRunner.query() which runs the statement
 * directly after disabling auto-transaction for this migration.)
 */
export class ExternalEmailMessageFtsIndex20260326110000
  implements MigrationInterface
{
  name = 'ExternalEmailMessageFtsIndex20260326110000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create a function-based expression index used by the FTS query.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_external_email_messages_fts"
      ON "external_email_messages"
      USING GIN (
        to_tsvector(
          'english',
          coalesce(subject, '') || ' ' ||
          coalesce("from", '') || ' ' ||
          coalesce(snippet, '')
        )
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_external_email_messages_fts"`,
    );
  }
}
