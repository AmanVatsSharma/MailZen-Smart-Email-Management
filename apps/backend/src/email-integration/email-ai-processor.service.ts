/**
 * File: apps/backend/src/email-integration/email-ai-processor.service.ts
 * Purpose: Autonomous AI processing of newly synced emails.
 *
 * When a new email is saved during Gmail/Outlook sync, this service is called
 * fire-and-forget to classify and prioritize it, then persists AI-generated
 * labels (e.g. "ai:urgent_issue", "ai:high_priority") on the entity.
 *
 * Gated by ENABLE_AI_AUTO_CLASSIFY=true (default: off) to prevent surprise
 * credit/API usage for users who haven't opted in.
 *
 * Reuses SMART_REPLY_OPENAI_* env vars — no extra config needed.
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { ExternalEmailMessage } from './entities/external-email-message.entity';
import { serializeStructuredLog } from '../common/logging/structured-log.util';

type OpenAiChatResponse = {
  choices?: Array<{
    message?: { content?: string | null } | null;
  } | null>;
};

interface EmailAiAnalysis {
  classificationLabel: string;
  priorityLevel: 'HIGH' | 'MEDIUM' | 'LOW';
}

@Injectable()
export class EmailAiProcessorService {
  private readonly logger = new Logger(EmailAiProcessorService.name);

  constructor(
    @InjectRepository(ExternalEmailMessage)
    private readonly emailMessageRepo: Repository<ExternalEmailMessage>,
  ) {}

  private isEnabled(): boolean {
    return (process.env.ENABLE_AI_AUTO_CLASSIFY || 'false').trim() === 'true';
  }

  private isConfigured(): boolean {
    const enabled = (process.env.SMART_REPLY_USE_OPENAI || 'false').trim() === 'true';
    const key = String(process.env.SMART_REPLY_OPENAI_API_KEY || '').trim();
    return enabled && key.length > 0;
  }

  private async callOpenAi(systemPrompt: string, userPrompt: string): Promise<string | null> {
    const apiKey = String(process.env.SMART_REPLY_OPENAI_API_KEY || '').trim();
    const baseUrl = process.env.SMART_REPLY_OPENAI_BASE_URL || 'https://api.openai.com/v1';
    const model = process.env.SMART_REPLY_OPENAI_MODEL || 'gpt-4o-mini';
    const timeoutMs = Number(process.env.SMART_REPLY_OPENAI_TIMEOUT_MS || 6000);

    try {
      const response = await axios.post<OpenAiChatResponse>(
        `${baseUrl.replace(/\/+$/, '')}/chat/completions`,
        {
          model,
          temperature: 0.1,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        },
        {
          timeout: Number.isFinite(timeoutMs) ? Math.max(timeoutMs, 2000) : 6000,
          headers: {
            authorization: `Bearer ${apiKey}`,
            'content-type': 'application/json',
          },
        },
      );
      return String(response.data?.choices?.[0]?.message?.content || '').trim() || null;
    } catch (error: unknown) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'email_ai_processor_openai_failed',
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      return null;
    }
  }

  private tryParseJson<T>(raw: string): T | null {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const candidate = jsonMatch ? jsonMatch[0] : raw;
    try {
      return JSON.parse(candidate) as T;
    } catch {
      return null;
    }
  }

  private async analyzeEmail(
    message: Pick<ExternalEmailMessage, 'from' | 'subject' | 'snippet' | 'textBody' | 'internalDate'>,
  ): Promise<EmailAiAnalysis | null> {
    const from = String(message.from || 'Unknown').trim();
    const subject = String(message.subject || '(no subject)').trim();
    // Prefer full textBody; fall back to snippet; cap at 2000 chars for classification
    const bodyRaw = String(message.textBody || message.snippet || '').replace(/\s+/g, ' ').trim();
    const bodyContent = bodyRaw.slice(0, 2000);
    const date = message.internalDate
      ? new Date(message.internalDate).toISOString().slice(0, 10)
      : '';

    const emailContext = [
      `From: ${from}`,
      `Subject: ${subject}`,
      date ? `Date: ${date}` : null,
      bodyContent ? `Content: ${bodyContent}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const systemPrompt =
      'You are an email classification and prioritization assistant. ' +
      'Analyze the email and return ONLY a JSON object with two fields: ' +
      '"label" (one of: urgent_issue, coordination, commercial, status_tracking, support, general) and ' +
      '"priority" (one of: HIGH, MEDIUM, LOW). ' +
      'Be accurate and concise. Return nothing outside the JSON object.';

    const userPrompt = `Classify and prioritize this email:\n\n${emailContext}`;

    const raw = await this.callOpenAi(systemPrompt, userPrompt);
    if (!raw) return null;

    const parsed = this.tryParseJson<{ label: string; priority: string }>(raw);
    if (!parsed || !parsed.label || !parsed.priority) return null;

    const validLabels = new Set(['urgent_issue', 'coordination', 'commercial', 'status_tracking', 'support', 'general']);
    const validPriorities = new Set(['HIGH', 'MEDIUM', 'LOW']);

    const classificationLabel = validLabels.has(parsed.label) ? parsed.label : 'general';
    const priorityLevel = (validPriorities.has(String(parsed.priority).toUpperCase())
      ? String(parsed.priority).toUpperCase()
      : 'MEDIUM') as 'HIGH' | 'MEDIUM' | 'LOW';

    return { classificationLabel, priorityLevel };
  }

  /**
   * Process a newly synced email asynchronously.
   * Accepts a partial message with just the fields needed for analysis.
   * This is fire-and-forget — errors are logged but never thrown to the caller.
   */
  processNewEmail(message: Pick<ExternalEmailMessage, 'providerId' | 'externalMessageId' | 'from' | 'subject' | 'snippet' | 'textBody' | 'labels' | 'internalDate'>): void {
    if (!this.isEnabled() || !this.isConfigured()) return;

    setImmediate(() => {
      this.processNewEmailAsync(message).catch((error: unknown) => {
        this.logger.warn(
          serializeStructuredLog({
            event: 'email_ai_processor_unhandled_error',
            providerId: message.providerId,
            externalMessageId: message.externalMessageId,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      });
    });
  }

  private async processNewEmailAsync(
    message: Pick<ExternalEmailMessage, 'providerId' | 'externalMessageId' | 'from' | 'subject' | 'snippet' | 'textBody' | 'labels' | 'internalDate'>,
  ): Promise<void> {
    const analysis = await this.analyzeEmail(message);
    if (!analysis) {
      this.logger.debug(
        serializeStructuredLog({
          event: 'email_ai_processor_no_result',
          providerId: message.providerId,
          externalMessageId: message.externalMessageId,
        }),
      );
      return;
    }

    const { classificationLabel, priorityLevel } = analysis;
    const aiClassLabel = `ai:${classificationLabel}`;
    const aiPriorityLabel = `ai:priority_${priorityLevel.toLowerCase()}`;

    // Fetch the latest labels from DB to avoid clobbering concurrent updates
    const existing = await this.emailMessageRepo.findOne({
      where: { providerId: message.providerId, externalMessageId: message.externalMessageId },
      select: ['id', 'labels'],
    });

    if (!existing) return;

    const nonAiLabels = (existing.labels || []).filter(
      (label) => !String(label).startsWith('ai:'),
    );
    const updatedLabels = [...nonAiLabels, aiClassLabel, aiPriorityLabel];

    await this.emailMessageRepo.update(
      { id: existing.id },
      { labels: updatedLabels },
    );

    this.logger.debug(
      serializeStructuredLog({
        event: 'email_ai_processor_labels_applied',
        providerId: message.providerId,
        externalMessageId: message.externalMessageId,
        classificationLabel,
        priorityLevel,
        labels: [aiClassLabel, aiPriorityLabel],
      }),
    );
  }
}
