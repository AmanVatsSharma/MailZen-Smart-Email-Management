import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { Template } from './template.entity';
import { CreateTemplateInput } from './dto/create-template.input';
import { UpdateTemplateInput } from './dto/update-template.input';
import { serializeStructuredLog } from '../common/logging/structured-log.util';

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);
  private templates: Template[] = [];
  private idCounter = 1;

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
  ) {}

  private async writeAuditLog(input: {
    userId?: string;
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
          event: 'template_audit_log_write_failed',
          userId: input.userId || null,
          action: input.action,
          error: String(error),
        }),
      );
    }
  }

  async createTemplate(
    input: CreateTemplateInput,
    actorUserId?: string,
  ): Promise<Template> {
    this.logger.log(
      serializeStructuredLog({
        event: 'template_create_start',
        templateName: input.name,
      }),
    );
    const template: Template = {
      id: String(this.idCounter++),
      name: input.name,
      subject: input.subject,
      body: input.body,
    };
    this.templates.push(template);
    this.logger.log(
      serializeStructuredLog({
        event: 'template_create_completed',
        templateId: template.id,
        templateCount: this.templates.length,
      }),
    );
    await this.writeAuditLog({
      userId: actorUserId,
      action: 'template_created',
      metadata: {
        templateId: template.id,
        templateName: template.name,
      },
    });
    return template;
  }

  getAllTemplates(): Template[] {
    this.logger.log(
      serializeStructuredLog({
        event: 'template_list_completed',
        templateCount: this.templates.length,
      }),
    );
    return this.templates;
  }

  getTemplateById(id: string): Template {
    const template = this.templates.find((t) => t.id === id);
    if (!template) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'template_get_missing',
          templateId: id,
        }),
      );
      throw new NotFoundException(`Template with id ${id} not found`);
    }
    return template;
  }

  async updateTemplate(
    input: UpdateTemplateInput,
    actorUserId?: string,
  ): Promise<Template> {
    this.logger.log(
      serializeStructuredLog({
        event: 'template_update_start',
        templateId: input.id,
      }),
    );
    const template = this.getTemplateById(input.id);
    if (input.name !== undefined) {
      template.name = input.name;
    }
    if (input.subject !== undefined) {
      template.subject = input.subject;
    }
    if (input.body !== undefined) {
      template.body = input.body;
    }
    const changedFields = Object.entries(input)
      .filter(([key, value]) => key !== 'id' && typeof value !== 'undefined')
      .map(([key]) => key)
      .sort();
    this.logger.log(
      serializeStructuredLog({
        event: 'template_update_completed',
        templateId: template.id,
      }),
    );
    await this.writeAuditLog({
      userId: actorUserId,
      action: 'template_updated',
      metadata: {
        templateId: template.id,
        templateName: template.name,
        changedFields,
      },
    });
    return template;
  }

  async deleteTemplate(id: string, actorUserId?: string): Promise<Template> {
    this.logger.log(
      serializeStructuredLog({
        event: 'template_delete_start',
        templateId: id,
      }),
    );
    const index = this.templates.findIndex((t) => t.id === id);
    if (index === -1) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'template_delete_missing',
          templateId: id,
        }),
      );
      throw new NotFoundException(`Template with id ${id} not found`);
    }
    const [deleted] = this.templates.splice(index, 1);
    this.logger.log(
      serializeStructuredLog({
        event: 'template_delete_completed',
        templateId: deleted.id,
        templateCount: this.templates.length,
      }),
    );
    await this.writeAuditLog({
      userId: actorUserId,
      action: 'template_deleted',
      metadata: {
        templateId: deleted.id,
        templateName: deleted.name,
      },
    });
    return deleted;
  }
}
