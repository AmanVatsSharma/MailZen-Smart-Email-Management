import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { Template } from './entities/template.entity';
import { CreateTemplateInput } from './dto/create-template.input';
import { UpdateTemplateInput } from './dto/update-template.input';
import { serializeStructuredLog } from '../common/logging/structured-log.util';

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);

  constructor(
    @InjectRepository(Template)
    private readonly templateRepo: Repository<Template>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
  ) {}

  private normalizeActorUserId(actorUserId?: string): string {
    const normalized = String(actorUserId || '').trim();
    if (!normalized) {
      throw new BadRequestException('Actor user id is required');
    }
    return normalized;
  }

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
    const normalizedActorUserId = this.normalizeActorUserId(actorUserId);
    this.logger.log(
      serializeStructuredLog({
        event: 'template_create_start',
        templateName: input.name,
        actorUserId: normalizedActorUserId,
      }),
    );
    const template = this.templateRepo.create({
      name: input.name,
      subject: input.subject,
      body: input.body,
      userId: normalizedActorUserId,
    });
    const savedTemplate = await this.templateRepo.save(template);
    this.logger.log(
      serializeStructuredLog({
        event: 'template_create_completed',
        templateId: savedTemplate.id,
        actorUserId: normalizedActorUserId,
      }),
    );
    await this.writeAuditLog({
      userId: normalizedActorUserId,
      action: 'template_created',
      metadata: {
        templateId: savedTemplate.id,
        templateName: savedTemplate.name,
      },
    });
    return savedTemplate;
  }

  async getAllTemplates(actorUserId?: string): Promise<Template[]> {
    const normalizedActorUserId = this.normalizeActorUserId(actorUserId);
    const templates = await this.templateRepo.find({
      where: { userId: normalizedActorUserId },
      order: { updatedAt: 'DESC' },
    });
    this.logger.log(
      serializeStructuredLog({
        event: 'template_list_completed',
        actorUserId: normalizedActorUserId,
        templateCount: templates.length,
      }),
    );
    return templates;
  }

  async getTemplateById(id: string, actorUserId?: string): Promise<Template> {
    const normalizedActorUserId = this.normalizeActorUserId(actorUserId);
    const template = await this.templateRepo.findOne({
      where: {
        id,
        userId: normalizedActorUserId,
      },
    });
    if (!template) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'template_get_missing',
          templateId: id,
          actorUserId: normalizedActorUserId,
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
    const normalizedActorUserId = this.normalizeActorUserId(actorUserId);
    this.logger.log(
      serializeStructuredLog({
        event: 'template_update_start',
        templateId: input.id,
        actorUserId: normalizedActorUserId,
      }),
    );
    const template = await this.getTemplateById(input.id, normalizedActorUserId);
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
    const savedTemplate = await this.templateRepo.save(template);
    this.logger.log(
      serializeStructuredLog({
        event: 'template_update_completed',
        templateId: savedTemplate.id,
        actorUserId: normalizedActorUserId,
      }),
    );
    await this.writeAuditLog({
      userId: normalizedActorUserId,
      action: 'template_updated',
      metadata: {
        templateId: savedTemplate.id,
        templateName: savedTemplate.name,
        changedFields,
      },
    });
    return savedTemplate;
  }

  async deleteTemplate(id: string, actorUserId?: string): Promise<Template> {
    const normalizedActorUserId = this.normalizeActorUserId(actorUserId);
    this.logger.log(
      serializeStructuredLog({
        event: 'template_delete_start',
        templateId: id,
        actorUserId: normalizedActorUserId,
      }),
    );
    const deleted = await this.getTemplateById(id, normalizedActorUserId);
    await this.templateRepo.remove(deleted);
    this.logger.log(
      serializeStructuredLog({
        event: 'template_delete_completed',
        templateId: deleted.id,
        actorUserId: normalizedActorUserId,
      }),
    );
    await this.writeAuditLog({
      userId: normalizedActorUserId,
      action: 'template_deleted',
      metadata: {
        templateId: deleted.id,
        templateName: deleted.name,
      },
    });
    return deleted;
  }
}
