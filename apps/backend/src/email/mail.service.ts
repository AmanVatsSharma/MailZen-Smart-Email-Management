import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import type { SentMessageInfo } from 'nodemailer';
import { CreateEmailInput } from './dto/create-email.input';

@Injectable()
export class MailService {
  /**
   * NOTE:
   * - We intentionally use `@nestjs-modules/mailer` here (already configured in `EmailModule`).
   * - This replaces `@mobizerg/nest-nodemailer`, which has an incompatible Nest peer dependency
   *   (it expects Nest v6 while this repo uses Nest v11), and breaks workspace installs.
   */
  constructor(private readonly mailerService: MailerService) {}

  async sendRealEmail(
    createEmailInput: CreateEmailInput,
  ): Promise<SentMessageInfo> {
    const mailOptions = {
      from: '"MailZen" <no-reply@mailzen.com>',
      to: createEmailInput.recipientIds.join(', '),
      subject: createEmailInput.subject,
      text: createEmailInput.body,
      // You can add html content here if needed
    };
    // MailerService is a thin wrapper around Nodemailer; `sendMail` returns Nodemailer info.
    return await this.mailerService.sendMail(mailOptions);
  }
}
