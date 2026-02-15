import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { timingSafeEqual } from 'crypto';
import { Repository } from 'typeorm';
import { Email } from '../email/entities/email.entity';
import { NotificationService } from '../notification/notification.service';
import { MailboxInboundWebhookInput } from './dto/mailbox-inbound-webhook.input';
import { Mailbox } from './entities/mailbox.entity';

type InboundAuthInput = {
  inboundTokenHeader?: string;
  authorizationHeader?: string;
  sourceIp?: string;
};

type MailboxInboundIngestResult = {
  accepted: boolean;
  mailboxId: string;
  mailboxEmail: string;
  emailId: string;
};

@Injectable()
export class MailboxInboundService {
  private readonly logger = new Logger(MailboxInboundService.name);

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
    try {
      const currentUsage = BigInt(currentValue || '0');
      return (currentUsage + incomingSizeBytes).toString();
    } catch {
      return incomingSizeBytes.toString();
    }
  }

  async ingestInboundEvent(
    input: MailboxInboundWebhookInput,
    auth: InboundAuthInput,
  ): Promise<MailboxInboundIngestResult> {
    this.assertWebhookAuth(auth);
    this.assertInboundBody(input);

    const mailboxEmail = this.normalizeEmailAddress(input.mailboxEmail);
    const mailbox = await this.mailboxRepo.findOne({
      where: { email: mailboxEmail },
    });
    if (!mailbox) {
      throw new NotFoundException('Mailbox not found for inbound webhook');
    }

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

    const inboundSizeBytes = this.resolveApproximateSizeBytes(input);
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
      },
    });

    this.logger.log(
      `mailbox-inbound: accepted mailbox=${mailbox.email} emailId=${email.id}`,
    );

    return {
      accepted: true,
      mailboxId: mailbox.id,
      mailboxEmail: mailbox.email,
      emailId: email.id,
    };
  }
}
