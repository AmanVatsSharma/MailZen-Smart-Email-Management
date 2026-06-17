/**
 * File:        core/infrastructure/persistence/typeorm/repositories/typeorm-email-template.repository.ts
 * Module:      Infrastructure - Persistence
 * Purpose:     Adapter implementing IEmailTemplateRepository with TypeORM.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IEmailTemplateRepository } from '../../../../application/ports/repositories/email-template.repository';
import { EmailTemplate } from '../../../../domain/bounded-contexts/messaging/email-template.aggregate';
import { Result } from '../../../../domain/shared/result';
import { EmailTemplateId, WorkspaceId } from '../../../../domain/shared/value-objects/ids';
import { EmailTemplateOrmEntity } from '../entities/email-template.orm-entity';

@Injectable()
export class TypeOrmEmailTemplateRepository implements IEmailTemplateRepository {
  constructor(
    @InjectRepository(EmailTemplateOrmEntity)
    private readonly repo: Repository<EmailTemplateOrmEntity>,
  ) {}

  async save(template: EmailTemplate): Promise<Result<void, Error>> {
    try {
      const orm = this.toOrm(template);
      await this.repo.save(orm);
      return Result.ok(undefined);
    } catch (e) {
      return Result.err(e as Error);
    }
  }

  async findById(id: EmailTemplateId): Promise<EmailTemplate | null> {
    const row = await this.repo.findOne({ where: { id: id.value } });
    return row ? this.toDomain(row) : null;
  }

  async listByWorkspace(workspaceId: WorkspaceId): Promise<EmailTemplate[]> {
    const rows = await this.repo.find({
      where: { workspaceId: workspaceId.value },
      order: { updatedAt: 'DESC' },
    });
    return rows.map(r => this.toDomain(r));
  }

  async delete(id: EmailTemplateId): Promise<Result<void, Error>> {
    try {
      await this.repo.delete({ id: id.value });
      return Result.ok(undefined);
    } catch (e) {
      return Result.err(e as Error);
    }
  }

  private toOrm(t: EmailTemplate): EmailTemplateOrmEntity {
    const orm = new EmailTemplateOrmEntity();
    orm.id = t.id.value;
    orm.workspaceId = t.props.workspaceId.value;
    orm.name = t.props.name;
    orm.subject = t.props.subject;
    orm.bodyHtml = t.props.bodyHtml;
    orm.variables = t.props.variables;
    orm.category = t.props.category;
    return orm;
  }

  private toDomain(row: EmailTemplateOrmEntity): EmailTemplate {
    return EmailTemplate.reconstitute({
      id: row.id,
      workspaceId: WorkspaceId.from(row.workspaceId),
      name: row.name,
      subject: row.subject,
      bodyHtml: row.bodyHtml,
      variables: row.variables,
      category: row.category,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
