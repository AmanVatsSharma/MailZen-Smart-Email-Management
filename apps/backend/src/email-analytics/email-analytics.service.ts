import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EmailAnalytics } from './email-analytics.entity';
import { CreateEmailAnalyticsInput } from './dto/create-email-analytics.input';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { EmailAnalytics as EmailAnalyticsEntity } from './entities/email-analytics.entity';
import { Email } from '../email/entities/email.entity';
import { serializeStructuredLog } from '../common/logging/structured-log.util';

@Injectable()
export class EmailAnalyticsService {
  private readonly logger = new Logger(EmailAnalyticsService.name);

  constructor(
    @InjectRepository(EmailAnalyticsEntity)
    private readonly analyticsRepo: Repository<EmailAnalyticsEntity>,
    @InjectRepository(Email)
    private readonly emailRepo: Repository<Email>,
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
          event: 'email_analytics_audit_log_write_failed',
          userId: input.userId,
          action: input.action,
          error: String(error),
        }),
      );
    }
  }

  async createEmailAnalytics(
    userId: string,
    input: CreateEmailAnalyticsInput,
  ): Promise<EmailAnalytics> {
    this.logger.log(
      serializeStructuredLog({
        event: 'email_analytics_create_start',
        userId,
        emailId: input.emailId,
      }),
    );
    // Ownership: analytics is scoped to an internal Email record owned by user.
    const email = await this.emailRepo.findOne({
      where: { id: input.emailId, userId },
    });
    if (!email) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'email_analytics_create_email_missing',
          userId,
          emailId: input.emailId,
        }),
      );
      throw new NotFoundException('Email not found');
    }

    await this.analyticsRepo.upsert(
      [
        {
          emailId: input.emailId,
          openCount: input.openCount ?? 0,
          clickCount: input.clickCount ?? 0,
        },
      ],
      ['emailId'],
    );

    const rec = await this.analyticsRepo.findOne({
      where: { emailId: input.emailId },
    });
    if (!rec)
      throw new NotFoundException('Email analytics not found after upsert');
    const result = {
      id: rec.id,
      emailId: rec.emailId,
      openCount: rec.openCount,
      clickCount: rec.clickCount,
      lastUpdatedAt: rec.updatedAt,
    };
    this.logger.log(
      serializeStructuredLog({
        event: 'email_analytics_create_completed',
        userId,
        emailId: rec.emailId,
        openCount: rec.openCount,
        clickCount: rec.clickCount,
      }),
    );
    await this.writeAuditLog({
      userId,
      action: 'email_analytics_upserted',
      metadata: {
        emailId: rec.emailId,
        openCount: rec.openCount,
        clickCount: rec.clickCount,
        lastUpdatedAtIso: rec.updatedAt.toISOString(),
      },
    });
    return result;
  }

  async getAllEmailAnalytics(userId: string): Promise<EmailAnalytics[]> {
    this.logger.log(
      serializeStructuredLog({
        event: 'email_analytics_list_start',
        userId,
      }),
    );
    const recs = await this.analyticsRepo
      .createQueryBuilder('a')
      .innerJoin('a.email', 'e')
      .where('e.userId = :userId', { userId })
      .orderBy('a.updatedAt', 'DESC')
      .getMany();
    const response = recs.map((r) => ({
      id: r.id,
      emailId: r.emailId,
      openCount: r.openCount,
      clickCount: r.clickCount,
      lastUpdatedAt: r.updatedAt,
    }));
    this.logger.log(
      serializeStructuredLog({
        event: 'email_analytics_list_completed',
        userId,
        resultCount: response.length,
      }),
    );
    return response;
  }

  // Additional methods (update, delete) can be added as needed.
}
