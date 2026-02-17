import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { serializeStructuredLog } from '../common/logging/structured-log.util';
import {
  CreateEmailFilterInput,
  FilterCondition,
  FilterAction,
  EmailFilterRule,
} from './dto/email-filter.input';
import { EmailService } from './email.service';
import { Email } from './entities/email.entity';
import { EmailFilter } from './entities/email-filter.entity';
import { EmailProvider } from '../email-integration/entities/email-provider.entity';
import { EmailLabelAssignment } from './entities/email-label-assignment.entity';

interface EmailWithProvider extends Email {
  provider: EmailProvider;
}

@Injectable()
export class EmailFilterService {
  private readonly logger = new Logger(EmailFilterService.name);

  constructor(
    private emailService: EmailService,
    @InjectRepository(EmailFilter)
    private readonly emailFilterRepo: Repository<EmailFilter>,
    @InjectRepository(Email)
    private readonly emailRepo: Repository<Email>,
    @InjectRepository(EmailLabelAssignment)
    private readonly emailLabelAssignmentRepo: Repository<EmailLabelAssignment>,
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
          event: 'email_filter_audit_log_write_failed',
          userId: input.userId,
          action: input.action,
          error: String(error),
        }),
      );
    }
  }

  async createFilter(
    input: CreateEmailFilterInput,
    userId: string,
  ): Promise<EmailFilter> {
    // Persist as JSON array
    const savedFilter = await this.emailFilterRepo.save(
      this.emailFilterRepo.create({
        name: input.name,
        rules: input.rules as unknown as any,
        userId,
      }),
    );
    await this.writeAuditLog({
      userId,
      action: 'email_filter_created',
      metadata: {
        filterId: savedFilter.id,
        filterName: savedFilter.name,
        ruleCount: Array.isArray(input.rules) ? input.rules.length : 0,
      },
    });
    return savedFilter;
  }

  async getFilters(userId: string): Promise<EmailFilter[]> {
    return this.emailFilterRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async deleteFilter(id: string, userId: string): Promise<EmailFilter> {
    const filter = await this.emailFilterRepo.findOne({
      where: { id, userId },
    });

    if (!filter) {
      throw new Error('Filter not found');
    }

    await this.emailFilterRepo.delete({ id });
    await this.writeAuditLog({
      userId,
      action: 'email_filter_deleted',
      metadata: {
        filterId: filter.id,
        filterName: filter.name,
        ruleCount: Array.isArray(filter.rules) ? filter.rules.length : 0,
      },
    });
    return filter;
  }

  async applyFilters(emailId: string, userId: string): Promise<void> {
    const email = (await this.emailRepo.findOne({
      where: { id: emailId, userId },
      relations: ['provider'],
    })) as EmailWithProvider | null;

    if (!email) {
      throw new Error('Email not found');
    }

    const filters = await this.getFilters(userId);

    for (const filter of filters) {
      const rules: EmailFilterRule[] =
        filter.rules as unknown as EmailFilterRule[];
      for (const rule of rules) {
        if (this.matchesRule(email, rule)) {
          await this.executeAction(email, rule);
        }
      }
    }
  }

  private matchesRule(
    email: EmailWithProvider,
    rule: EmailFilterRule,
  ): boolean {
    const value =
      (email[rule.field as keyof EmailWithProvider] as string)?.toLowerCase() ||
      '';
    const testValue = rule.value.toLowerCase();

    switch (rule.condition) {
      case FilterCondition.CONTAINS:
        return value.includes(testValue);
      case FilterCondition.EQUALS:
        return value === testValue;
      case FilterCondition.STARTS_WITH:
        return value.startsWith(testValue);
      case FilterCondition.ENDS_WITH:
        return value.endsWith(testValue);
      default:
        return false;
    }
  }

  private async executeAction(
    email: EmailWithProvider,
    rule: EmailFilterRule,
  ): Promise<void> {
    switch (rule.action) {
      case FilterAction.MARK_READ:
        await this.emailService.markEmailRead(email.id, email.userId);
        break;
      case FilterAction.MARK_IMPORTANT:
        await this.emailRepo.update({ id: email.id }, { isImportant: true });
        break;
      case FilterAction.MOVE_TO_FOLDER:
        if (!rule.actionValue) break;
        await this.emailRepo.update(
          { id: email.id },
          { folderId: rule.actionValue },
        );
        break;
      case FilterAction.APPLY_LABEL:
        if (!rule.actionValue) break;
        await this.emailLabelAssignmentRepo.save(
          this.emailLabelAssignmentRepo.create({
            emailId: email.id,
            labelId: rule.actionValue,
          }),
        );
        break;
      case FilterAction.FORWARD_TO:
        if (!rule.actionValue) break;
        await this.emailService.sendEmail(
          {
            subject: `Fwd: ${email.subject}`,
            body: email.body,
            from: email.provider?.email || email.from,
            to: [rule.actionValue],
            providerId: email.providerId ?? undefined,
          },
          email.userId,
        );
        break;
    }
  }
}
