import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Label } from './label.entity';
import { CreateLabelInput } from './dto/create-label.input';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { EmailLabel } from '../email/entities/email-label.entity';
import { serializeStructuredLog } from '../common/logging/structured-log.util';

@Injectable()
export class LabelService {
  private readonly logger = new Logger(LabelService.name);

  constructor(
    @InjectRepository(EmailLabel)
    private readonly emailLabelRepo: Repository<EmailLabel>,
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
          event: 'label_audit_log_write_failed',
          userId: input.userId,
          action: input.action,
          error: String(error),
        }),
      );
    }
  }

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
    await this.writeAuditLog({
      userId,
      action: 'label_created',
      metadata: {
        labelId: created.id,
        name: created.name,
        color: created.color ?? null,
      },
    });
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
