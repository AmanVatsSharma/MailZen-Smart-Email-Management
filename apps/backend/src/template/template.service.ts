import { Injectable, NotFoundException } from '@nestjs/common';
import { Template } from './template.entity';
import { CreateTemplateInput } from './dto/create-template.input';
import { UpdateTemplateInput } from './dto/update-template.input';

@Injectable()
export class TemplateService {
  private templates: Template[] = [];
  private idCounter = 1;

  createTemplate(input: CreateTemplateInput): Template {
    const template: Template = {
      id: String(this.idCounter++),
      name: input.name,
      subject: input.subject,
      body: input.body
    };
    this.templates.push(template);
    return template;
  }

  getAllTemplates(): Template[] {
    return this.templates;
  }

  getTemplateById(id: string): Template {
    const template = this.templates.find(t => t.id === id);
    if (!template) {
      throw new NotFoundException(`Template with id ${id} not found`);
    }
    return template;
  }

  updateTemplate(input: UpdateTemplateInput): Template {
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
    return template;
  }

  deleteTemplate(id: string): Template {
    const index = this.templates.findIndex(t => t.id === id);
    if (index === -1) {
      throw new NotFoundException(`Template with id ${id} not found`);
    }
    const [deleted] = this.templates.splice(index, 1);
    return deleted;
  }
} 