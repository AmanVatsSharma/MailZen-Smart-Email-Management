import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { ScheduledEmail } from './scheduled-email.entity';
import { CreateScheduledEmailInput } from './dto/create-scheduled-email.input';
import { serializeStructuredLog } from '../common/logging/structured-log.util';

@Injectable()
export class ScheduledEmailService {
  private readonly logger = new Logger(ScheduledEmailService.name);

  constructor(
    @InjectRepository(ScheduledEmail)
    private readonly scheduledEmailRepo: Repository<ScheduledEmail>,
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
          event: 'scheduled_email_audit_log_write_failed',
          userId: input.userId,
          action: input.action,
          error: String(error),
        }),
      );
    }
  }

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
        scheduledItemId: result.id,
        status: result.status,
      }),
    );
    await this.writeAuditLog({
      userId,
      action: 'scheduled_email_created',
      metadata: {
        scheduledItemId: result.id,
        recipientCount: Array.isArray(result.recipientIds)
          ? result.recipientIds.length
          : 0,
        scheduledAtIso: result.scheduledAt.toISOString(),
        status: result.status,
      },
    });
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
