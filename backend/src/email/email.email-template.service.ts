import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmailTemplateInput, UpdateEmailTemplateInput } from './dto/email-template.input';
import { Template } from '@prisma/client';

@Injectable()
export class EmailTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  async createTemplate(input: CreateEmailTemplateInput, userId: string): Promise<Template> {
    return this.prisma.template.create({
      data: {
        ...input,
        userId,
      },
    });
  }

  async updateTemplate(id: string, input: UpdateEmailTemplateInput, userId: string): Promise<Template> {
    const template = await this.prisma.template.findFirst({
      where: { id, userId },
    });

    if (!template) {
      throw new NotFoundException(`Template with ID ${id} not found`);
    }

    return this.prisma.template.update({
      where: { id },
      data: input,
    });
  }

  async deleteTemplate(id: string, userId: string): Promise<Template> {
    const template = await this.prisma.template.findFirst({
      where: { id, userId },
    });

    if (!template) {
      throw new NotFoundException(`Template with ID ${id} not found`);
    }

    return this.prisma.template.delete({
      where: { id },
    });
  }

  async getTemplates(userId: string): Promise<Template[]> {
    return this.prisma.template.findMany({
      where: { userId },
    });
  }

  async getTemplateById(id: string, userId: string): Promise<Template> {
    const template = await this.prisma.template.findFirst({
      where: { id, userId },
    });

    if (!template) {
      throw new NotFoundException(`Template with ID ${id} not found`);
    }

    return template;
  }

  async renderTemplate(templateId: string, variables: Record<string, any>): Promise<string> {
    const template = await this.prisma.template.findUnique({
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