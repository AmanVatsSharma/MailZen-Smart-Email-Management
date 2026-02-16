import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { serializeStructuredLog } from '../common/logging/structured-log.util';
import {
  CreateEmailTemplateInput,
  UpdateEmailTemplateInput,
} from './dto/email-template.input';
import { Template } from '../template/entities/template.entity';

@Injectable()
export class EmailTemplateService {
  private readonly logger = new Logger(EmailTemplateService.name);

  constructor(
    @InjectRepository(Template)
    private readonly templateRepo: Repository<Template>,
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
          event: 'email_template_audit_log_write_failed',
          userId: input.userId,
          action: input.action,
          error: String(error),
        }),
      );
    }
  }

  async createTemplate(
    input: CreateEmailTemplateInput,
    userId: string,
  ): Promise<Template> {
    const entity = this.templateRepo.create({
      name: input.name,
      subject: input.subject,
      body: input.body,
      metadata: input.metadata ?? undefined,
      userId,
    });
    const savedTemplate = await this.templateRepo.save(entity);
    await this.writeAuditLog({
      userId,
      action: 'email_template_created',
      metadata: {
        templateId: savedTemplate.id,
        templateName: savedTemplate.name,
      },
    });
    return savedTemplate;
  }

  async updateTemplate(
    id: string,
    input: UpdateEmailTemplateInput,
    userId: string,
  ): Promise<Template> {
    const template = await this.templateRepo.findOne({ where: { id, userId } });

    if (!template) {
      throw new NotFoundException(`Template with ID ${id} not found`);
    }

    const changedFields = Object.entries(input)
      .filter(([, value]) => typeof value !== 'undefined')
      .map(([key]) => key)
      .sort();
    await this.templateRepo.update({ id }, { ...input } as any);
    const updated = await this.templateRepo.findOne({ where: { id, userId } });
    if (!updated)
      throw new NotFoundException(`Template with ID ${id} not found`);
    await this.writeAuditLog({
      userId,
      action: 'email_template_updated',
      metadata: {
        templateId: updated.id,
        templateName: updated.name,
        changedFields,
      },
    });
    return updated;
  }

  async deleteTemplate(id: string, userId: string): Promise<Template> {
    const template = await this.templateRepo.findOne({ where: { id, userId } });

    if (!template) {
      throw new NotFoundException(`Template with ID ${id} not found`);
    }

    await this.templateRepo.delete({ id });
    await this.writeAuditLog({
      userId,
      action: 'email_template_deleted',
      metadata: {
        templateId: template.id,
        templateName: template.name,
      },
    });
    return template;
  }

  async getTemplates(userId: string): Promise<Template[]> {
    return this.templateRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getTemplateById(id: string, userId: string): Promise<Template> {
    const template = await this.templateRepo.findOne({ where: { id, userId } });

    if (!template) {
      throw new NotFoundException(`Template with ID ${id} not found`);
    }

    return template;
  }

  async renderTemplate(
    templateId: string,
    variables: Record<string, any>,
  ): Promise<string> {
    const template = await this.templateRepo.findOne({
      where: { id: templateId },
    });

    if (!template) {
      throw new NotFoundException(`Template with ID ${templateId} not found`);
    }

    let renderedBody = template.body;

    // Replace variables in the template
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      renderedBody = renderedBody.replace(regex, String(value));
    });

    return renderedBody;
  }
}
