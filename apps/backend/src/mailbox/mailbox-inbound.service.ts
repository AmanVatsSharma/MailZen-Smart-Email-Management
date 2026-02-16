import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { Repository } from 'typeorm';
import {
  resolveCorrelationId,
  serializeStructuredLog,
} from '../common/logging/structured-log.util';
import { Email } from '../email/entities/email.entity';
import { NotificationEventBusService } from '../notification/notification-event-bus.service';
import { MailboxInboundWebhookInput } from './dto/mailbox-inbound-webhook.input';
import { MailboxInboundEvent } from './entities/mailbox-inbound-event.entity';
import { Mailbox } from './entities/mailbox.entity';

type InboundAuthInput = {
  requestIdHeader?: string;
  inboundTokenHeader?: string;
  signatureHeader?: string;
  timestampHeader?: string;
  authorizationHeader?: string;
  sourceIp?: string;
};

type MailboxInboundIngestResult = {
  accepted: boolean;
  mailboxId: string;
  mailboxEmail: string;
  emailId: string;
  deduplicated?: boolean;
};

@Injectable()
export class MailboxInboundService {
  private readonly logger = new Logger(MailboxInboundService.name);
  private readonly processedMessageIds = new Map<
    string,
    { expiresAtMs: number; emailId: string }
  >();

  constructor(
    @InjectRepository(Mailbox)
    private readonly mailboxRepo: Repository<Mailbox>,
    @InjectRepository(Email)
    private readonly emailRepo: Repository<Email>,
    @InjectRepository(MailboxInboundEvent)
    private readonly mailboxInboundEventRepo: Repository<MailboxInboundEvent>,
    private readonly notificationEventBus: NotificationEventBusService,
  ) {}

  private normalizeEmailAddress(input: string): string {
    return input.trim().toLowerCase();
  }

  private normalizeMessageId(input?: string | null): string | null {
    const normalized = String(input || '')
      .trim()
      .toLowerCase();
    if (!normalized) return null;
    return normalized;
  }

  private normalizeSubjectForThread(input?: string): string {
    return String(input || '')
      .trim()
      .toLowerCase()
      .replace(/^(re|fwd|fw)\s*:\s*/gi, '')
      .replace(/\s+/g, ' ')
      .slice(0, 180);
  }

  private resolveExpectedWebhookToken(): string | null {
    const configured = process.env.MAILZEN_INBOUND_WEBHOOK_TOKEN?.trim();
    if (configured) return configured;

    const env = (process.env.NODE_ENV || 'development').toLowerCase();
    if (env === 'production') {
      throw new ServiceUnavailableException(
        'MAILZEN_INBOUND_WEBHOOK_TOKEN must be configured in production',
      );
    }

    this.logger.warn(
      'MAILZEN_INBOUND_WEBHOOK_TOKEN is not configured; inbound webhook authentication is bypassed for non-production environment',
    );
    return null;
  }

  private extractProvidedToken(auth: InboundAuthInput): string | null {
    const directHeader = auth.inboundTokenHeader?.trim();
    if (directHeader) return directHeader;

    const authorization = auth.authorizationHeader?.trim();
    if (!authorization) return null;

    const [scheme, value] = authorization.split(' ');
    if (!/^Bearer$/i.test(scheme) || !value) return null;
    return value.trim();
  }

  private resolveSigningKey(): string | null {
    const key = process.env.MAILZEN_INBOUND_WEBHOOK_SIGNING_KEY?.trim();
    if (!key) return null;
    return key;
  }

  private getSignatureToleranceMs(): number {
    const parsed = Number(
      process.env.MAILZEN_INBOUND_WEBHOOK_SIGNATURE_TOLERANCE_MS || 300000,
    );
    if (!Number.isFinite(parsed) || parsed <= 0) return 300000;
    return Math.floor(parsed);
  }

  private parseTimestampHeader(rawTimestamp: string): number | null {
    if (!rawTimestamp) return null;
    const numeric = Number(rawTimestamp);
    if (!Number.isFinite(numeric) || numeric <= 0) return null;
    return Math.floor(numeric);
  }

