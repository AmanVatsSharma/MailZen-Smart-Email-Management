import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import {
  resolveCorrelationId,
  serializeStructuredLog,
} from '../common/logging/structured-log.util';
import { MailboxInboundWebhookInput } from './dto/mailbox-inbound-webhook.input';
import { Mailbox } from './entities/mailbox.entity';
import { MailboxSyncRun } from './entities/mailbox-sync-run.entity';
import { MailboxInboundService } from './mailbox-inbound.service';
import { NotificationEventBusService } from '../notification/notification-event-bus.service';

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

  constructor(
    @InjectRepository(Mailbox)
    private readonly mailboxRepo: Repository<Mailbox>,
    @InjectRepository(MailboxSyncRun)
    private readonly mailboxSyncRunRepo: Repository<MailboxSyncRun>,
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
