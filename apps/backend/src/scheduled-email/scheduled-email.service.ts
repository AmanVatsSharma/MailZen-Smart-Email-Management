import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScheduledEmail } from './scheduled-email.entity';
import { CreateScheduledEmailInput } from './dto/create-scheduled-email.input';

@Injectable()
export class ScheduledEmailService {
  constructor(
    @InjectRepository(ScheduledEmail)
    private readonly scheduledEmailRepo: Repository<ScheduledEmail>,
  ) {}

  async createScheduledEmail(
    input: CreateScheduledEmailInput,
    userId: string,
  ): Promise<ScheduledEmail> {
    const scheduledEmail = this.scheduledEmailRepo.create({
      subject: input.subject,
      body: input.body,
      recipientIds: input.recipientIds,
      scheduledAt: input.scheduledAt,
      status: input.status || 'PENDING',
      userId,
    });
    return this.scheduledEmailRepo.save(scheduledEmail);
  }

  async getAllScheduledEmails(userId: string): Promise<ScheduledEmail[]> {
    return this.scheduledEmailRepo.find({
      where: { userId },
      order: { scheduledAt: 'ASC' },
    });
  }

  // Additional methods (update, delete) can be added as needed.
}
