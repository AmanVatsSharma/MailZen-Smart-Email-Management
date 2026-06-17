/**
 * File:        core/infrastructure/persistence/typeorm/repositories/typeorm-email-assignment.repository.ts
 * Module:      Infrastructure - Persistence
 * Purpose:     Adapter implementing IEmailAssignmentRepository with TypeORM.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IEmailAssignmentRepository } from '../../../../application/ports/repositories/email-assignment.repository';
import { EmailAssignment } from '../../../../domain/bounded-contexts/messaging/email-assignment.aggregate';
import { Result } from '../../../../domain/shared/result';
import { EmailId, UserId } from '../../../../domain/shared/value-objects/ids';
import { EmailAssignmentOrmEntity } from '../entities/email-assignment.orm-entity';

@Injectable()
export class TypeOrmEmailAssignmentRepository implements IEmailAssignmentRepository {
  constructor(
    @InjectRepository(EmailAssignmentOrmEntity)
    private readonly repo: Repository<EmailAssignmentOrmEntity>,
  ) {}

  async save(assignment: EmailAssignment): Promise<Result<void, Error>> {
    try {
      const orm = this.toOrm(assignment);
      await this.repo.save(orm);
      return Result.ok(undefined);
    } catch (e) {
      return Result.err(e as Error);
    }
  }

  async findByEmailId(emailId: EmailId): Promise<EmailAssignment | null> {
    const row = await this.repo.findOne({ where: { emailId: emailId.value } });
    return row ? this.toDomain(row) : null;
  }

  async listByUser(userId: UserId, limit: number, offset: number): Promise<{ items: EmailAssignment[]; total: number }> {
    const [rows, total] = await this.repo.findAndCount({
      where: { assigneeId: userId.value },
      take: limit,
      skip: offset,
      order: { assignedAt: 'DESC' },
    });
    return { items: rows.map(r => this.toDomain(r)), total };
  }

  private toOrm(a: EmailAssignment): EmailAssignmentOrmEntity {
    const orm = new EmailAssignmentOrmEntity();
    orm.id = a.props.id;
    orm.emailId = a.props.emailId.value;
    orm.assigneeId = a.props.assigneeId.value;
    orm.assignedById = a.props.assignedById?.value ?? null;
    orm.assignedAt = a.props.assignedAt;
    orm.completedAt = a.props.completedAt;
    return orm;
  }

  private toDomain(row: EmailAssignmentOrmEntity): EmailAssignment {
    return EmailAssignment.reconstitute({
      id: row.id,
      emailId: row.emailId,
      assigneeId: row.assigneeId,
      assignedById: row.assignedById,
      assignedAt: row.assignedAt,
      completedAt: row.completedAt,
    });
  }
}
