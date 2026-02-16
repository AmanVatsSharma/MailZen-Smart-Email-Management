import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScheduledEmail } from './scheduled-email.entity';
import { CreateScheduledEmailInput } from './dto/create-scheduled-email.input';
import { serializeStructuredLog } from '../common/logging/structured-log.util';

@Injectable()
export class ScheduledEmailService {
  private readonly logger = new Logger(ScheduledEmailService.name);

  constructor(
    @InjectRepository(ScheduledEmail)
    private readonly scheduledEmailRepo: Repository<ScheduledEmail>,
  ) {}

  async createScheduledEmail(
    input: CreateScheduledEmailInput,
    userId: string,
  ): Promise<ScheduledEmail> {
    this.logger.log(
      serializeStructuredLog({
        event: 'scheduled_email_create_start',
        userId,
        recipientCount: input.recipientIds.length,
        scheduledAtIso: input.scheduledAt.toISOString(),
      }),
    );
    const scheduledEmail = this.scheduledEmailRepo.create({
      subject: input.subject,
      body: input.body,
      recipientIds: input.recipientIds,
      scheduledAt: input.scheduledAt,
      status: input.status || 'PENDING',
      userId,
    });
    const result = await this.scheduledEmailRepo.save(scheduledEmail);
    this.logger.log(
      serializeStructuredLog({
        event: 'scheduled_email_create_completed',
        userId,
        scheduledEmailId: result.id,
        status: result.status,
      }),
    );
    return result;
  }

  async getAllScheduledEmails(userId: string): Promise<ScheduledEmail[]> {
    this.logger.log(
      serializeStructuredLog({
        event: 'scheduled_email_list_start',
        userId,
      }),
    );
    const result = await this.scheduledEmailRepo.find({
      where: { userId },
      order: { scheduledAt: 'ASC' },
    });
    this.logger.log(
      serializeStructuredLog({
        event: 'scheduled_email_list_completed',
        userId,
        resultCount: result.length,
      }),
    );
    return result;
  }

  // Additional methods (update, delete) can be added as needed.
}
