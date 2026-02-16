import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MailerService } from '@nestjs-modules/mailer';
import type { SentMessageInfo } from 'nodemailer';
import { Repository } from 'typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { serializeStructuredLog } from '../common/logging/structured-log.util';
import { CreateEmailInput } from './dto/create-email.input';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  /**
   * NOTE:
   * - We intentionally use `@nestjs-modules/mailer` here (already configured in `EmailModule`).
   * - This replaces `@mobizerg/nest-nodemailer`, which has an incompatible Nest peer dependency
   *   (it expects Nest v6 while this repo uses Nest v11), and breaks workspace installs.
   */
  constructor(
    private readonly mailerService: MailerService,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
  ) {}

  private async writeAuditLog(input: {
    userId: string;
    action: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      const auditEntry = this.auditLogRepo.create({
        userId: input.userId,
        action: input.action,
        metadata: input.metadata,
      });
      await this.auditLogRepo.save(auditEntry);
    } catch (error) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'mail_service_audit_log_write_failed',
          userId: input.userId,
          action: input.action,
          error: String(error),
        }),
      );
    }
  }

  async sendRealEmail(
    createEmailInput: CreateEmailInput,
    userId: string,
  ): Promise<SentMessageInfo> {
    this.logger.log(
      serializeStructuredLog({
        event: 'mail_service_send_real_email_start',
        userId,
        recipientCount: createEmailInput.recipientIds.length,
      }),
    );
    const mailOptions = {
      from: '"MailZen" <no-reply@mailzen.com>',
      to: createEmailInput.recipientIds.join(', '),
      subject: createEmailInput.subject,
      text: createEmailInput.body,
      // You can add html content here if needed
    };
    // MailerService is a thin wrapper around Nodemailer; `sendMail` returns Nodemailer info.
    try {
      const sendResult = await this.mailerService.sendMail(mailOptions);
      await this.writeAuditLog({
        userId,
        action: 'real_email_sent',
        metadata: {
          senderId: createEmailInput.senderId,
          recipientCount: createEmailInput.recipientIds.length,
          subjectLength: createEmailInput.subject.length,
        },
      });
      this.logger.log(
        serializeStructuredLog({
          event: 'mail_service_send_real_email_completed',
          userId,
          recipientCount: createEmailInput.recipientIds.length,
        }),
      );
      return sendResult;
    } catch (error) {
      await this.writeAuditLog({
        userId,
        action: 'real_email_send_failed',
        metadata: {
          senderId: createEmailInput.senderId,
          recipientCount: createEmailInput.recipientIds.length,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      this.logger.error(
        serializeStructuredLog({
          event: 'mail_service_send_real_email_failed',
          userId,
          recipientCount: createEmailInput.recipientIds.length,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      throw error;
    }
  }
}
