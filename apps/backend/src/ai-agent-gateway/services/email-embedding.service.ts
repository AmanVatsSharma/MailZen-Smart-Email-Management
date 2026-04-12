/**
 * EmailEmbeddingService — generates and stores vector embeddings for emails.
 *
 * Uses OpenAI text-embedding-3-small (1536 dims) or falls back to a
 * zero-vector stub when no API key is configured (dev/test mode).
 *
 * Embeddings are written to the `embedding` column on the Email entity
 * (requires pgvector extension — see migration 20260411100001).
 *
 * Phase 5 of the MailZen AI roadmap.
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Email } from '../../email/entities/email.entity';

const EMBEDDING_DIM = 1536;

@Injectable()
export class EmailEmbeddingService {
  private readonly logger = new Logger(EmailEmbeddingService.name);
  private readonly openaiApiKey: string | undefined;
  private readonly embeddingModel = 'text-embedding-3-small';

  constructor(
    @InjectRepository(Email)
    private readonly emailRepo: Repository<Email>,
    private readonly config: ConfigService,
  ) {
    this.openaiApiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!this.openaiApiKey) {
      this.logger.warn(
        'OPENAI_API_KEY not set — EmailEmbeddingService running in stub mode (zero vectors)',
      );
    }
  }

  /**
   * Embed a single email and persist the vector.
   * Safe to call multiple times — re-embeds if already set.
   */
  async embedEmail(emailId: string): Promise<void> {
    const email = await this.emailRepo.findOne({ where: { id: emailId } });
    if (!email) {
      this.logger.warn(`embedEmail: email ${emailId} not found`);
      return;
    }

    const text = this.buildTextForEmbedding(email);
    const vector = await this.generateEmbedding(text);

    await this.emailRepo
      .createQueryBuilder()
      .update()
      .set({ embedding: () => `'[${vector.join(',')}]'::vector` } as any)
      .where('id = :id', { id: emailId })
      .execute();

    this.logger.debug(`Embedded email ${emailId}`);
  }

  /**
   * Batch-embed emails that have no embedding yet.
   * Designed to be called from a background scheduler.
   */
  async embedUnprocessedEmails(batchSize = 50): Promise<number> {
    const emails = await this.emailRepo
      .createQueryBuilder('email')
      .where('email.embedding IS NULL')
      .orderBy('email.receivedAt', 'DESC')
      .limit(batchSize)
      .getMany();

    if (emails.length === 0) return 0;

    let processed = 0;
    for (const email of emails) {
      try {
        await this.embedEmail(email.id);
        processed++;
      } catch (err) {
        this.logger.error(`Failed to embed email ${email.id}: ${err}`);
      }
    }

    this.logger.log(`Embedded ${processed}/${emails.length} emails`);
    return processed;
  }

  /**
   * Semantic search — returns email IDs ranked by cosine similarity to query.
   * Requires pgvector `<=>` operator to be available.
   */
  async semanticSearch(
    userId: string,
    query: string,
    limit = 10,
  ): Promise<string[]> {
    const queryVector = await this.generateEmbedding(query);
    const vectorLiteral = `[${queryVector.join(',')}]`;

    const rows: { id: string }[] = await this.emailRepo
      .createQueryBuilder('email')
      .select('email.id', 'id')
      .where('email.userId = :userId', { userId })
      .andWhere('email.embedding IS NOT NULL')
      .orderBy(`email.embedding <=> '${vectorLiteral}'::vector`)
      .limit(limit)
      .getRawMany();

    return rows.map((r) => r.id);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private buildTextForEmbedding(email: Email): string {
    const parts: string[] = [];
    if (email.subject) parts.push(`Subject: ${email.subject}`);
    if ((email as any).fromName) parts.push(`From: ${(email as any).fromName}`);
    if ((email as any).bodyText) parts.push((email as any).bodyText.slice(0, 2000));
    else if ((email as any).bodyHtml) {
      // Strip tags for a clean plaintext signal
      const stripped = ((email as any).bodyHtml as string)
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      parts.push(stripped.slice(0, 2000));
    }
    return parts.join('\n').slice(0, 4000);
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    if (!this.openaiApiKey) {
      return new Array(EMBEDDING_DIM).fill(0);
    }

    const url = 'https://api.openai.com/v1/embeddings';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.openaiApiKey}`,
      },
      body: JSON.stringify({ input: text, model: this.embeddingModel }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI embeddings API error ${response.status}: ${body}`);
    }

    const json = (await response.json()) as {
      data: Array<{ embedding: number[] }>;
    };
    return json.data[0]?.embedding ?? new Array(EMBEDDING_DIM).fill(0);
  }
}