  private buildSignaturePayload(input: MailboxInboundWebhookInput): string {
    return [
      this.normalizeEmailAddress(input.mailboxEmail),
      this.normalizeEmailAddress(input.from),
      this.normalizeMessageId(input.messageId) || '',
      (input.subject || '').trim(),
    ].join('.');
  }

  private assertWebhookSignature(
    auth: InboundAuthInput,
    input: MailboxInboundWebhookInput,
  ): boolean {
    const signingKey = this.resolveSigningKey();
    if (!signingKey) return false;

    const providedSignature = auth.signatureHeader?.trim();
    const providedTimestamp = this.parseTimestampHeader(
      auth.timestampHeader?.trim() || '',
    );
    if (!providedSignature || !providedTimestamp) {
      throw new UnauthorizedException('Invalid inbound webhook signature');
    }

    const nowMs = Date.now();
    const toleranceMs = this.getSignatureToleranceMs();
    if (Math.abs(nowMs - providedTimestamp) > toleranceMs) {
      throw new UnauthorizedException('Inbound webhook signature expired');
    }

    const canonicalPayload = this.buildSignaturePayload(input);
    const expectedSignature = createHmac('sha256', signingKey)
      .update(`${providedTimestamp}.${canonicalPayload}`)
      .digest('hex');

    const expectedBytes = Buffer.from(expectedSignature);
    const providedBytes = Buffer.from(providedSignature);
    if (
      expectedBytes.length !== providedBytes.length ||
      !timingSafeEqual(expectedBytes, providedBytes)
    ) {
      throw new UnauthorizedException('Invalid inbound webhook signature');
    }
    return true;
  }

  private assertWebhookAuth(auth: InboundAuthInput): void {
    const expected = this.resolveExpectedWebhookToken();
    if (!expected) return;

    const provided = this.extractProvidedToken(auth);
    if (!provided) {
      throw new UnauthorizedException('Invalid inbound webhook token');
    }

    const expectedBytes = Buffer.from(expected);
    const providedBytes = Buffer.from(provided);
    if (
      expectedBytes.length !== providedBytes.length ||
      !timingSafeEqual(expectedBytes, providedBytes)
    ) {
      throw new UnauthorizedException('Invalid inbound webhook token');
    }
  }

  private pruneExpiredMessageIdCache(nowMs: number): void {
    for (const [key, value] of this.processedMessageIds.entries()) {
      if (value.expiresAtMs > nowMs) continue;
      this.processedMessageIds.delete(key);
    }
  }

