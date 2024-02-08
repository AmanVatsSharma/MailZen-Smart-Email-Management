import { Injectable } from '@nestjs/common';
import { InjectTransport } from '@mobizerg/nest-nodemailer';
import { SentMessageInfo } from 'nodemailer';
import * as Mail from 'nodemailer/lib/mailer';
import { CreateEmailInput } from './dto/create-email.input';

@Injectable()
export class MailService {
  constructor(@InjectTransport() private readonly mailTransport: Mail) {}

  async sendRealEmail(createEmailInput: CreateEmailInput): Promise<SentMessageInfo> {
    const mailOptions = {
      from: '"MailZen" <no-reply@mailzen.com>',
      to: createEmailInput.recipientIds.join(', '),
      subject: createEmailInput.subject,
      text: createEmailInput.body,
      // You can add html content here if needed
    };
    return await this.mailTransport.sendMail(mailOptions);
  }
} 