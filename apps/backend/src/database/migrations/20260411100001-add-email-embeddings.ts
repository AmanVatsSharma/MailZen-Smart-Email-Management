import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: add-email-embeddings
 *
 * Installs the pgvector extension and adds:
 *   - email.embedding  vector(1536) — OpenAI text-embedding-3-small
 *   - IVFFlat index for fast approximate nearest-neighbour search
 *
 * Phase 5 of the MailZen AI roadmap.
 *
 * NOTE: Requires PostgreSQL 14+ with the pgvector extension installed
 * (`CREATE EXTENSION vector` requires superuser or pg_extension_owner).
 */
export class AddEmailEmbeddings20260411100001 implements MigrationInterface {
  name = 'AddEmailEmbeddings20260411100001';
  public transaction = false;


  public async up(queryRunner: QueryRunner): Promise<void> {
    // Install pgvector (no-op if already present)
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);

    // Add embedding column or cast it if it exists
    try {
      await queryRunner.query(
        `ALTER TABLE "emails" ADD COLUMN "embedding" vector(1536)`
      );
    } catch (error: any) {
      // 42701 is duplicate_column
      if (error?.code === '42701' || String(error).includes('already exists')) {
        await queryRunner.query(
          `ALTER TABLE "emails" ALTER COLUMN "embedding" TYPE vector(1536) USING "embedding"::text::vector`
        );
      } else {
        throw error;
      }
    }

    // IVFFlat index — tune lists = sqrt(row_count); start conservatively
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_email_embedding_ivfflat"
       ON "emails" USING ivfflat ("embedding" vector_cosine_ops)
       WITH (lists = 100)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "idx_email_embedding_ivfflat"`,
    );
    await queryRunner.query(
      `ALTER TABLE "emails" DROP COLUMN IF EXISTS "embedding"`,
    );
  }
}
