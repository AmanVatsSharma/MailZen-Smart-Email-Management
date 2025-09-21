import { Injectable } from '@nestjs/common';
import { SentMessageInfo } from 'nodemailer';
import { MailerService } from '@nestjs-modules/mailer';
import { CreateEmailInput } from './dto/create-email.input';

@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService) {}

  async sendRealEmail(createEmailInput: CreateEmailInput): Promise<SentMessageInfo> {
    const mailOptions = {
      from: '"MailZen" <no-reply@mailzen.com>',
      to: createEmailInput.recipientIds.join(', '),
      subject: createEmailInput.subject,
      text: createEmailInput.body,
      // You can add html content here if needed
    };
    return await this.mailerService.sendMail(mailOptions);
  }
} 