  private resolveMessageIdCacheTtlMs(): number {
    const parsed = Number(process.env.MAILZEN_INBOUND_IDEMPOTENCY_TTL_MS);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 24 * 60 * 60 * 1000;
    }
    return Math.floor(parsed);
  }

  private findDuplicateMessageId(
    mailboxId: string,
    messageId?: string,
  ): { emailId: string } | null {
    const normalizedMessageId = this.normalizeMessageId(messageId);
    if (!normalizedMessageId) return null;
    const nowMs = Date.now();
    this.pruneExpiredMessageIdCache(nowMs);

    const cacheKey = `${mailboxId}:${normalizedMessageId}`;
    const cached = this.processedMessageIds.get(cacheKey);
    if (!cached) return null;
    if (cached.expiresAtMs <= nowMs) {
      this.processedMessageIds.delete(cacheKey);
      return null;
    }
    return { emailId: cached.emailId };
  }

  private rememberMessageId(
    mailboxId: string,
    messageId: string | undefined,
    emailId: string,
  ): void {
    const normalizedMessageId = this.normalizeMessageId(messageId);
    if (!normalizedMessageId) return;
    const cacheKey = `${mailboxId}:${normalizedMessageId}`;
    this.processedMessageIds.set(cacheKey, {
      emailId,
      expiresAtMs: Date.now() + this.resolveMessageIdCacheTtlMs(),
    });
  }

  private assertInboundBody(input: MailboxInboundWebhookInput): void {
    const htmlBody = input.htmlBody?.trim() || '';
    const textBody = input.textBody?.trim() || '';
    if (htmlBody || textBody) return;
    throw new BadRequestException(
      'Inbound webhook payload must include textBody or htmlBody',
    );
  }

  private resolveApproximateSizeBytes(
    input: MailboxInboundWebhookInput,
  ): bigint {
    if (input.sizeBytes) {
      try {
        const explicit = BigInt(input.sizeBytes);
        if (explicit > 0n) return explicit;
      } catch {
        // fall back to computed estimate.
      }
    }

    const estimated = Buffer.byteLength(
      [input.subject || '', input.textBody || '', input.htmlBody || ''].join(
        '\n',
      ),
      'utf8',
    );
    return BigInt(Math.max(estimated, 1));
  }

  private resolveNextMailboxUsageBytes(
    currentValue: string | undefined,
    incomingSizeBytes: bigint,
  ): string {
    const currentUsage = this.resolveCurrentMailboxUsageBytes(currentValue);
    return (currentUsage + incomingSizeBytes).toString();
  }

  private resolveCurrentMailboxUsageBytes(currentValue?: string): bigint {
    try {
      const parsed = BigInt(currentValue || '0');
      if (parsed < 0n) return 0n;
      return parsed;
    } catch {
      return 0n;
    }
  }

  private assertMailboxWritable(
    mailbox: Mailbox,
    inboundSizeBytes: bigint,
  ): void {
    const normalizedStatus = String(mailbox.status || '')
      .trim()
      .toUpperCase();
    if (normalizedStatus && normalizedStatus !== 'ACTIVE') {
      throw new BadRequestException('Mailbox is not active');
    }

    const quotaLimitMb = Number(mailbox.quotaLimitMb || 0);
    if (!Number.isFinite(quotaLimitMb) || quotaLimitMb <= 0) return;

    const quotaLimitBytes = BigInt(Math.floor(quotaLimitMb)) * 1024n * 1024n;
    const currentUsageBytes = this.resolveCurrentMailboxUsageBytes(
      mailbox.usedBytes,
    );
    const nextUsageBytes = currentUsageBytes + inboundSizeBytes;
    if (nextUsageBytes <= quotaLimitBytes) return;

    throw new BadRequestException('Mailbox storage quota exceeded');
  }

  private resolveInboundThreadKey(input: {
    mailboxEmail: string;
    from: string;
    subject: string;
    messageId?: string | null;
    inReplyTo?: string | null;
  }): string {
    const normalizedReplyTo = this.normalizeMessageId(input.inReplyTo);
    if (normalizedReplyTo) return `msg:${normalizedReplyTo}`;

    const normalizedMessageId = this.normalizeMessageId(input.messageId);
    if (normalizedMessageId) return `msg:${normalizedMessageId}`;

    const stablePayload = [
      this.normalizeEmailAddress(input.mailboxEmail),
      this.normalizeEmailAddress(input.from),
      this.normalizeSubjectForThread(input.subject),
    ].join('.');
    const digest = createHash('sha256').update(stablePayload).digest('hex');
    return `fallback:${digest.slice(0, 32)}`;
  }

  private async findPersistedDuplicateMessage(input: {
    userId: string;
    mailboxId: string;
    inboundMessageId?: string | null;
  }): Promise<Email | null> {
    if (!input.inboundMessageId) return null;
    return this.emailRepo.findOne({
      where: {
        userId: input.userId,
        mailboxId: input.mailboxId,
        inboundMessageId: input.inboundMessageId,
      },
    });
  }

  private async findPersistedInboundEvent(input: {
    mailboxId: string;
    messageId?: string | null;
  }): Promise<MailboxInboundEvent | null> {
    if (!input.messageId) return null;
    return this.mailboxInboundEventRepo.findOne({
      where: {
        mailboxId: input.mailboxId,
        messageId: input.messageId,
      },
    });
  }

  private async upsertInboundEvent(input: {
    mailboxId?: string | null;
    userId?: string | null;
    messageId?: string | null;
    emailId?: string | null;
    inboundThreadKey?: string | null;
    sourceIp?: string | null;
    signatureValidated: boolean;
    status: 'ACCEPTED' | 'DEDUPLICATED' | 'REJECTED';
    errorReason?: string | null;
  }): Promise<void> {
    if (!input.mailboxId || !input.userId || !input.messageId) return;
    await this.mailboxInboundEventRepo.upsert(
      {
        mailboxId: input.mailboxId,
        userId: input.userId,
        messageId: input.messageId,
        emailId: input.emailId || null,
        inboundThreadKey: input.inboundThreadKey || null,
        sourceIp: input.sourceIp || null,
        signatureValidated: input.signatureValidated,
        status: input.status,
        errorReason: input.errorReason || null,
      },
      ['mailboxId', 'messageId'],
    );
  }

  private async emitInboundNotification(input: {
    requestId?: string;
    userId: string;
    mailboxId: string;
    mailboxEmail: string;
    workspaceId?: string | null;
    from: string;
    subject: string;
    status: 'ACCEPTED' | 'DEDUPLICATED' | 'REJECTED';
    sourceIp?: string | null;
    messageId?: string | null;
    inboundThreadKey?: string | null;
    emailId?: string | null;
    sizeBytes?: string | null;
    errorReason?: string | null;
  }): Promise<void> {
    const title = (() => {
      if (input.status === 'ACCEPTED') {
        return `New email on ${input.mailboxEmail}`;
      }
      if (input.status === 'DEDUPLICATED') {
        return `Duplicate inbound email on ${input.mailboxEmail}`;
      }
      return `Inbound email rejected on ${input.mailboxEmail}`;
    })();
    const message = (() => {
      if (input.status === 'ACCEPTED') {
        return `From ${input.from}: ${input.subject}`;
      }
      if (input.status === 'DEDUPLICATED') {
        const duplicateMessageId = input.messageId || '(missing messageId)';
        return `Duplicate delivery for ${duplicateMessageId} was deduplicated.`;
      }
      return `Rejected inbound message from ${input.from}: ${input.errorReason || 'unknown error'}`;
    })();

    try {
      await this.notificationEventBus.publishSafely({
        userId: input.userId,
        type: 'MAILBOX_INBOUND',
        title,
        message,
        metadata: {
          mailboxId: input.mailboxId,
          mailboxEmail: input.mailboxEmail,
          workspaceId: input.workspaceId || null,
          sizeBytes: input.sizeBytes || null,
          messageId: input.messageId || null,
          inboundThreadKey: input.inboundThreadKey || null,
          sourceIp: input.sourceIp || null,
          inboundStatus: input.status,
          emailId: input.emailId || null,
          errorReason: input.errorReason || null,
        },
      });
    } catch (notificationError) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'mailbox_inbound_notification_emit_failed',
          requestId: input.requestId || null,
          mailboxEmail: input.mailboxEmail,
          inboundStatus: input.status,
          reason:
            notificationError instanceof Error
              ? notificationError.message
              : 'unknown',
        }),
      );
    }
  }

  async ingestInboundEvent(
    input: MailboxInboundWebhookInput,
    auth: InboundAuthInput,
  ): Promise<MailboxInboundIngestResult> {
    const startedAtMs = Date.now();
    const requestId = resolveCorrelationId(auth.requestIdHeader);
    const mailboxEmail = this.normalizeEmailAddress(input.mailboxEmail);
    const normalizedMessageId = this.normalizeMessageId(input.messageId);
    let outcome: 'ACCEPTED' | 'DEDUPLICATED' | 'REJECTED' = 'REJECTED';
    let resolvedMailboxId: string | null = null;
    let resolvedUserId: string | null = null;
    let resolvedWorkspaceId: string | null = null;
    let signatureValidated = false;
    let deduplicated = false;

    try {
      this.assertWebhookAuth(auth);
      signatureValidated = this.assertWebhookSignature(auth, input);
      this.assertInboundBody(input);

      const mailbox = await this.mailboxRepo.findOne({
        where: { email: mailboxEmail },
      });
      if (!mailbox) {
        throw new NotFoundException('Mailbox not found for inbound webhook');
      }
      resolvedMailboxId = mailbox.id;
      resolvedUserId = mailbox.userId;
      resolvedWorkspaceId = mailbox.workspaceId || null;

      const duplicate = this.findDuplicateMessageId(
        mailbox.id,
        normalizedMessageId || undefined,
      );
      if (duplicate) {
        deduplicated = true;
        outcome = 'DEDUPLICATED';
        await this.upsertInboundEvent({
          mailboxId: mailbox.id,
          userId: mailbox.userId,
          messageId: normalizedMessageId,
          emailId: duplicate.emailId,
          sourceIp: auth.sourceIp || null,
          signatureValidated,
          status: 'DEDUPLICATED',
        });
        this.logger.log(
          serializeStructuredLog({
            event: 'mailbox_inbound_duplicate_cached',
            requestId,
            mailboxEmail: mailbox.email,
            emailId: duplicate.emailId,
            messageId: normalizedMessageId,
          }),
        );
        await this.emitInboundNotification({
          requestId,
          userId: mailbox.userId,
          mailboxId: mailbox.id,
          mailboxEmail: mailbox.email,
          workspaceId: mailbox.workspaceId,
          from: input.from,
          subject: input.subject?.trim() || '(no subject)',
          status: 'DEDUPLICATED',
          sourceIp: auth.sourceIp || null,
          messageId: normalizedMessageId,
          emailId: duplicate.emailId,
        });
        return {
          accepted: true,
          mailboxId: mailbox.id,
          mailboxEmail: mailbox.email,
          emailId: duplicate.emailId,
          deduplicated: true,
        };
      }

      const persistedInboundEvent = await this.findPersistedInboundEvent({
        mailboxId: mailbox.id,
        messageId: normalizedMessageId,
      });
      if (persistedInboundEvent?.emailId) {
        deduplicated = true;
        outcome = 'DEDUPLICATED';
        this.rememberMessageId(
          mailbox.id,
          normalizedMessageId || undefined,
          persistedInboundEvent.emailId,
        );
        await this.emitInboundNotification({
          requestId,
          userId: mailbox.userId,
          mailboxId: mailbox.id,
          mailboxEmail: mailbox.email,
          workspaceId: mailbox.workspaceId,
          from: input.from,
          subject: input.subject?.trim() || '(no subject)',
          status: 'DEDUPLICATED',
          sourceIp: auth.sourceIp || null,
          messageId: normalizedMessageId,
          emailId: persistedInboundEvent.emailId,
        });
        return {
          accepted: true,
          mailboxId: mailbox.id,
          mailboxEmail: mailbox.email,
          emailId: persistedInboundEvent.emailId,
          deduplicated: true,
        };
      }

      const persistedDuplicate = await this.findPersistedDuplicateMessage({
        userId: mailbox.userId,
        mailboxId: mailbox.id,
        inboundMessageId: normalizedMessageId,
      });
      if (persistedDuplicate) {
        deduplicated = true;
        outcome = 'DEDUPLICATED';
        this.rememberMessageId(
          mailbox.id,
          normalizedMessageId || undefined,
          persistedDuplicate.id,
        );
        await this.upsertInboundEvent({
          mailboxId: mailbox.id,
          userId: mailbox.userId,
          messageId: normalizedMessageId,
          emailId: persistedDuplicate.id,
          sourceIp: auth.sourceIp || null,
          signatureValidated,
          status: 'DEDUPLICATED',
        });
        this.logger.log(
          serializeStructuredLog({
            event: 'mailbox_inbound_duplicate_persisted',
            requestId,
            mailboxEmail: mailbox.email,
            emailId: persistedDuplicate.id,
            messageId: normalizedMessageId,
          }),
        );
        await this.emitInboundNotification({
          requestId,
          userId: mailbox.userId,
          mailboxId: mailbox.id,
          mailboxEmail: mailbox.email,
          workspaceId: mailbox.workspaceId,
          from: input.from,
          subject: input.subject?.trim() || '(no subject)',
          status: 'DEDUPLICATED',
          sourceIp: auth.sourceIp || null,
          messageId: normalizedMessageId,
          emailId: persistedDuplicate.id,
        });
        return {
          accepted: true,
          mailboxId: mailbox.id,
          mailboxEmail: mailbox.email,
          emailId: persistedDuplicate.id,
          deduplicated: true,
        };
      }

      const inboundSizeBytes = this.resolveApproximateSizeBytes(input);
      this.assertMailboxWritable(mailbox, inboundSizeBytes);

      const subject = input.subject?.trim() || '(no subject)';
      const body = input.htmlBody?.trim() || input.textBody?.trim() || '';
      const to =
        input.to
          ?.map((entry) => this.normalizeEmailAddress(entry))
          .filter(Boolean) || [];
      if (!to.includes(mailboxEmail)) {
        to.push(mailboxEmail);
      }
      const inboundThreadKey = this.resolveInboundThreadKey({
        mailboxEmail,
        from: input.from,
        subject,
        messageId: normalizedMessageId,
        inReplyTo: this.normalizeMessageId(input.inReplyTo),
      });

      const email = await this.emailRepo.save(
        this.emailRepo.create({
          userId: mailbox.userId,
          mailboxId: mailbox.id,
          subject,
          body,
          from: this.normalizeEmailAddress(input.from),
          to,
          status: 'NEW',
          isImportant: false,
          inboundMessageId: normalizedMessageId,
          inboundThreadKey,
        }),
      );

      const nextUsage = this.resolveNextMailboxUsageBytes(
        mailbox.usedBytes,
        inboundSizeBytes,
      );
      await this.mailboxRepo.update(
        { id: mailbox.id },
        { usedBytes: nextUsage },
      );

      await this.emitInboundNotification({
        requestId,
        userId: mailbox.userId,
        mailboxId: mailbox.id,
        mailboxEmail: mailbox.email,
        workspaceId: mailbox.workspaceId,
        from: input.from,
        subject,
        status: 'ACCEPTED',
        sourceIp: auth.sourceIp || null,
        messageId: normalizedMessageId,
        inboundThreadKey,
        emailId: email.id,
        sizeBytes: inboundSizeBytes.toString(),
      });

      await this.upsertInboundEvent({
        mailboxId: mailbox.id,
        userId: mailbox.userId,
        messageId: normalizedMessageId,
        emailId: email.id,
        inboundThreadKey,
        sourceIp: auth.sourceIp || null,
        signatureValidated,
        status: 'ACCEPTED',
      });
      outcome = 'ACCEPTED';

      this.logger.log(
        serializeStructuredLog({
          event: 'mailbox_inbound_accepted',
          requestId,
          mailboxEmail: mailbox.email,
          emailId: email.id,
          sourceIp: auth.sourceIp || 'unknown',
        }),
      );
      this.rememberMessageId(
        mailbox.id,
        normalizedMessageId || undefined,
        email.id,
      );

      return {
        accepted: true,
        mailboxId: mailbox.id,
        mailboxEmail: mailbox.email,
        emailId: email.id,
        deduplicated: false,
      };
    } catch (error: unknown) {
      const errorReason = (() => {
        if (error instanceof Error) return error.message;
        if (typeof error === 'string') return error;
        return 'unknown';
      })();
      await this.upsertInboundEvent({
        mailboxId: resolvedMailboxId,
        userId: resolvedUserId,
        messageId: normalizedMessageId,
        sourceIp: auth.sourceIp || null,
        signatureValidated,
        status: 'REJECTED',
        errorReason,
      });
      if (resolvedMailboxId && resolvedUserId) {
        await this.emitInboundNotification({
          requestId,
          userId: resolvedUserId,
          mailboxId: resolvedMailboxId,
          mailboxEmail,
          workspaceId: resolvedWorkspaceId,
          from: input.from,
          subject: input.subject?.trim() || '(no subject)',
          status: 'REJECTED',
          sourceIp: auth.sourceIp || null,
          messageId: normalizedMessageId,
          errorReason,
        });
      }
      throw error;
    } finally {
      this.logger.log(
        serializeStructuredLog({
          event: 'mailbox_inbound_processed',
          requestId,
          mailboxId: resolvedMailboxId,
          mailboxEmail,
          messageId: normalizedMessageId,
          sourceIp: auth.sourceIp || null,
          signatureValidated,
          deduplicated,
          outcome,
          latencyMs: Date.now() - startedAtMs,
        }),
      );
    }
  }
}
