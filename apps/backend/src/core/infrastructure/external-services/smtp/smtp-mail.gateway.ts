// apps/backend/src/core/infrastructure/external-services/smtp/smtp-mail.gateway.ts
// Adapter: implements IMailGateway using nodemailer SMTP transport.
// Preserves the existing MailerModule behavior.

import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { IMailGateway, OutgoingMail } from '../../application/ports/gateways/mail.gateway';
import { Result } from '../../../domain/shared/result';

@Injectable()
export class SmtpMailGateway implements IMailGateway {
  private readonly logger = new Logger(SmtpMailGateway.name);

  constructor(private readonly mailer: MailerService) {}

  async send(mail: OutgoingMail): Promise<Result<{ providerMessageId: string }, Error>> {
    try {
      const info = await this.mailer.sendMail({
        from: mail.from,
        to: mail.to,
        cc: mail.cc,
        bcc: mail.bcc,
        subject: mail.subject,
        html: mail.bodyHtml,
        text: mail.bodyText,
        headers: mail.headers,
        attachments: mail.attachments?.map(a => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
        })),
      });
      return Result.ok({ providerMessageId: info.messageId ?? 'unknown' });
    } catch (e) {
      this.logger.error(`Mail send failed: ${(e as Error).message}`);
      return Result.err(e as Error);
    }
  }
}
