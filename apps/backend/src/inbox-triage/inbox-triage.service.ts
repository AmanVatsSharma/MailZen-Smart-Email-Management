/**
 * File: apps/backend/src/inbox-triage/inbox-triage.service.ts
 *
 * Proactive inbox triage scheduler.
 *
 * Runs hourly (gated by ENABLE_AI_AUTO_CLASSIFY=true) to:
 *   1. Find threads with unprocessed emails (no ai: labels) in the last 24h.
 *   2. Classify + prioritize each thread.
 *   3. Persist ai:* labels on all messages in the thread.
 *   4. Publish a UserNotification for HIGH-priority threads.
 *   5. Add ai:auto_archived label for commercial/LOW threads (junk triage).
 *
 * Processes users in batches of 10 to stay memory/CPU bounded.
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExternalEmailMessage } from '../email-integration/entities/external-email-message.entity';
import { InboxAiService } from '../ai-agent-gateway/inbox-ai.service';
import { NotificationEventBusService } from '../notification/notification-event-bus.service';
import {
  resolveCorrelationId,
  serializeStructuredLog,
} from '../common/logging/structured-log.util';

@Injectable()
export class InboxTriageService {
  private readonly logger = new Logger(InboxTriageService.name);

  private static readonly TRIAGE_LOOKBACK_HOURS = 24;
  private static readonly TRIAGE_BATCH_SIZE = 10;
  private static readonly TRIAGE_THREADS_PER_USER = 50;
  private static readonly TRIAGE_MESSAGES_PER_THREAD = 5;

  constructor(
    @InjectRepository(ExternalEmailMessage)
    private readonly emailMessageRepo: Repository<ExternalEmailMessage>,
    private readonly inboxAiService: InboxAiService,
    private readonly notificationEventBus: NotificationEventBusService,
  ) {}

  private isEnabled(): boolean {
    return (process.env.ENABLE_AI_AUTO_CLASSIFY || 'false').trim() === 'true';
  }

  private isConfigured(): boolean {
    const enabled = (process.env.SMART_REPLY_USE_OPENAI || 'false').trim() === 'true';
    const key = String(process.env.SMART_REPLY_OPENAI_API_KEY || '').trim();
    return enabled && key.length > 0;
  }

  private getLookbackDate(): Date {
    const lookbackMs = InboxTriageService.TRIAGE_LOOKBACK_HOURS * 60 * 60 * 1000;
    return new Date(Date.now() - lookbackMs);
  }

  private isHighPriority(priorityLevel: string): boolean {
    return priorityLevel === 'HIGH';
  }

  private isJunkCandidate(classLabel: string, priorityLevel: string): boolean {
    return (classLabel === 'commercial') && priorityLevel === 'LOW';
  }

  /**
   * Find distinct user IDs that have unclassified emails in the lookback window.
   */
  private async getActiveUserIds(): Promise<string[]> {
    const since = this.getLookbackDate();
    const rows = await this.emailMessageRepo
      .createQueryBuilder('msg')
      .select('DISTINCT msg."userId"', 'userId')
      .where('msg."createdAt" >= :since', { since })
      .andWhere(`NOT EXISTS (
        SELECT 1 FROM unnest(msg.labels) AS lbl WHERE lbl LIKE 'ai:%'
      )`)
      .limit(500)
      .getRawMany<{ userId: string }>();
    return rows.map((r) => r.userId).filter(Boolean);
  }

  /**
   * For a single user, find unclassified threads from the last 24h and triage them.
   */
  private async triageUser(userId: string, runCorrelationId: string): Promise<void> {
    const since = this.getLookbackDate();

    // Get distinct thread IDs with unclassified messages
    const threadRows = await this.emailMessageRepo
      .createQueryBuilder('msg')
      .select('DISTINCT COALESCE(msg."threadId", msg."externalMessageId")', 'threadId')
      .where('msg."userId" = :userId', { userId })
      .andWhere('msg."createdAt" >= :since', { since })
      .andWhere(`NOT EXISTS (
        SELECT 1 FROM unnest(msg.labels) AS lbl WHERE lbl LIKE 'ai:%'
      )`)
      .limit(InboxTriageService.TRIAGE_THREADS_PER_USER)
      .getRawMany<{ threadId: string }>();

    if (!threadRows.length) return;

    for (const { threadId } of threadRows) {
      try {
        await this.triageThread({ userId, threadId, runCorrelationId });
      } catch (error: unknown) {
        this.logger.warn(
          serializeStructuredLog({
            event: 'inbox_triage_thread_failed',
            userId,
            threadId,
            runCorrelationId,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    }
  }

  private async triageThread(input: {
    userId: string;
    threadId: string;
    runCorrelationId: string;
  }): Promise<void> {
    const { userId, threadId, runCorrelationId } = input;

    // Load recent messages for this thread
    const messages = await this.emailMessageRepo.find({
      where: [
        { userId, threadId },
        { userId, externalMessageId: threadId },
      ],
      order: { internalDate: 'DESC', createdAt: 'DESC' },
      take: InboxTriageService.TRIAGE_MESSAGES_PER_THREAD,
    });

    if (!messages.length) return;

    // Run classify + prioritize in parallel
    const [classResult, priorityResult] = await Promise.all([
      this.inboxAiService.classifyThread(messages).catch(() => null),
      this.inboxAiService.prioritizeThread(messages).catch(() => null),
    ]);

    if (!classResult && !priorityResult) return;

    const classLabel = classResult?.label ?? 'general';
    const priorityLevel = priorityResult?.level ?? 'MEDIUM';

    const aiClassLabel = `ai:${classLabel}`;
    const aiPriorityLabel = `ai:priority_${priorityLevel.toLowerCase()}`;
    const extraLabels: string[] = [];

    if (this.isJunkCandidate(classLabel, priorityLevel)) {
      extraLabels.push('ai:auto_archived');
    }

    // Update all messages in this thread with AI labels (non-destructive merge)
    await Promise.all(
      messages.map(async (msg) => {
        const nonAiLabels = (msg.labels || []).filter(
          (l) => !String(l).startsWith('ai:'),
        );
        const updatedLabels = [...nonAiLabels, aiClassLabel, aiPriorityLabel, ...extraLabels];
        await this.emailMessageRepo.update({ id: msg.id }, { labels: updatedLabels });
      }),
    );

    this.logger.debug(
      serializeStructuredLog({
        event: 'inbox_triage_thread_classified',
        userId,
        threadId,
        runCorrelationId,
        classLabel,
        priorityLevel,
        messageCount: messages.length,
        autoArchived: extraLabels.includes('ai:auto_archived'),
      }),
    );

    // Publish notification for HIGH priority threads
    if (this.isHighPriority(priorityLevel)) {
      const subject = String(messages[0]?.subject || 'a thread') + '';
      await this.notificationEventBus.publishSafely({
        userId,
        type: 'AI_INBOX_TRIAGE',
        title: 'Urgent thread detected',
        message: `AI flagged "${subject.slice(0, 80)}" as high priority. ${priorityResult?.message ?? ''}`.trim(),
        metadata: {
          threadId,
          classLabel,
          priorityLevel,
          priorityScore: priorityResult?.score ?? null,
          runCorrelationId,
        },
      });
    }
  }

  @Cron('0 * * * *')
  async runHourlyTriage(): Promise<void> {
    if (!this.isEnabled() || !this.isConfigured()) return;

    const runCorrelationId = resolveCorrelationId(undefined);
    this.logger.log(
      serializeStructuredLog({
        event: 'inbox_triage_run_start',
        runCorrelationId,
      }),
    );

    let processedUsers = 0;
    let totalThreads = 0;
    const startMs = Date.now();

    try {
      const userIds = await this.getActiveUserIds();
      if (!userIds.length) {
        this.logger.log(
          serializeStructuredLog({
            event: 'inbox_triage_run_no_users',
            runCorrelationId,
          }),
        );
        return;
      }

      // Process users in batches to limit concurrency
      for (let i = 0; i < userIds.length; i += InboxTriageService.TRIAGE_BATCH_SIZE) {
        const batch = userIds.slice(i, i + InboxTriageService.TRIAGE_BATCH_SIZE);
        await Promise.all(
          batch.map(async (userId) => {
            await this.triageUser(userId, runCorrelationId);
            processedUsers += 1;
          }),
        );
      }

      this.logger.log(
        serializeStructuredLog({
          event: 'inbox_triage_run_complete',
          runCorrelationId,
          processedUsers,
          durationMs: Date.now() - startMs,
        }),
      );
    } catch (error: unknown) {
      this.logger.error(
        serializeStructuredLog({
          event: 'inbox_triage_run_failed',
          runCorrelationId,
          error: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - startMs,
        }),
      );
    }
  }
}
