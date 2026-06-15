/**
 * File:        core/infrastructure/persistence/typeorm/repositories/typeorm-attachment.repository.ts
 * Module:      Infrastructure - Persistence
 * Purpose:     Adapter implementing IAttachmentRepository with TypeORM.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IAttachmentRepository } from '../../../application/ports/repositories/attachment.repository';
import { Attachment } from '../../../../domain/bounded-contexts/messaging/attachment.entity';
import { Result } from '../../../../domain/shared/result';
import { EmailId } from '../../../../domain/shared/value-objects/ids';
import { AttachmentOrmEntity } from '../entities/attachment.orm-entity';

@Injectable()
export class TypeOrmAttachmentRepository implements IAttachmentRepository {
  constructor(
    @InjectRepository(AttachmentOrmEntity)
    private readonly repo: Repository<AttachmentOrmEntity>,
  ) {}

  async save(attachment: Attachment): Promise<Result<void, Error>> {
    try {
      const orm = this.toOrm(attachment);
      await this.repo.save(orm);
      return Result.ok(undefined);
    } catch (e) {
      return Result.err(e as Error);
    }
  }

  async findById(id: string): Promise<Attachment | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async listByEmail(emailId: EmailId): Promise<Attachment[]> {
    const rows = await this.repo.find({ where: { emailId: emailId.value } });
    return rows.map(r => this.toDomain(r));
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete({ id });
  }

  private toOrm(a: Attachment): AttachmentOrmEntity {
    const orm = new AttachmentOrmEntity();
    orm.id = a.id;
    orm.emailId = a.props.emailId.value;
    orm.filename = a.props.filename;
    orm.contentType = a.props.contentType;
    orm.size = a.props.size;
    orm.url = a.props.url;
    orm.cid = a.props.cid;
    return orm;
  }

  private toDomain(row: AttachmentOrmEntity): Attachment {
    return Attachment.reconstitute({
      id: row.id,
      emailId: row.emailId,
      filename: row.filename,
      contentType: row.contentType,
      size: row.size,
      url: row.url,
      cid: row.cid,
      createdAt: row.createdAt,
    });
  }
}
