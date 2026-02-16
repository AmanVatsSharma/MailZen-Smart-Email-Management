import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Template } from './template.entity';
import { CreateTemplateInput } from './dto/create-template.input';
import { UpdateTemplateInput } from './dto/update-template.input';
import { serializeStructuredLog } from '../common/logging/structured-log.util';

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);
  private templates: Template[] = [];
  private idCounter = 1;

  createTemplate(input: CreateTemplateInput): Template {
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

  updateTemplate(input: UpdateTemplateInput): Template {
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
    this.logger.log(
      serializeStructuredLog({
        event: 'template_update_completed',
        templateId: template.id,
      }),
    );
    return template;
  }

  deleteTemplate(id: string): Template {
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
    return deleted;
  }
}
