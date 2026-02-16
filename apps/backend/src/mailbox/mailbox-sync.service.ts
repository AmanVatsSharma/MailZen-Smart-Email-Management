import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { randomUUID } from 'crypto';
import {
  FindOptionsWhere,
  In,
  LessThan,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import {
  resolveCorrelationId,
  serializeStructuredLog,
} from '../common/logging/structured-log.util';
import { MailboxInboundWebhookInput } from './dto/mailbox-inbound-webhook.input';
import { Mailbox } from './entities/mailbox.entity';
import { MailboxSyncRun } from './entities/mailbox-sync-run.entity';
import { MailboxInboundService } from './mailbox-inbound.service';
import { NotificationEventBusService } from '../notification/notification-event-bus.service';
import { UserNotification } from '../notification/entities/user-notification.entity';

type MailboxSyncPullMessage = {
  mailboxEmail?: string;
  from?: string;
  to?: string[] | string;
  subject?: string;
  textBody?: string;
  htmlBody?: string;
  body?: string;
  messageId?: string;
  id?: string;
  inReplyTo?: string;
  replyToMessageId?: string;
  sizeBytes?: string | number;
  size?: string | number;
};

type MailboxSyncPollResult = {
  mailboxId: string;
  mailboxEmail: string;
  fetchedMessages: number;
  acceptedMessages: number;
  deduplicatedMessages: number;
  rejectedMessages: number;
  nextCursor: string | null;
};

type MailboxSyncAggregateResult = {
  polledMailboxes: number;
  skippedMailboxes: number;
  failedMailboxes: number;
  fetchedMessages: number;
  acceptedMessages: number;
  deduplicatedMessages: number;
  rejectedMessages: number;
};

type MailboxSyncTriggerSource = 'SCHEDULER' | 'MANUAL';
type MailboxSyncRunStatus = 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'SKIPPED';

@Injectable()
export class MailboxSyncService {
  private readonly logger = new Logger(MailboxSyncService.name);
  private static readonly DEFAULT_SYNC_OBSERVABILITY_WINDOW_HOURS = 24;
  private static readonly MAX_SYNC_OBSERVABILITY_WINDOW_HOURS = 24 * 90;
  private static readonly DEFAULT_SYNC_OBSERVABILITY_BUCKET_MINUTES = 60;
  private static readonly MIN_SYNC_OBSERVABILITY_BUCKET_MINUTES = 5;
  private static readonly MAX_SYNC_OBSERVABILITY_BUCKET_MINUTES = 24 * 60;
  private static readonly DEFAULT_SYNC_RUN_HISTORY_LIMIT = 50;
  private static readonly MAX_SYNC_RUN_HISTORY_LIMIT = 500;
  private static readonly DEFAULT_SYNC_RUN_SCAN_LIMIT = 5000;

  constructor(
    @InjectRepository(Mailbox)
    private readonly mailboxRepo: Repository<Mailbox>,
    @InjectRepository(MailboxSyncRun)
    private readonly mailboxSyncRunRepo: Repository<MailboxSyncRun>,
    @InjectRepository(UserNotification)
    private readonly notificationRepo: Repository<UserNotification>,
    private readonly mailboxInboundService: MailboxInboundService,
    private readonly notificationEventBus: NotificationEventBusService,
  ) {}

  private resolveIntegerEnv(input: {
    rawValue: string | undefined;
    fallbackValue: number;
    minimumValue: number;
    maximumValue: number;
  }): number {
    const parsed = Number(input.rawValue);
    const normalized = Number.isFinite(parsed)
      ? Math.floor(parsed)
      : input.fallbackValue;
    if (normalized < input.minimumValue) return input.minimumValue;
    if (normalized > input.maximumValue) return input.maximumValue;
    return normalized;
  }

  private normalizeSyncObservabilityWindowHours(
    rawValue?: number | null,
  ): number {
    const fallback = this.resolveIntegerEnv({
      rawValue: process.env.MAILZEN_MAIL_SYNC_OBSERVABILITY_WINDOW_HOURS,
      fallbackValue: MailboxSyncService.DEFAULT_SYNC_OBSERVABILITY_WINDOW_HOURS,
      minimumValue: 1,
      maximumValue: MailboxSyncService.MAX_SYNC_OBSERVABILITY_WINDOW_HOURS,
    });
    return this.resolveIntegerEnv({
      rawValue:
        typeof rawValue === 'number' && Number.isFinite(rawValue)
          ? String(rawValue)
          : undefined,
      fallbackValue: fallback,
      minimumValue: 1,
      maximumValue: MailboxSyncService.MAX_SYNC_OBSERVABILITY_WINDOW_HOURS,
    });
  }

  private normalizeSyncObservabilityBucketMinutes(
    rawValue?: number | null,
  ): number {
    const fallback = this.resolveIntegerEnv({
      rawValue: process.env.MAILZEN_MAIL_SYNC_OBSERVABILITY_BUCKET_MINUTES,
      fallbackValue:
        MailboxSyncService.DEFAULT_SYNC_OBSERVABILITY_BUCKET_MINUTES,
      minimumValue: MailboxSyncService.MIN_SYNC_OBSERVABILITY_BUCKET_MINUTES,
      maximumValue: MailboxSyncService.MAX_SYNC_OBSERVABILITY_BUCKET_MINUTES,
    });
    return this.resolveIntegerEnv({
      rawValue:
        typeof rawValue === 'number' && Number.isFinite(rawValue)
          ? String(rawValue)
          : undefined,
      fallbackValue: fallback,
      minimumValue: MailboxSyncService.MIN_SYNC_OBSERVABILITY_BUCKET_MINUTES,
      maximumValue: MailboxSyncService.MAX_SYNC_OBSERVABILITY_BUCKET_MINUTES,
    });
  }

  private normalizeSyncRunHistoryLimit(rawValue?: number | null): number {
    return this.resolveIntegerEnv({
      rawValue:
        typeof rawValue === 'number' && Number.isFinite(rawValue)
          ? String(rawValue)
          : undefined,
      fallbackValue: MailboxSyncService.DEFAULT_SYNC_RUN_HISTORY_LIMIT,
      minimumValue: 1,
      maximumValue: MailboxSyncService.MAX_SYNC_RUN_HISTORY_LIMIT,
    });
  }

  private resolveSyncRunScanLimit(): number {
    return this.resolveIntegerEnv({
      rawValue: process.env.MAILZEN_MAIL_SYNC_OBSERVABILITY_MAX_RUNS_SCAN,
      fallbackValue: MailboxSyncService.DEFAULT_SYNC_RUN_SCAN_LIMIT,
      minimumValue: 100,
      maximumValue: 20000,
    });
  }

  private resolveSyncRunRetentionDays(
    rawValue?: number | string | null,
  ): number {
    return this.resolveIntegerEnv({
      rawValue:
        rawValue === null || rawValue === undefined
          ? process.env.MAILZEN_MAILBOX_SYNC_RUN_RETENTION_DAYS
          : String(rawValue),
      fallbackValue: 90,
      minimumValue: 7,
      maximumValue: 3650,
    });
  }

  private normalizeSyncRunStatus(
    rawValue?: string | null,
  ): MailboxSyncRunStatus {
    const normalized = String(rawValue || '')
      .trim()
      .toUpperCase();
    if (normalized === 'SUCCESS') return 'SUCCESS';
    if (normalized === 'PARTIAL') return 'PARTIAL';
    if (normalized === 'SKIPPED') return 'SKIPPED';
    return 'FAILED';
  }

  private normalizeSyncIncidentMetadataStatus(
    metadata?: Record<string, unknown> | null,
  ): 'WARNING' | 'CRITICAL' | 'UNKNOWN' {
    const rawStatus = metadata?.incidentStatus;
    const normalized =
      typeof rawStatus === 'string' || typeof rawStatus === 'number'
        ? String(rawStatus).trim().toUpperCase()
        : '';
    if (normalized === 'CRITICAL') return 'CRITICAL';
    if (normalized === 'WARNING') return 'WARNING';
    return 'UNKNOWN';
  }

  private resolveMetadataNumber(input: {
    metadata?: Record<string, unknown> | null;
    key: string;
    fallbackValue?: number;
  }): number {
    const rawValue = input.metadata?.[input.key];
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) return input.fallbackValue ?? 0;
    return parsed;
  }

  private normalizeWorkspaceId(workspaceId?: string | null): string | null {
    return String(workspaceId || '').trim() || null;
  }

  private async resolveSyncObservabilityScope(input: {
    userId: string;
    mailboxId?: string | null;
    workspaceId?: string | null;
  }): Promise<{
    mailboxId: string | null;
    workspaceId: string | null;
  }> {
    const mailboxId = String(input.mailboxId || '').trim() || null;
    const workspaceId = this.normalizeWorkspaceId(input.workspaceId);
    if (!mailboxId) {
      return {
        mailboxId: null,
        workspaceId,
      };
    }
    const mailbox = await this.mailboxRepo.findOne({
      where: workspaceId
        ? {
            id: mailboxId,
            userId: input.userId,
            workspaceId,
          }
        : {
            id: mailboxId,
            userId: input.userId,
          },
      select: ['id', 'workspaceId'],
    });
    if (!mailbox) {
      throw new NotFoundException('Mailbox not found');
    }
    return {
      mailboxId: mailbox.id,
      workspaceId: mailbox.workspaceId || workspaceId || null,
    };
  }

  private resolveSyncApiBaseUrl(): string {
    return String(process.env.MAILZEN_MAIL_SYNC_API_URL || '')
      .trim()
      .replace(/\/$/, '');
  }

  private resolveSyncTimeoutMs(): number {
    return this.resolveIntegerEnv({
      rawValue: process.env.MAILZEN_MAIL_SYNC_TIMEOUT_MS,
      fallbackValue: 5000,
      minimumValue: 500,
      maximumValue: 60_000,
    });
  }

  private resolveSyncBatchLimit(): number {
    return this.resolveIntegerEnv({
      rawValue: process.env.MAILZEN_MAIL_SYNC_BATCH_LIMIT,
      fallbackValue: 25,
      minimumValue: 1,
      maximumValue: 200,
    });
  }

  private resolveSyncPullRetries(): number {
    return this.resolveIntegerEnv({
      rawValue: process.env.MAILZEN_MAIL_SYNC_RETRIES,
      fallbackValue: 2,
      minimumValue: 0,
      maximumValue: 6,
    });
  }

  private resolveSyncRetryBackoffMs(): number {
    return this.resolveIntegerEnv({
      rawValue: process.env.MAILZEN_MAIL_SYNC_RETRY_BACKOFF_MS,
      fallbackValue: 250,
      minimumValue: 50,
      maximumValue: 30_000,
    });
  }

  private resolveSyncRetryJitterMs(): number {
    return this.resolveIntegerEnv({
      rawValue: process.env.MAILZEN_MAIL_SYNC_RETRY_JITTER_MS,
      fallbackValue: 125,
      minimumValue: 0,
      maximumValue: 10_000,
    });
  }

  private resolveSyncMaxMailboxesPerRun(): number {
    return this.resolveIntegerEnv({
      rawValue: process.env.MAILZEN_MAIL_SYNC_MAX_MAILBOXES_PER_RUN,
      fallbackValue: 250,
      minimumValue: 1,
      maximumValue: 5000,
    });
  }

  private resolveSyncLeaseTtlSeconds(): number {
    return this.resolveIntegerEnv({
      rawValue: process.env.MAILZEN_MAIL_SYNC_LEASE_TTL_SECONDS,
      fallbackValue: 180,
      minimumValue: 30,
      maximumValue: 3600,
    });
  }

  private resolveSyncFailFastOnMessageError(): boolean {
    const normalized = String(process.env.MAILZEN_MAIL_SYNC_FAIL_FAST || 'true')
      .trim()
      .toLowerCase();
    return !['false', '0', 'off', 'no'].includes(normalized);
  }

  private resolveCursorParamName(): string {
    const rawValue = String(
      process.env.MAILZEN_MAIL_SYNC_CURSOR_PARAM || 'cursor',
    ).trim();
    if (!rawValue) return 'cursor';
    return rawValue;
  }

  private normalizeTriggerSource(
    rawValue?: string | null,
  ): MailboxSyncTriggerSource {
    const normalized = String(rawValue || '')
      .trim()
      .toUpperCase();
    if (normalized === 'MANUAL') return 'MANUAL';
    return 'SCHEDULER';
  }

  private resolveRunStatusFromPollResult(
    pollResult: MailboxSyncPollResult,
  ): MailboxSyncRunStatus {
    if (pollResult.rejectedMessages > 0) return 'PARTIAL';
    return 'SUCCESS';
  }

  private resolveErrorMessage(error: unknown): string | null {
    const normalized = String(this.describeSyncError(error) || '')
      .trim()
      .slice(0, 500);
    if (!normalized) return null;
    return normalized;
  }

  private async persistMailboxSyncRun(input: {
    mailbox: Mailbox;
    triggerSource: MailboxSyncTriggerSource;
    runCorrelationId: string;
    status: MailboxSyncRunStatus;
    fetchedMessages: number;
    acceptedMessages: number;
    deduplicatedMessages: number;
    rejectedMessages: number;
    nextCursor?: string | null;
    errorMessage?: string | null;
    startedAt: Date;
    completedAt: Date;
  }): Promise<void> {
    const userId = String(input.mailbox.userId || '').trim();
    if (!userId) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'mailbox_sync_run_persist_skipped_missing_user',
          mailboxId: input.mailbox.id,
          triggerSource: input.triggerSource,
          status: input.status,
        }),
      );
      return;
    }
    const durationMs = Math.max(
      0,
      input.completedAt.getTime() - input.startedAt.getTime(),
    );
    try {
      await this.mailboxSyncRunRepo.save(
        this.mailboxSyncRunRepo.create({
          mailboxId: input.mailbox.id,
          userId,
          workspaceId: input.mailbox.workspaceId || null,
          triggerSource: input.triggerSource,
          runCorrelationId: input.runCorrelationId,
          status: input.status,
          fetchedMessages: Math.max(0, Math.floor(input.fetchedMessages)),
          acceptedMessages: Math.max(0, Math.floor(input.acceptedMessages)),
          deduplicatedMessages: Math.max(
            0,
            Math.floor(input.deduplicatedMessages),
          ),
          rejectedMessages: Math.max(0, Math.floor(input.rejectedMessages)),
          nextCursor: String(input.nextCursor || '').trim() || null,
          errorMessage: String(input.errorMessage || '').trim() || null,
          startedAt: input.startedAt,
          completedAt: input.completedAt,
          durationMs,
        }),
      );
    } catch (error: unknown) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'mailbox_sync_run_persist_failed',
          mailboxId: input.mailbox.id,
          runCorrelationId: input.runCorrelationId,
          status: input.status,
          reason: this.resolveErrorMessage(error),
        }),
      );
    }
  }

  private resolveSyncRequestHeaders(): {
    authorization?: string;
    'x-api-key'?: string;
    'content-type': string;
  } {
    const token = String(process.env.MAILZEN_MAIL_SYNC_API_TOKEN || '').trim();
    const tokenHeader = String(
      process.env.MAILZEN_MAIL_SYNC_API_TOKEN_HEADER || 'authorization',
    )
      .trim()
      .toLowerCase();
    if (!token) {
      return {
        'content-type': 'application/json',
      };
    }
    if (tokenHeader === 'x-api-key') {
      return {
        'content-type': 'application/json',
        'x-api-key': token,
      };
    }
    return {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    };
  }

  private resolvePullMessages(rawData: unknown): MailboxSyncPullMessage[] {
    if (!rawData || typeof rawData !== 'object') return [];
    const asRecord = rawData as Record<string, unknown>;
    const directMessages = asRecord.messages;
    if (Array.isArray(directMessages)) {
      return directMessages as MailboxSyncPullMessage[];
    }
    const valueMessages = asRecord.value;
    if (Array.isArray(valueMessages)) {
      return valueMessages as MailboxSyncPullMessage[];
    }
    const itemMessages = asRecord.items;
    if (Array.isArray(itemMessages)) {
      return itemMessages as MailboxSyncPullMessage[];
    }
    return [];
  }

  private resolveNextCursor(rawData: unknown): string | null {
    if (!rawData || typeof rawData !== 'object') return null;
    const asRecord = rawData as Record<string, unknown>;
    const candidates = [asRecord.nextCursor, asRecord.cursor, asRecord.next];
    for (const candidate of candidates) {
      const normalized =
        typeof candidate === 'string' || typeof candidate === 'number'
          ? String(candidate).trim()
          : '';
      if (normalized) return normalized;
    }
    return null;
  }

  private normalizeToRecipients(
    input: MailboxSyncPullMessage,
    mailboxEmail: string,
  ): string[] {
    const directRecipients = (() => {
      if (Array.isArray(input.to)) {
        return input.to
          .map((entry) => String(entry || '').trim())
          .filter(Boolean);
      }
      const singleRecipient = String(input.to || '').trim();
      if (!singleRecipient) return [];
      return [singleRecipient];
    })();
    if (!directRecipients.includes(mailboxEmail)) {
      directRecipients.push(mailboxEmail);
    }
    return directRecipients;
  }

  private mapPulledMessageToInboundInput(input: {
    mailbox: Mailbox;
    message: MailboxSyncPullMessage;
  }): MailboxInboundWebhookInput {
    const mailboxEmail = String(
      input.message.mailboxEmail || input.mailbox.email || '',
    )
      .trim()
      .toLowerCase();
    const from = String(input.message.from || '')
      .trim()
      .toLowerCase();
    const subject = String(input.message.subject || '(no subject)').trim();
    const textBody = String(
      input.message.textBody || input.message.body || '',
    ).trim();
    const htmlBody = String(input.message.htmlBody || '').trim();
    const messageId = String(
      input.message.messageId || input.message.id || '',
    ).trim();
    const inReplyTo = String(
      input.message.inReplyTo || input.message.replyToMessageId || '',
    ).trim();
    const sizeBytesRaw = input.message.sizeBytes ?? input.message.size;
    const sizeBytes = String(sizeBytesRaw ?? '').trim();

    return {
      mailboxEmail: mailboxEmail || input.mailbox.email,
      from,
      to: this.normalizeToRecipients(input.message, input.mailbox.email),
      subject,
      textBody: textBody || undefined,
      htmlBody: htmlBody || undefined,
      messageId: messageId || undefined,
      inReplyTo: inReplyTo || undefined,
      sizeBytes: sizeBytes || undefined,
    };
  }

  private describeSyncError(error: unknown): string {
    if (axios.isAxiosError(error)) {
      const status = Number(error.response?.status || 0);
      const code = String(error.code || '').trim();
      const message = String(error.message || 'axios error').trim();
      const dataSnippet = JSON.stringify(error.response?.data || '')
        .replace(/\s+/g, ' ')
        .slice(0, 180);
      const parts = [
        message,
        status ? `status=${status}` : null,
        code ? `code=${code}` : null,
        dataSnippet ? `data=${dataSnippet}` : null,
      ].filter(Boolean);
      return parts.join(' ');
    }
    if (error instanceof Error) return error.message;
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  private async publishSyncFailureNotification(input: {
    mailbox: Mailbox;
    errorMessage: string;
  }): Promise<void> {
    const userId = String(input.mailbox.userId || '').trim();
    if (!userId) return;

    const normalizedErrorMessage = String(input.errorMessage || '')
      .trim()
      .slice(0, 500);
    const previousErrorMessage = String(
      input.mailbox.inboundSyncLastError || '',
    )
      .trim()
      .slice(0, 500);
    if (
      !normalizedErrorMessage ||
      normalizedErrorMessage === previousErrorMessage
    ) {
      return;
    }

    await this.notificationEventBus.publishSafely({
      userId,
      type: 'SYNC_FAILED',
      title: 'Mailbox sync failed',
      message:
        'MailZen failed to sync your @mailzen.com mailbox. We will retry automatically.',
      metadata: {
        mailboxId: input.mailbox.id,
        mailboxEmail: input.mailbox.email,
        workspaceId: input.mailbox.workspaceId || null,
        providerType: 'MAILBOX',
        error: normalizedErrorMessage.slice(0, 240),
      },
    });
  }

  private async publishSyncRecoveredNotification(input: {
    mailbox: Mailbox;
  }): Promise<void> {
    const userId = String(input.mailbox.userId || '').trim();
    if (!userId) return;
    const hadPriorSyncError =
      String(input.mailbox.inboundSyncLastError || '').trim() ||
      String(input.mailbox.inboundSyncStatus || '')
        .trim()
        .toLowerCase() === 'error';
    if (!hadPriorSyncError) return;

    await this.notificationEventBus.publishSafely({
      userId,
      type: 'SYNC_RECOVERED',
      title: 'Mailbox sync recovered',
      message:
        'MailZen has recovered synchronization for your @mailzen.com mailbox.',
      metadata: {
        mailboxId: input.mailbox.id,
        mailboxEmail: input.mailbox.email,
        workspaceId: input.mailbox.workspaceId || null,
        providerType: 'MAILBOX',
      },
    });
  }

  private isRetryablePullError(error: unknown): boolean {
    if (!axios.isAxiosError(error)) return false;
    const status = Number(error.response?.status || 0);
    if (status === 429) return true;
    if (status >= 500 && status <= 599) return true;
    const code = String(error.code || '')
      .trim()
      .toUpperCase();
    return (
      code === 'ECONNABORTED' ||
      code === 'ECONNRESET' ||
      code === 'ETIMEDOUT' ||
      code === 'EAI_AGAIN' ||
      code === 'ENOTFOUND'
    );
  }

  private async sleep(ms: number): Promise<void> {
    if (!Number.isFinite(ms) || ms <= 0) return;
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async pullMailboxMessagesWithRetry(input: {
    mailbox: Mailbox;
    endpoint: string;
    timeoutMs: number;
    params: Record<string, unknown>;
    headers: Record<string, string>;
  }): Promise<unknown> {
    const maxRetries = this.resolveSyncPullRetries();
    const backoffMs = this.resolveSyncRetryBackoffMs();
    const maxJitterMs = this.resolveSyncRetryJitterMs();

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        const response = await axios.get(input.endpoint, {
          timeout: input.timeoutMs,
          params: input.params,
          headers: input.headers,
        });
        return response.data;
      } catch (error: unknown) {
        const isRetryable = this.isRetryablePullError(error);
        const isLastAttempt = attempt >= maxRetries;
        if (!isRetryable || isLastAttempt) {
          throw error;
        }
        const jitterMs =
          maxJitterMs > 0 ? Math.floor(Math.random() * (maxJitterMs + 1)) : 0;
        const waitMs = backoffMs * (attempt + 1) + jitterMs;
        const errorMessage = this.describeSyncError(error);
        this.logger.warn(
          `mailbox-sync: retrying mailbox pull mailboxId=${input.mailbox.id} email=${input.mailbox.email} attempt=${attempt + 1} waitMs=${waitMs} error=${errorMessage}`,
        );
        await this.sleep(waitMs);
      }
    }
    throw new Error('Mailbox sync retry loop exhausted unexpectedly');
  }

  private async acquireMailboxSyncLease(input: {
    mailboxId: string;
  }): Promise<{ acquired: false } | { acquired: true; leaseToken: string }> {
    const now = new Date();
    const leaseToken = randomUUID();
    const leaseExpiresAt = new Date(
      now.getTime() + this.resolveSyncLeaseTtlSeconds() * 1000,
    );
    const rowsUnknown: unknown = await this.mailboxRepo.query(
      `
      UPDATE "mailboxes"
      SET
        "inboundSyncLeaseToken" = $2,
        "inboundSyncLeaseExpiresAt" = $3
      WHERE id = $1
        AND "status" = 'ACTIVE'
        AND (
          "inboundSyncLeaseExpiresAt" IS NULL
          OR "inboundSyncLeaseExpiresAt" < $4
        )
      RETURNING id
      `,
      [
        input.mailboxId,
        leaseToken,
        leaseExpiresAt.toISOString(),
        now.toISOString(),
      ],
    );
    const rows = Array.isArray(rowsUnknown) ? rowsUnknown : [];
    if (!rows.length) return { acquired: false };
    return {
      acquired: true,
      leaseToken,
    };
  }

  private async releaseMailboxSyncLease(input: {
    mailboxId: string;
    leaseToken: string;
  }): Promise<void> {
    await this.mailboxRepo.query(
      `
      UPDATE "mailboxes"
      SET
        "inboundSyncLeaseToken" = NULL,
        "inboundSyncLeaseExpiresAt" = NULL
      WHERE id = $1
        AND "inboundSyncLeaseToken" = $2
      `,
      [input.mailboxId, input.leaseToken],
    );
  }

  private async pollMailboxWithLease(
    mailbox: Mailbox,
    context?: {
      triggerSource?: MailboxSyncTriggerSource;
      runCorrelationId?: string;
    },
  ): Promise<
    | { skipped: true; failed: false }
    | { skipped: false; failed: true }
    | { skipped: false; failed: false; result: MailboxSyncPollResult }
  > {
    const triggerSource = this.normalizeTriggerSource(context?.triggerSource);
    const runCorrelationId = resolveCorrelationId(context?.runCorrelationId);
    const startedAt = new Date();
    const leaseResult = await this.acquireMailboxSyncLease({
      mailboxId: mailbox.id,
    });
    if (!leaseResult.acquired) {
      await this.persistMailboxSyncRun({
        mailbox,
        triggerSource,
        runCorrelationId,
        status: 'SKIPPED',
        fetchedMessages: 0,
        acceptedMessages: 0,
        deduplicatedMessages: 0,
        rejectedMessages: 0,
        nextCursor: String(mailbox.inboundSyncCursor || '').trim() || null,
        errorMessage: 'sync lease not acquired',
        startedAt,
        completedAt: new Date(),
      });
      return { skipped: true, failed: false };
    }

    try {
      const result = await this.pollMailbox(mailbox, {
        triggerSource,
        runCorrelationId,
      });
      return { skipped: false, failed: false, result };
    } catch (error: unknown) {
      const errorMessage = this.describeSyncError(error);
      this.logger.warn(
        serializeStructuredLog({
          event: 'mailbox_sync_mailbox_poll_failed',
          mailboxId: mailbox.id,
          runCorrelationId,
          triggerSource,
          reason: errorMessage,
        }),
      );
      return { skipped: false, failed: true };
    } finally {
      await this.releaseMailboxSyncLease({
        mailboxId: mailbox.id,
        leaseToken: leaseResult.leaseToken,
      });
    }
  }

  async pollMailbox(
    mailbox: Mailbox,
    context?: {
      triggerSource?: MailboxSyncTriggerSource;
      runCorrelationId?: string;
    },
  ): Promise<MailboxSyncPollResult> {
    const startedAt = new Date();
    const triggerSource = this.normalizeTriggerSource(context?.triggerSource);
    const runCorrelationId = resolveCorrelationId(context?.runCorrelationId);
    const apiBaseUrl = this.resolveSyncApiBaseUrl();
    if (!apiBaseUrl) {
      throw new Error('MAILZEN_MAIL_SYNC_API_URL must be configured');
    }

    await this.mailboxRepo.update(
      { id: mailbox.id },
      {
        inboundSyncStatus: 'syncing',
      },
    );

    const timeoutMs = this.resolveSyncTimeoutMs();
    const batchLimit = this.resolveSyncBatchLimit();
    const cursorParamName = this.resolveCursorParamName();
    const cursor = String(mailbox.inboundSyncCursor || '').trim();
    const endpoint = `${apiBaseUrl}/mailboxes/${encodeURIComponent(mailbox.email)}/messages`;
    const params = {
      limit: batchLimit,
      ...(cursor ? { [cursorParamName]: cursor } : {}),
    };
    const headers = {
      ...this.resolveSyncRequestHeaders(),
      'x-mailzen-mailbox-email': mailbox.email,
    };

    let fetchedMessages = 0;
    let acceptedMessages = 0;
    let deduplicatedMessages = 0;
    let rejectedMessages = 0;
    let finalStatus: MailboxSyncRunStatus = 'FAILED';
    let finalErrorMessage: string | null = null;
    let finalCursor: string | null = cursor || null;

    try {
      const responseData = await this.pullMailboxMessagesWithRetry({
        mailbox,
        endpoint,
        timeoutMs,
        params,
        headers,
      });
      const messages = this.resolvePullMessages(responseData);
      const nextCursor = this.resolveNextCursor(responseData);
      fetchedMessages = messages.length;
      this.logger.log(
        serializeStructuredLog({
          event: 'mailbox_sync_pull_batch_received',
          mailboxId: mailbox.id,
          runCorrelationId,
          triggerSource,
          fetchedMessages,
        }),
      );

      for (const message of messages) {
        try {
          const inboundInput = this.mapPulledMessageToInboundInput({
            mailbox,
            message,
          });
          const ingestResult =
            await this.mailboxInboundService.ingestInboundEvent(
              inboundInput,
              {
                requestIdHeader: `mailbox-sync:${mailbox.id}:${Date.now()}`,
              },
              {
                skipAuth: true,
              },
            );
          if (ingestResult.deduplicated) {
            deduplicatedMessages += 1;
            continue;
          }
          acceptedMessages += 1;
        } catch (error: unknown) {
          rejectedMessages += 1;
          const errorMessage = this.describeSyncError(error);
          this.logger.warn(
            serializeStructuredLog({
              event: 'mailbox_sync_inbound_ingest_failed',
              mailboxId: mailbox.id,
              runCorrelationId,
              triggerSource,
              messageId: String(message.messageId || message.id || 'unknown'),
              reason: errorMessage,
            }),
          );
          if (this.resolveSyncFailFastOnMessageError()) {
            throw error;
          }
        }
      }

      const persistedCursor = nextCursor || cursor || null;
      finalCursor = persistedCursor;
      await this.mailboxRepo.update(
        { id: mailbox.id },
        {
          inboundSyncCursor: persistedCursor,
          inboundSyncStatus: 'connected',
          inboundSyncLastPolledAt: new Date(),
          inboundSyncLastError: null,
          inboundSyncLastErrorAt: null,
        },
      );
      await this.publishSyncRecoveredNotification({
        mailbox,
      });
      finalStatus = this.resolveRunStatusFromPollResult({
        mailboxId: mailbox.id,
        mailboxEmail: mailbox.email,
        fetchedMessages,
        acceptedMessages,
        deduplicatedMessages,
        rejectedMessages,
        nextCursor: persistedCursor,
      });
      return {
        mailboxId: mailbox.id,
        mailboxEmail: mailbox.email,
        fetchedMessages,
        acceptedMessages,
        deduplicatedMessages,
        rejectedMessages,
        nextCursor: persistedCursor,
      };
    } catch (error: unknown) {
      const errorMessage = this.describeSyncError(error);
      finalErrorMessage = errorMessage.slice(0, 500);
      await this.mailboxRepo.update(
        { id: mailbox.id },
        {
          inboundSyncStatus: 'error',
          inboundSyncLastPolledAt: new Date(),
          inboundSyncLastError: finalErrorMessage,
          inboundSyncLastErrorAt: new Date(),
        },
      );
      await this.publishSyncFailureNotification({
        mailbox,
        errorMessage,
      });
      throw error;
    } finally {
      const completedAt = new Date();
      await this.persistMailboxSyncRun({
        mailbox,
        triggerSource,
        runCorrelationId,
        status: finalStatus,
        fetchedMessages,
        acceptedMessages,
        deduplicatedMessages,
        rejectedMessages,
        nextCursor: finalCursor,
        errorMessage: finalErrorMessage,
        startedAt,
        completedAt,
      });
      this.logger.log(
        serializeStructuredLog({
          event: 'mailbox_sync_poll_processed',
          mailboxId: mailbox.id,
          runCorrelationId,
          triggerSource,
          status: finalStatus,
          fetchedMessages,
          acceptedMessages,
          deduplicatedMessages,
          rejectedMessages,
          durationMs: completedAt.getTime() - startedAt.getTime(),
        }),
      );
    }
  }

  async pollActiveMailboxes(): Promise<MailboxSyncAggregateResult> {
    const schedulerRunCorrelationId = resolveCorrelationId(undefined);
    const maxMailboxesPerRun = this.resolveSyncMaxMailboxesPerRun();
    const mailboxes = await this.mailboxRepo.find({
      where: { status: 'ACTIVE' },
      order: { updatedAt: 'DESC' },
      take: maxMailboxesPerRun,
    });
    const summary: MailboxSyncAggregateResult = {
      polledMailboxes: mailboxes.length,
      skippedMailboxes: 0,
      failedMailboxes: 0,
      fetchedMessages: 0,
      acceptedMessages: 0,
      deduplicatedMessages: 0,
      rejectedMessages: 0,
    };

    for (const mailbox of mailboxes) {
      const pollOutcome = await this.pollMailboxWithLease(mailbox, {
        triggerSource: 'SCHEDULER',
        runCorrelationId: `${schedulerRunCorrelationId}:${mailbox.id}`,
      });
      if (pollOutcome.skipped) {
        summary.skippedMailboxes += 1;
        continue;
      }
      if (pollOutcome.failed) {
        summary.failedMailboxes += 1;
        continue;
      }
      summary.fetchedMessages += pollOutcome.result.fetchedMessages;
      summary.acceptedMessages += pollOutcome.result.acceptedMessages;
      summary.deduplicatedMessages += pollOutcome.result.deduplicatedMessages;
      summary.rejectedMessages += pollOutcome.result.rejectedMessages;
    }
    this.logger.log(
      serializeStructuredLog({
        event: 'mailbox_sync_poll_active_summary',
        runCorrelationId: schedulerRunCorrelationId,
        polledMailboxes: summary.polledMailboxes,
        skippedMailboxes: summary.skippedMailboxes,
        failedMailboxes: summary.failedMailboxes,
        fetchedMessages: summary.fetchedMessages,
        acceptedMessages: summary.acceptedMessages,
        deduplicatedMessages: summary.deduplicatedMessages,
        rejectedMessages: summary.rejectedMessages,
      }),
    );
    return summary;
  }

  async listMailboxSyncStatesForUser(input: {
    userId: string;
    workspaceId?: string | null;
  }): Promise<
    Array<{
      mailboxId: string;
      mailboxEmail: string;
      workspaceId: string | null;
      inboundSyncCursor: string | null;
      inboundSyncStatus: string | null;
      inboundSyncLastPolledAt: Date | null;
      inboundSyncLastError: string | null;
      inboundSyncLastErrorAt: Date | null;
      inboundSyncLeaseExpiresAt: Date | null;
    }>
  > {
    const normalizedWorkspaceId =
      String(input.workspaceId || '').trim() || null;
    const mailboxes = await this.mailboxRepo.find({
      where: normalizedWorkspaceId
        ? { userId: input.userId, workspaceId: normalizedWorkspaceId }
        : { userId: input.userId },
      order: { updatedAt: 'DESC' },
    });
    return mailboxes.map((mailbox) => ({
      mailboxId: mailbox.id,
      mailboxEmail: mailbox.email,
      workspaceId: mailbox.workspaceId || null,
      inboundSyncCursor: mailbox.inboundSyncCursor || null,
      inboundSyncStatus: String(mailbox.inboundSyncStatus || '').trim() || null,
      inboundSyncLastPolledAt: mailbox.inboundSyncLastPolledAt || null,
      inboundSyncLastError: mailbox.inboundSyncLastError || null,
      inboundSyncLastErrorAt: mailbox.inboundSyncLastErrorAt || null,
      inboundSyncLeaseExpiresAt: mailbox.inboundSyncLeaseExpiresAt || null,
    }));
  }

  private buildSyncRunWhere(input: {
    userId: string;
    mailboxId?: string | null;
    workspaceId?: string | null;
    windowStartDate: Date;
  }): FindOptionsWhere<MailboxSyncRun> {
    const where: FindOptionsWhere<MailboxSyncRun> = {
      userId: input.userId,
      completedAt: MoreThanOrEqual(input.windowStartDate),
    };
    if (input.workspaceId) {
      where.workspaceId = input.workspaceId;
    }
    if (input.mailboxId) {
      where.mailboxId = input.mailboxId;
    }
    return where;
  }

  private async resolveMailboxEmailMap(input: {
    userId: string;
    mailboxIds: string[];
  }): Promise<Map<string, string>> {
    if (!input.mailboxIds.length) return new Map<string, string>();
    const mailboxes = await this.mailboxRepo.find({
      where: {
        userId: input.userId,
        id: In(input.mailboxIds),
      },
      select: ['id', 'email'],
    });
    return new Map(mailboxes.map((mailbox) => [mailbox.id, mailbox.email]));
  }

  async getMailboxSyncRunsForUser(input: {
    userId: string;
    mailboxId?: string | null;
    workspaceId?: string | null;
    windowHours?: number | null;
    limit?: number | null;
  }): Promise<
    Array<{
      id: string;
      mailboxId: string;
      mailboxEmail?: string | null;
      workspaceId?: string | null;
      triggerSource: string;
      runCorrelationId: string;
      status: string;
      fetchedMessages: number;
      acceptedMessages: number;
      deduplicatedMessages: number;
      rejectedMessages: number;
      nextCursor?: string | null;
      errorMessage?: string | null;
      startedAt: Date;
      completedAt: Date;
      durationMs: number;
    }>
  > {
    const windowHours = this.normalizeSyncObservabilityWindowHours(
      input.windowHours,
    );
    const limit = Math.min(
      this.normalizeSyncRunHistoryLimit(input.limit),
      this.resolveSyncRunScanLimit(),
    );
    const scope = await this.resolveSyncObservabilityScope({
      userId: input.userId,
      mailboxId: input.mailboxId || null,
      workspaceId: input.workspaceId || null,
    });
    const windowStartDate = new Date(Date.now() - windowHours * 60 * 60 * 1000);
    const where = this.buildSyncRunWhere({
      userId: input.userId,
      mailboxId: scope.mailboxId,
      workspaceId: scope.workspaceId,
      windowStartDate,
    });
    const rows = await this.mailboxSyncRunRepo.find({
      where,
      order: {
        completedAt: 'DESC',
      },
      take: limit,
    });
    const mailboxEmailMap = await this.resolveMailboxEmailMap({
      userId: input.userId,
      mailboxIds: Array.from(new Set(rows.map((row) => row.mailboxId))),
    });

    return rows.map((row) => ({
      id: row.id,
      mailboxId: row.mailboxId,
      mailboxEmail: mailboxEmailMap.get(row.mailboxId) || null,
      workspaceId: row.workspaceId || null,
      triggerSource: this.normalizeTriggerSource(row.triggerSource),
      runCorrelationId: row.runCorrelationId,
      status: this.normalizeSyncRunStatus(row.status),
      fetchedMessages: Number(row.fetchedMessages || 0),
      acceptedMessages: Number(row.acceptedMessages || 0),
      deduplicatedMessages: Number(row.deduplicatedMessages || 0),
      rejectedMessages: Number(row.rejectedMessages || 0),
      nextCursor: row.nextCursor || null,
      errorMessage: row.errorMessage || null,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      durationMs: Number(row.durationMs || 0),
    }));
  }

  async getMailboxSyncRunStatsForUser(input: {
    userId: string;
    mailboxId?: string | null;
    workspaceId?: string | null;
    windowHours?: number | null;
  }): Promise<{
    mailboxId?: string | null;
    workspaceId?: string | null;
    windowHours: number;
    totalRuns: number;
    successRuns: number;
    partialRuns: number;
    failedRuns: number;
    skippedRuns: number;
    schedulerRuns: number;
    manualRuns: number;
    fetchedMessages: number;
    acceptedMessages: number;
    deduplicatedMessages: number;
    rejectedMessages: number;
    avgDurationMs: number;
    latestCompletedAtIso?: string;
  }> {
    const windowHours = this.normalizeSyncObservabilityWindowHours(
      input.windowHours,
    );
    const scope = await this.resolveSyncObservabilityScope({
      userId: input.userId,
      mailboxId: input.mailboxId || null,
      workspaceId: input.workspaceId || null,
    });
    const windowStartDate = new Date(Date.now() - windowHours * 60 * 60 * 1000);
    const rows = await this.mailboxSyncRunRepo.find({
      where: this.buildSyncRunWhere({
        userId: input.userId,
        mailboxId: scope.mailboxId,
        workspaceId: scope.workspaceId,
        windowStartDate,
      }),
      order: {
        completedAt: 'DESC',
      },
      take: this.resolveSyncRunScanLimit(),
    });

    let successRuns = 0;
    let partialRuns = 0;
    let failedRuns = 0;
    let skippedRuns = 0;
    let schedulerRuns = 0;
    let manualRuns = 0;
    let fetchedMessages = 0;
    let acceptedMessages = 0;
    let deduplicatedMessages = 0;
    let rejectedMessages = 0;
    let totalDurationMs = 0;

    for (const row of rows) {
      const status = this.normalizeSyncRunStatus(row.status);
      if (status === 'SUCCESS') successRuns += 1;
      if (status === 'PARTIAL') partialRuns += 1;
      if (status === 'FAILED') failedRuns += 1;
      if (status === 'SKIPPED') skippedRuns += 1;

      const triggerSource = this.normalizeTriggerSource(row.triggerSource);
      if (triggerSource === 'MANUAL') manualRuns += 1;
      if (triggerSource === 'SCHEDULER') schedulerRuns += 1;

      fetchedMessages += Number(row.fetchedMessages || 0);
      acceptedMessages += Number(row.acceptedMessages || 0);
      deduplicatedMessages += Number(row.deduplicatedMessages || 0);
      rejectedMessages += Number(row.rejectedMessages || 0);
      totalDurationMs += Number(row.durationMs || 0);
    }

    return {
      mailboxId: scope.mailboxId,
      workspaceId: scope.workspaceId,
      windowHours,
      totalRuns: rows.length,
      successRuns,
      partialRuns,
      failedRuns,
      skippedRuns,
      schedulerRuns,
      manualRuns,
      fetchedMessages,
      acceptedMessages,
      deduplicatedMessages,
      rejectedMessages,
      avgDurationMs:
        rows.length > 0
          ? Number((totalDurationMs / rows.length).toFixed(2))
          : 0,
      latestCompletedAtIso: rows[0]?.completedAt?.toISOString(),
    };
  }

  async getMailboxSyncRunSeriesForUser(input: {
    userId: string;
    mailboxId?: string | null;
    workspaceId?: string | null;
    windowHours?: number | null;
    bucketMinutes?: number | null;
  }): Promise<
    Array<{
      bucketStart: Date;
      totalRuns: number;
      successRuns: number;
      partialRuns: number;
      failedRuns: number;
      skippedRuns: number;
      fetchedMessages: number;
      acceptedMessages: number;
      deduplicatedMessages: number;
      rejectedMessages: number;
    }>
  > {
    const windowHours = this.normalizeSyncObservabilityWindowHours(
      input.windowHours,
    );
    const bucketMinutes = this.normalizeSyncObservabilityBucketMinutes(
      input.bucketMinutes,
    );
    const scope = await this.resolveSyncObservabilityScope({
      userId: input.userId,
      mailboxId: input.mailboxId || null,
      workspaceId: input.workspaceId || null,
    });
    const bucketMs = bucketMinutes * 60 * 1000;
    const nowMs = Date.now();
    const windowStartMs = nowMs - windowHours * 60 * 60 * 1000;
    const normalizedWindowStartMs =
      Math.floor(windowStartMs / bucketMs) * bucketMs;
    const windowStartDate = new Date(windowStartMs);
    const rows = await this.mailboxSyncRunRepo.find({
      where: this.buildSyncRunWhere({
        userId: input.userId,
        mailboxId: scope.mailboxId,
        workspaceId: scope.workspaceId,
        windowStartDate,
      }),
      order: {
        completedAt: 'ASC',
      },
      take: this.resolveSyncRunScanLimit(),
    });
    const bucketMap = new Map<
      number,
      {
        totalRuns: number;
        successRuns: number;
        partialRuns: number;
        failedRuns: number;
        skippedRuns: number;
        fetchedMessages: number;
        acceptedMessages: number;
        deduplicatedMessages: number;
        rejectedMessages: number;
      }
    >();

    for (const row of rows) {
      const bucketStartMs =
        Math.floor(row.completedAt.getTime() / bucketMs) * bucketMs;
      const bucket = bucketMap.get(bucketStartMs) || {
        totalRuns: 0,
        successRuns: 0,
        partialRuns: 0,
        failedRuns: 0,
        skippedRuns: 0,
        fetchedMessages: 0,
        acceptedMessages: 0,
        deduplicatedMessages: 0,
        rejectedMessages: 0,
      };
      bucket.totalRuns += 1;
      const status = this.normalizeSyncRunStatus(row.status);
      if (status === 'SUCCESS') bucket.successRuns += 1;
      if (status === 'PARTIAL') bucket.partialRuns += 1;
      if (status === 'FAILED') bucket.failedRuns += 1;
      if (status === 'SKIPPED') bucket.skippedRuns += 1;
      bucket.fetchedMessages += Number(row.fetchedMessages || 0);
      bucket.acceptedMessages += Number(row.acceptedMessages || 0);
      bucket.deduplicatedMessages += Number(row.deduplicatedMessages || 0);
      bucket.rejectedMessages += Number(row.rejectedMessages || 0);
      bucketMap.set(bucketStartMs, bucket);
    }

    const series: Array<{
      bucketStart: Date;
      totalRuns: number;
      successRuns: number;
      partialRuns: number;
      failedRuns: number;
      skippedRuns: number;
      fetchedMessages: number;
      acceptedMessages: number;
      deduplicatedMessages: number;
      rejectedMessages: number;
    }> = [];
    for (
      let cursorMs = normalizedWindowStartMs;
      cursorMs <= nowMs;
      cursorMs += bucketMs
    ) {
      const bucket = bucketMap.get(cursorMs);
      series.push({
        bucketStart: new Date(cursorMs),
        totalRuns: bucket?.totalRuns || 0,
        successRuns: bucket?.successRuns || 0,
        partialRuns: bucket?.partialRuns || 0,
        failedRuns: bucket?.failedRuns || 0,
        skippedRuns: bucket?.skippedRuns || 0,
        fetchedMessages: bucket?.fetchedMessages || 0,
        acceptedMessages: bucket?.acceptedMessages || 0,
        deduplicatedMessages: bucket?.deduplicatedMessages || 0,
        rejectedMessages: bucket?.rejectedMessages || 0,
      });
    }
    return series;
  }

  async getMailboxSyncIncidentStatsForUser(input: {
    userId: string;
    mailboxId?: string | null;
    workspaceId?: string | null;
    windowHours?: number | null;
  }): Promise<{
    mailboxId?: string | null;
    workspaceId?: string | null;
    windowHours: number;
    totalRuns: number;
    incidentRuns: number;
    failedRuns: number;
    partialRuns: number;
    incidentRatePercent: number;
    lastIncidentAtIso?: string;
  }> {
    const windowHours = this.normalizeSyncObservabilityWindowHours(
      input.windowHours,
    );
    const scope = await this.resolveSyncObservabilityScope({
      userId: input.userId,
      mailboxId: input.mailboxId || null,
      workspaceId: input.workspaceId || null,
    });
    const stats = await this.getMailboxSyncRunStatsForUser({
      userId: input.userId,
      mailboxId: scope.mailboxId,
      workspaceId: scope.workspaceId,
      windowHours,
    });
    const windowStartDate = new Date(Date.now() - windowHours * 60 * 60 * 1000);
    const incidentRows = await this.mailboxSyncRunRepo.find({
      where: {
        ...this.buildSyncRunWhere({
          userId: input.userId,
          mailboxId: scope.mailboxId,
          workspaceId: scope.workspaceId,
          windowStartDate,
        }),
        status: In(['FAILED', 'PARTIAL']),
      },
      order: {
        completedAt: 'DESC',
      },
      take: 1,
    });
    const incidentRuns = stats.failedRuns + stats.partialRuns;
    const lastIncidentAtIso = incidentRows[0]?.completedAt?.toISOString();
    return {
      mailboxId: stats.mailboxId,
      workspaceId: stats.workspaceId,
      windowHours: stats.windowHours,
      totalRuns: stats.totalRuns,
      incidentRuns,
      failedRuns: stats.failedRuns,
      partialRuns: stats.partialRuns,
      incidentRatePercent:
        stats.totalRuns > 0
          ? Number(((incidentRuns / stats.totalRuns) * 100).toFixed(2))
          : 0,
      lastIncidentAtIso,
    };
  }

  async getMailboxSyncIncidentSeriesForUser(input: {
    userId: string;
    mailboxId?: string | null;
    workspaceId?: string | null;
    windowHours?: number | null;
    bucketMinutes?: number | null;
  }): Promise<
    Array<{
      bucketStart: Date;
      totalRuns: number;
      incidentRuns: number;
      failedRuns: number;
      partialRuns: number;
    }>
  > {
    const series = await this.getMailboxSyncRunSeriesForUser({
      userId: input.userId,
      mailboxId: input.mailboxId || null,
      workspaceId: input.workspaceId || null,
      windowHours: input.windowHours ?? null,
      bucketMinutes: input.bucketMinutes ?? null,
    });
    return series.map((point) => ({
      bucketStart: point.bucketStart,
      totalRuns: point.totalRuns,
      incidentRuns: point.failedRuns + point.partialRuns,
      failedRuns: point.failedRuns,
      partialRuns: point.partialRuns,
    }));
  }

  async exportMailboxSyncIncidentDataForUser(input: {
    userId: string;
    mailboxId?: string | null;
    workspaceId?: string | null;
    windowHours?: number | null;
    bucketMinutes?: number | null;
  }): Promise<{
    generatedAtIso: string;
    dataJson: string;
  }> {
    const windowHours = this.normalizeSyncObservabilityWindowHours(
      input.windowHours,
    );
    const bucketMinutes = this.normalizeSyncObservabilityBucketMinutes(
      input.bucketMinutes,
    );
    const [stats, series] = await Promise.all([
      this.getMailboxSyncIncidentStatsForUser({
        userId: input.userId,
        mailboxId: input.mailboxId || null,
        workspaceId: input.workspaceId || null,
        windowHours,
      }),
      this.getMailboxSyncIncidentSeriesForUser({
        userId: input.userId,
        mailboxId: input.mailboxId || null,
        workspaceId: input.workspaceId || null,
        windowHours,
        bucketMinutes,
      }),
    ]);
    const generatedAtIso = new Date().toISOString();
    return {
      generatedAtIso,
      dataJson: JSON.stringify({
        generatedAtIso,
        mailboxId: stats.mailboxId || null,
        workspaceId: stats.workspaceId || null,
        windowHours,
        bucketMinutes,
        stats,
        series: series.map((point) => ({
          bucketStartIso: point.bucketStart.toISOString(),
          totalRuns: point.totalRuns,
          incidentRuns: point.incidentRuns,
          failedRuns: point.failedRuns,
          partialRuns: point.partialRuns,
        })),
      }),
    };
  }

  async getMailboxSyncIncidentAlertDeliveryStatsForUser(input: {
    userId: string;
    workspaceId?: string | null;
    windowHours?: number | null;
  }): Promise<{
    workspaceId?: string | null;
    windowHours: number;
    totalCount: number;
    warningCount: number;
    criticalCount: number;
    lastAlertAtIso?: string;
  }> {
    const windowHours = this.normalizeSyncObservabilityWindowHours(
      input.windowHours,
    );
    const workspaceId = this.normalizeWorkspaceId(input.workspaceId);
    const windowStartDate = new Date(Date.now() - windowHours * 60 * 60 * 1000);
    const notifications = await this.notificationRepo.find({
      where: workspaceId
        ? {
            userId: input.userId,
            workspaceId,
            type: 'MAILBOX_SYNC_INCIDENT_ALERT',
            createdAt: MoreThanOrEqual(windowStartDate),
          }
        : {
            userId: input.userId,
            type: 'MAILBOX_SYNC_INCIDENT_ALERT',
            createdAt: MoreThanOrEqual(windowStartDate),
          },
      order: {
        createdAt: 'DESC',
      },
      take: this.resolveSyncRunScanLimit(),
    });
    let warningCount = 0;
    let criticalCount = 0;
    for (const notification of notifications) {
      const status = this.normalizeSyncIncidentMetadataStatus(
        notification.metadata,
      );
      if (status === 'WARNING') warningCount += 1;
      if (status === 'CRITICAL') criticalCount += 1;
    }
    return {
      workspaceId,
      windowHours,
      totalCount: notifications.length,
      warningCount,
      criticalCount,
      lastAlertAtIso: notifications[0]?.createdAt?.toISOString(),
    };
  }

  async getMailboxSyncIncidentAlertsForUser(input: {
    userId: string;
    workspaceId?: string | null;
    windowHours?: number | null;
    limit?: number | null;
  }): Promise<
    Array<{
      notificationId: string;
      workspaceId?: string | null;
      status: string;
      title: string;
      message: string;
      incidentRatePercent: number;
      incidentRuns: number;
      totalRuns: number;
      warningRatePercent: number;
      criticalRatePercent: number;
      createdAt: Date;
    }>
  > {
    const windowHours = this.normalizeSyncObservabilityWindowHours(
      input.windowHours,
    );
    const workspaceId = this.normalizeWorkspaceId(input.workspaceId);
    const limit = Math.min(
      this.normalizeSyncRunHistoryLimit(input.limit),
      this.resolveSyncRunScanLimit(),
    );
    const windowStartDate = new Date(Date.now() - windowHours * 60 * 60 * 1000);
    const notifications = await this.notificationRepo.find({
      where: workspaceId
        ? {
            userId: input.userId,
            workspaceId,
            type: 'MAILBOX_SYNC_INCIDENT_ALERT',
            createdAt: MoreThanOrEqual(windowStartDate),
          }
        : {
            userId: input.userId,
            type: 'MAILBOX_SYNC_INCIDENT_ALERT',
            createdAt: MoreThanOrEqual(windowStartDate),
          },
      order: {
        createdAt: 'DESC',
      },
      take: limit,
    });
    return notifications.map((notification) => ({
      notificationId: notification.id,
      workspaceId: notification.workspaceId || null,
      status: this.normalizeSyncIncidentMetadataStatus(notification.metadata),
      title: notification.title,
      message: notification.message,
      incidentRatePercent: this.resolveMetadataNumber({
        metadata: notification.metadata,
        key: 'incidentRatePercent',
        fallbackValue: 0,
      }),
      incidentRuns: this.resolveMetadataNumber({
        metadata: notification.metadata,
        key: 'incidentRuns',
        fallbackValue: 0,
      }),
      totalRuns: this.resolveMetadataNumber({
        metadata: notification.metadata,
        key: 'totalRuns',
        fallbackValue: 0,
      }),
      warningRatePercent: this.resolveMetadataNumber({
        metadata: notification.metadata,
        key: 'warningRatePercent',
        fallbackValue: 0,
      }),
      criticalRatePercent: this.resolveMetadataNumber({
        metadata: notification.metadata,
        key: 'criticalRatePercent',
        fallbackValue: 0,
      }),
      createdAt: notification.createdAt,
    }));
  }

  async exportMailboxSyncIncidentAlertHistoryDataForUser(input: {
    userId: string;
    workspaceId?: string | null;
    windowHours?: number | null;
    limit?: number | null;
  }): Promise<{
    generatedAtIso: string;
    dataJson: string;
  }> {
    const windowHours = this.normalizeSyncObservabilityWindowHours(
      input.windowHours,
    );
    const limit = this.normalizeSyncRunHistoryLimit(input.limit);
    const alerts = await this.getMailboxSyncIncidentAlertsForUser({
      userId: input.userId,
      workspaceId: input.workspaceId || null,
      windowHours,
      limit,
    });
    const generatedAtIso = new Date().toISOString();
    return {
      generatedAtIso,
      dataJson: JSON.stringify({
        generatedAtIso,
        workspaceId: this.normalizeWorkspaceId(input.workspaceId),
        windowHours,
        limit,
        alertCount: alerts.length,
        alerts: alerts.map((alert) => ({
          ...alert,
          createdAtIso: alert.createdAt.toISOString(),
        })),
      }),
    };
  }

  async getMailboxSyncIncidentAlertDeliverySeriesForUser(input: {
    userId: string;
    workspaceId?: string | null;
    windowHours?: number | null;
    bucketMinutes?: number | null;
  }): Promise<
    Array<{
      bucketStart: Date;
      totalCount: number;
      warningCount: number;
      criticalCount: number;
    }>
  > {
    const windowHours = this.normalizeSyncObservabilityWindowHours(
      input.windowHours,
    );
    const bucketMinutes = this.normalizeSyncObservabilityBucketMinutes(
      input.bucketMinutes,
    );
    const workspaceId = this.normalizeWorkspaceId(input.workspaceId);
    const bucketMs = bucketMinutes * 60 * 1000;
    const nowMs = Date.now();
    const windowStartMs = nowMs - windowHours * 60 * 60 * 1000;
    const normalizedWindowStartMs =
      Math.floor(windowStartMs / bucketMs) * bucketMs;
    const windowStartDate = new Date(windowStartMs);
    const notifications = await this.notificationRepo.find({
      where: workspaceId
        ? {
            userId: input.userId,
            workspaceId,
            type: 'MAILBOX_SYNC_INCIDENT_ALERT',
            createdAt: MoreThanOrEqual(windowStartDate),
          }
        : {
            userId: input.userId,
            type: 'MAILBOX_SYNC_INCIDENT_ALERT',
            createdAt: MoreThanOrEqual(windowStartDate),
          },
      order: {
        createdAt: 'ASC',
      },
      take: this.resolveSyncRunScanLimit(),
    });

    const bucketMap = new Map<
      number,
      {
        totalCount: number;
        warningCount: number;
        criticalCount: number;
      }
    >();
    for (const notification of notifications) {
      const bucketStartMs =
        Math.floor(notification.createdAt.getTime() / bucketMs) * bucketMs;
      const bucket = bucketMap.get(bucketStartMs) || {
        totalCount: 0,
        warningCount: 0,
        criticalCount: 0,
      };
      bucket.totalCount += 1;
      const status = this.normalizeSyncIncidentMetadataStatus(
        notification.metadata,
      );
      if (status === 'WARNING') bucket.warningCount += 1;
      if (status === 'CRITICAL') bucket.criticalCount += 1;
      bucketMap.set(bucketStartMs, bucket);
    }

    const series: Array<{
      bucketStart: Date;
      totalCount: number;
      warningCount: number;
      criticalCount: number;
    }> = [];
    for (
      let cursorMs = normalizedWindowStartMs;
      cursorMs <= nowMs;
      cursorMs += bucketMs
    ) {
      const bucket = bucketMap.get(cursorMs);
      series.push({
        bucketStart: new Date(cursorMs),
        totalCount: bucket?.totalCount || 0,
        warningCount: bucket?.warningCount || 0,
        criticalCount: bucket?.criticalCount || 0,
      });
    }
    return series;
  }

  async exportMailboxSyncIncidentAlertDeliveryDataForUser(input: {
    userId: string;
    workspaceId?: string | null;
    windowHours?: number | null;
    bucketMinutes?: number | null;
  }): Promise<{
    generatedAtIso: string;
    dataJson: string;
  }> {
    const windowHours = this.normalizeSyncObservabilityWindowHours(
      input.windowHours,
    );
    const bucketMinutes = this.normalizeSyncObservabilityBucketMinutes(
      input.bucketMinutes,
    );
    const [stats, series] = await Promise.all([
      this.getMailboxSyncIncidentAlertDeliveryStatsForUser({
        userId: input.userId,
        workspaceId: input.workspaceId || null,
        windowHours,
      }),
      this.getMailboxSyncIncidentAlertDeliverySeriesForUser({
        userId: input.userId,
        workspaceId: input.workspaceId || null,
        windowHours,
        bucketMinutes,
      }),
    ]);
    const generatedAtIso = new Date().toISOString();
    return {
      generatedAtIso,
      dataJson: JSON.stringify({
        generatedAtIso,
        workspaceId: stats.workspaceId || null,
        windowHours,
        bucketMinutes,
        stats,
        series: series.map((point) => ({
          bucketStartIso: point.bucketStart.toISOString(),
          totalCount: point.totalCount,
          warningCount: point.warningCount,
          criticalCount: point.criticalCount,
        })),
      }),
    };
  }

  async exportMailboxSyncDataForUser(input: {
    userId: string;
    mailboxId?: string | null;
    workspaceId?: string | null;
    limit?: number | null;
    windowHours?: number | null;
    bucketMinutes?: number | null;
  }): Promise<{
    generatedAtIso: string;
    dataJson: string;
  }> {
    const windowHours = this.normalizeSyncObservabilityWindowHours(
      input.windowHours,
    );
    const bucketMinutes = this.normalizeSyncObservabilityBucketMinutes(
      input.bucketMinutes,
    );
    const limit = this.normalizeSyncRunHistoryLimit(input.limit);
    const [stats, series, runs] = await Promise.all([
      this.getMailboxSyncRunStatsForUser({
        userId: input.userId,
        mailboxId: input.mailboxId || null,
        workspaceId: input.workspaceId || null,
        windowHours,
      }),
      this.getMailboxSyncRunSeriesForUser({
        userId: input.userId,
        mailboxId: input.mailboxId || null,
        workspaceId: input.workspaceId || null,
        windowHours,
        bucketMinutes,
      }),
      this.getMailboxSyncRunsForUser({
        userId: input.userId,
        mailboxId: input.mailboxId || null,
        workspaceId: input.workspaceId || null,
        windowHours,
        limit,
      }),
    ]);
    const generatedAtIso = new Date().toISOString();
    return {
      generatedAtIso,
      dataJson: JSON.stringify({
        generatedAtIso,
        mailboxId: stats.mailboxId || null,
        workspaceId: stats.workspaceId || null,
        windowHours,
        bucketMinutes,
        limit,
        stats,
        series: series.map((point) => ({
          bucketStartIso: point.bucketStart.toISOString(),
          totalRuns: point.totalRuns,
          successRuns: point.successRuns,
          partialRuns: point.partialRuns,
          failedRuns: point.failedRuns,
          skippedRuns: point.skippedRuns,
          fetchedMessages: point.fetchedMessages,
          acceptedMessages: point.acceptedMessages,
          deduplicatedMessages: point.deduplicatedMessages,
          rejectedMessages: point.rejectedMessages,
        })),
        runs: runs.map((run) => ({
          ...run,
          startedAtIso: run.startedAt.toISOString(),
          completedAtIso: run.completedAt.toISOString(),
        })),
      }),
    };
  }

  async purgeMailboxSyncRunRetentionData(input: {
    userId?: string | null;
    retentionDays?: number | null;
  }): Promise<{
    deletedRuns: number;
    retentionDays: number;
    executedAtIso: string;
  }> {
    const retentionDays = this.resolveSyncRunRetentionDays(input.retentionDays);
    const cutoffDate = new Date(
      Date.now() - retentionDays * 24 * 60 * 60 * 1000,
    );
    const normalizedUserId = String(input.userId || '').trim();
    const deleteCriteria = normalizedUserId
      ? {
          userId: normalizedUserId,
          completedAt: LessThan(cutoffDate),
        }
      : {
          completedAt: LessThan(cutoffDate),
        };
    const deleteResult = await this.mailboxSyncRunRepo.delete(deleteCriteria);
    const deletedRuns = Number(deleteResult.affected || 0);
    const executedAtIso = new Date().toISOString();
    this.logger.log(
      serializeStructuredLog({
        event: 'mailbox_sync_run_retention_purge_completed',
        userId: normalizedUserId || null,
        retentionDays,
        deletedRuns,
      }),
    );
    return {
      deletedRuns,
      retentionDays,
      executedAtIso,
    };
  }

  async pollUserMailboxes(input: {
    userId: string;
    mailboxId?: string | null;
    workspaceId?: string | null;
  }): Promise<MailboxSyncAggregateResult> {
    const manualRunCorrelationId = resolveCorrelationId(undefined);
    const normalizedMailboxId = String(input.mailboxId || '').trim() || null;
    const normalizedWorkspaceId =
      String(input.workspaceId || '').trim() || null;
    const mailboxWhereBase = normalizedWorkspaceId
      ? {
          userId: input.userId,
          workspaceId: normalizedWorkspaceId,
          status: 'ACTIVE',
        }
      : {
          userId: input.userId,
          status: 'ACTIVE',
        };
    const mailboxes = normalizedMailboxId
      ? (() => {
          return [];
        })()
      : await this.mailboxRepo.find({
          where: mailboxWhereBase,
          order: { updatedAt: 'DESC' },
          take: this.resolveSyncMaxMailboxesPerRun(),
        });
    if (normalizedMailboxId) {
      const mailbox = await this.mailboxRepo.findOne({
        where: normalizedWorkspaceId
          ? {
              id: normalizedMailboxId,
              userId: input.userId,
              workspaceId: normalizedWorkspaceId,
              status: 'ACTIVE',
            }
          : {
              id: normalizedMailboxId,
              userId: input.userId,
              status: 'ACTIVE',
            },
      });
      if (!mailbox) {
        throw new NotFoundException('Mailbox not found');
      }
      mailboxes.push(mailbox);
    }
    const summary: MailboxSyncAggregateResult = {
      polledMailboxes: mailboxes.length,
      skippedMailboxes: 0,
      failedMailboxes: 0,
      fetchedMessages: 0,
      acceptedMessages: 0,
      deduplicatedMessages: 0,
      rejectedMessages: 0,
    };
    for (const mailbox of mailboxes) {
      const pollOutcome = await this.pollMailboxWithLease(mailbox, {
        triggerSource: 'MANUAL',
        runCorrelationId: `${manualRunCorrelationId}:${mailbox.id}`,
      });
      if (pollOutcome.skipped) {
        summary.skippedMailboxes += 1;
        continue;
      }
      if (pollOutcome.failed) {
        summary.failedMailboxes += 1;
        continue;
      }
      summary.fetchedMessages += pollOutcome.result.fetchedMessages;
      summary.acceptedMessages += pollOutcome.result.acceptedMessages;
      summary.deduplicatedMessages += pollOutcome.result.deduplicatedMessages;
      summary.rejectedMessages += pollOutcome.result.rejectedMessages;
    }
    this.logger.log(
      serializeStructuredLog({
        event: 'mailbox_sync_poll_user_summary',
        runCorrelationId: manualRunCorrelationId,
        userId: input.userId,
        workspaceId: normalizedWorkspaceId,
        mailboxId: normalizedMailboxId,
        polledMailboxes: summary.polledMailboxes,
        skippedMailboxes: summary.skippedMailboxes,
        failedMailboxes: summary.failedMailboxes,
        fetchedMessages: summary.fetchedMessages,
        acceptedMessages: summary.acceptedMessages,
        deduplicatedMessages: summary.deduplicatedMessages,
        rejectedMessages: summary.rejectedMessages,
      }),
    );
    return summary;
  }
}
