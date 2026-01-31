import { Injectable, NotFoundException } from '@nestjs/common';
import { Label } from './label.entity';
import { CreateLabelInput } from './dto/create-label.input';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LabelService {
  constructor(private readonly prisma: PrismaService) {}

  async createLabel(userId: string, createLabelInput: CreateLabelInput): Promise<Label> {
    const created = await this.prisma.emailLabel.create({
      data: {
        userId,
        name: createLabelInput.name,
        color: createLabelInput.color ?? undefined,
      },
    });
    return { id: created.id, name: created.name, color: created.color };
  }

  async getAllLabels(userId: string): Promise<Label[]> {
    const labels = await this.prisma.emailLabel.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return labels.map(l => ({ id: l.id, name: l.name, color: l.color }));
  }

  async getLabelById(userId: string, id: string): Promise<Label> {
    const label = await this.prisma.emailLabel.findFirst({ where: { id, userId } });
    if (!label) throw new NotFoundException(`Label with id ${id} not found`);
    return { id: label.id, name: label.name, color: label.color };
  }
} 