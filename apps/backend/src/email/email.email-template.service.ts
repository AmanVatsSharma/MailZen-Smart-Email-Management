import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CreateEmailTemplateInput,
  UpdateEmailTemplateInput,
} from './dto/email-template.input';
import { Template } from '../template/entities/template.entity';

@Injectable()
export class EmailTemplateService {
  constructor(
    @InjectRepository(Template)
    private readonly templateRepo: Repository<Template>,
  ) {}

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
    return this.templateRepo.save(entity);
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

    await this.templateRepo.update({ id }, { ...input } as any);
    const updated = await this.templateRepo.findOne({ where: { id, userId } });
    if (!updated)
      throw new NotFoundException(`Template with ID ${id} not found`);
    return updated;
  }

  async deleteTemplate(id: string, userId: string): Promise<Template> {
    const template = await this.templateRepo.findOne({ where: { id, userId } });

    if (!template) {
      throw new NotFoundException(`Template with ID ${id} not found`);
    }

    await this.templateRepo.delete({ id });
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
