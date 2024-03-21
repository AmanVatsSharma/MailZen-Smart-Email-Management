import { Injectable, NotFoundException } from '@nestjs/common';
import { ScheduledEmail } from './scheduled-email.entity';
import { CreateScheduledEmailInput } from './dto/create-scheduled-email.input';

@Injectable()
export class ScheduledEmailService {
  private scheduledEmails: ScheduledEmail[] = [];
  private idCounter = 1;

  createScheduledEmail(input: CreateScheduledEmailInput): ScheduledEmail {
    const scheduledEmail: ScheduledEmail = {
      id: String(this.idCounter++),
      subject: input.subject,
      body: input.body,
      recipientIds: input.recipientIds,
      scheduledAt: input.scheduledAt,
      status: input.status
    };
    this.scheduledEmails.push(scheduledEmail);
    return scheduledEmail;
  }

  getAllScheduledEmails(): ScheduledEmail[] {
    return this.scheduledEmails;
  }

  // Additional methods (update, delete) can be added as needed.
} 