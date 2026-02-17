import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue, Job } from 'bull';
import { Repository } from 'typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { serializeStructuredLog } from '../common/logging/structured-log.util';
import { EmailService } from './email.service';
import { SendEmailInput } from './dto/send-email.input';

@Injectable()
@Processor('email')
export class EmailSchedulerService {
  private readonly logger = new Logger(EmailSchedulerService.name);

  constructor(
    @InjectQueue('email') private emailQueue: Queue,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    private emailService: EmailService,
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
          event: 'email_scheduler_audit_log_write_failed',
          userId: input.userId,
          action: input.action,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  async scheduleEmail(input: SendEmailInput, userId: string) {
    this.logger.log(
      serializeStructuredLog({
        event: 'email_scheduler_schedule_requested',
        userId,
        scheduledAtIso: input.scheduledAt
          ? new Date(input.scheduledAt).toISOString()
          : null,
      }),
    );
    if (!input.scheduledAt) {
      await this.writeAuditLog({
        userId,
        action: 'email_schedule_creation_failed',
        metadata: {
          reason: 'missing_scheduled_at',
        },
      });
      throw new Error('Scheduled date is required');
    }

    const delay = new Date(input.scheduledAt).getTime() - Date.now();
    if (delay < 0) {
      await this.writeAuditLog({
        userId,
        action: 'email_schedule_creation_failed',
        metadata: {
          reason: 'scheduled_in_past',
          scheduledAtIso: new Date(input.scheduledAt).toISOString(),
        },
      });
      throw new Error('Cannot schedule email in the past');
    }

    const queuedJob = await this.emailQueue.add(
      'send-email',
      { input, userId },
      { delay },
    );
    this.logger.log(
      serializeStructuredLog({
        event: 'email_scheduler_schedule_enqueued',
        userId,
        jobId: String(queuedJob.id),
        delayMs: delay,
      }),
    );
    await this.writeAuditLog({
      userId,
      action: 'email_schedule_created',
      metadata: {
        jobId: String(queuedJob.id),
        delayMs: delay,
        scheduledAtIso: new Date(input.scheduledAt).toISOString(),
      },
    });
    return queuedJob;
  }

  @Process('send-email')
  async processScheduledEmail(
    job: Job<{ input: SendEmailInput; userId: string }>,
  ) {
    const { input, userId } = job.data;
    this.logger.log(
      serializeStructuredLog({
        event: 'email_scheduler_dispatch_start',
        userId,
        jobId: String(job.id),
      }),
    );
    try {
      const sendResult = await this.emailService.sendEmail(input, userId);
      await this.writeAuditLog({
        userId,
        action: 'email_schedule_dispatched',
        metadata: {
          jobId: String(job.id),
          emailId: sendResult?.id ?? null,
        },
      });
      this.logger.log(
        serializeStructuredLog({
          event: 'email_scheduler_dispatch_completed',
          userId,
          jobId: String(job.id),
        }),
      );
      return sendResult;
    } catch (error) {
      await this.writeAuditLog({
        userId,
        action: 'email_schedule_dispatch_failed',
        metadata: {
          jobId: String(job.id),
          error: error instanceof Error ? error.message : String(error),
        },
      });
      this.logger.error(
        serializeStructuredLog({
          event: 'email_scheduler_dispatch_failed',
          userId,
          jobId: String(job.id),
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      throw error;
    }
  }

  async getScheduledEmails(userId: string) {
    const jobs = await this.emailQueue.getJobs(['delayed']);
    return jobs.filter((job) => job.data.userId === userId);
  }

  async cancelScheduledEmail(jobId: string, userId: string) {
    this.logger.log(
      serializeStructuredLog({
        event: 'email_scheduler_cancel_requested',
        userId,
        jobId,
      }),
    );
    const job = await this.emailQueue.getJob(jobId);
    if (!job) {
      await this.writeAuditLog({
        userId,
        action: 'email_schedule_cancel_failed',
        metadata: {
          jobId,
          reason: 'job_not_found',
        },
      });
      throw new Error('Scheduled email not found');
    }

    if (job.data.userId !== userId) {
      await this.writeAuditLog({
        userId,
        action: 'email_schedule_cancel_failed',
        metadata: {
          jobId,
          reason: 'unauthorized',
        },
      });
      throw new Error('Unauthorized to cancel this email');
    }

    await job.remove();
    await this.writeAuditLog({
      userId,
      action: 'email_schedule_cancelled',
      metadata: {
        jobId,
      },
    });
    this.logger.log(
      serializeStructuredLog({
        event: 'email_scheduler_cancel_completed',
        userId,
        jobId,
      }),
    );
    return { success: true };
  }
}
