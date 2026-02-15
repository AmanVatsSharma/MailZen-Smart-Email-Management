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
import { Email } from '../email/entities/email.entity';
import { NotificationService } from '../notification/notification.service';
import { MailboxInboundWebhookInput } from './dto/mailbox-inbound-webhook.input';
import { Mailbox } from './entities/mailbox.entity';

type InboundAuthInput = {
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
    private readonly notificationService: NotificationService,
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
  ): void {
    const signingKey = this.resolveSigningKey();
    if (!signingKey) return;

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
    inboundMessageId?: string | null;
  }): Promise<Email | null> {
    if (!input.inboundMessageId) return null;
    return this.emailRepo.findOne({
      where: {
        userId: input.userId,
        inboundMessageId: input.inboundMessageId,
      },
    });
  }

  async ingestInboundEvent(
    input: MailboxInboundWebhookInput,
    auth: InboundAuthInput,
  ): Promise<MailboxInboundIngestResult> {
    this.assertWebhookAuth(auth);
    this.assertWebhookSignature(auth, input);
    this.assertInboundBody(input);

    const mailboxEmail = this.normalizeEmailAddress(input.mailboxEmail);
    const mailbox = await this.mailboxRepo.findOne({
      where: { email: mailboxEmail },
    });
    if (!mailbox) {
      throw new NotFoundException('Mailbox not found for inbound webhook');
    }

    const normalizedMessageId = this.normalizeMessageId(input.messageId);
    const duplicate = this.findDuplicateMessageId(
      mailbox.id,
      normalizedMessageId || undefined,
    );
    if (duplicate) {
      this.logger.log(
        `mailbox-inbound: duplicate messageId accepted mailbox=${mailbox.email} emailId=${duplicate.emailId}`,
      );
      return {
        accepted: true,
        mailboxId: mailbox.id,
        mailboxEmail: mailbox.email,
        emailId: duplicate.emailId,
        deduplicated: true,
      };
    }

    const persistedDuplicate = await this.findPersistedDuplicateMessage({
      userId: mailbox.userId,
      inboundMessageId: normalizedMessageId,
    });
    if (persistedDuplicate) {
      this.rememberMessageId(
        mailbox.id,
        normalizedMessageId || undefined,
        persistedDuplicate.id,
      );
      this.logger.log(
        `mailbox-inbound: persistent duplicate accepted mailbox=${mailbox.email} emailId=${persistedDuplicate.id}`,
      );
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
    await this.mailboxRepo.update({ id: mailbox.id }, { usedBytes: nextUsage });

    await this.notificationService.createNotification({
      userId: mailbox.userId,
      type: 'MAILBOX_INBOUND',
      title: `New email on ${mailbox.email}`,
      message: `From ${input.from}: ${subject}`,
      metadata: {
        mailboxId: mailbox.id,
        mailboxEmail: mailbox.email,
        workspaceId: mailbox.workspaceId || null,
        sizeBytes: inboundSizeBytes.toString(),
        messageId: normalizedMessageId,
        inboundThreadKey,
        sourceIp: auth.sourceIp || null,
      },
    });

    this.logger.log(
      `mailbox-inbound: accepted mailbox=${mailbox.email} emailId=${email.id} sourceIp=${auth.sourceIp || 'unknown'}`,
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
  }
}
