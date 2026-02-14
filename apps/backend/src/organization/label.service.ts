import { Injectable, NotFoundException } from '@nestjs/common';
import { Label } from './label.entity';
import { CreateLabelInput } from './dto/create-label.input';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailLabel } from '../email/entities/email-label.entity';

@Injectable()
export class LabelService {
  constructor(
    @InjectRepository(EmailLabel)
    private readonly emailLabelRepo: Repository<EmailLabel>,
  ) {}

  async createLabel(
    userId: string,
    createLabelInput: CreateLabelInput,
  ): Promise<Label> {
    const created = await this.emailLabelRepo.save(
      this.emailLabelRepo.create({
        userId,
        name: createLabelInput.name,
        color: createLabelInput.color ?? undefined,
      }),
    );
    return { id: created.id, name: created.name, color: created.color };
  }

  async getAllLabels(userId: string): Promise<Label[]> {
    const labels = await this.emailLabelRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return labels.map((l) => ({ id: l.id, name: l.name, color: l.color }));
  }

  async getLabelById(userId: string, id: string): Promise<Label> {
    const label = await this.emailLabelRepo.findOne({ where: { id, userId } });
    if (!label) throw new NotFoundException(`Label with id ${id} not found`);
    return { id: label.id, name: label.name, color: label.color };
  }
}
