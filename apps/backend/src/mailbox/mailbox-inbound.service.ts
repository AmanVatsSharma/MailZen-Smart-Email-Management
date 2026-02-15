import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, timingSafeEqual } from 'crypto';
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
      (input.messageId || '').trim(),
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
    const normalizedMessageId = (messageId || '').trim().toLowerCase();
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
    const normalizedMessageId = (messageId || '').trim().toLowerCase();
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

    const duplicate = this.findDuplicateMessageId(mailbox.id, input.messageId);
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

    const email = await this.emailRepo.save(
      this.emailRepo.create({
        userId: mailbox.userId,
        subject,
        body,
        from: this.normalizeEmailAddress(input.from),
        to,
        status: 'NEW',
        isImportant: false,
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
        messageId: input.messageId || null,
        sourceIp: auth.sourceIp || null,
      },
    });

    this.logger.log(
      `mailbox-inbound: accepted mailbox=${mailbox.email} emailId=${email.id} sourceIp=${auth.sourceIp || 'unknown'}`,
    );
    this.rememberMessageId(mailbox.id, input.messageId, email.id);

    return {
      accepted: true,
      mailboxId: mailbox.id,
      mailboxEmail: mailbox.email,
      emailId: email.id,
      deduplicated: false,
    };
  }
}
