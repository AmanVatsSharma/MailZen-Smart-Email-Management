/**
 * File:        core/infrastructure/persistence/typeorm/repositories/typeorm-contact.repository.ts
 * Module:      Infrastructure - Persistence
 * Purpose:     Adapter implementing IContactRepository with TypeORM.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { IContactRepository } from '../../../application/ports/repositories/contact.repository';
import { Contact } from '../../../../domain/bounded-contexts/contacts/contact.aggregate';
import { Result } from '../../../../domain/shared/result';
import { ContactId, WorkspaceId } from '../../../../domain/shared/value-objects/ids';
import { ContactOrmEntity } from '../entities/contact.orm-entity';

@Injectable()
export class TypeOrmContactRepository implements IContactRepository {
  constructor(
    @InjectRepository(ContactOrmEntity)
    private readonly repo: Repository<ContactOrmEntity>,
  ) {}

  async save(contact: Contact): Promise<Result<void, Error>> {
    try {
      const orm = this.toOrm(contact);
      await this.repo.save(orm);
      return Result.ok(undefined);
    } catch (e) {
      return Result.err(e as Error);
    }
  }

  async findById(id: ContactId): Promise<Contact | null> {
    const row = await this.repo.findOne({ where: { id: id.value } });
    return row ? this.toDomain(row) : null;
  }

  async findByEmail(email: string, workspaceId: WorkspaceId): Promise<Contact | null> {
    const row = await this.repo.findOne({
      where: { email: email.toLowerCase(), workspaceId: workspaceId.value },
    });
    return row ? this.toDomain(row) : null;
  }

  async list(filter: {
    workspaceId: WorkspaceId;
    limit: number;
    offset: number;
    search?: string;
    tag?: string;
  }) {
    const qb = this.repo.createQueryBuilder('c')
      .where('c.workspaceId = :ws', { ws: filter.workspaceId.value });
    if (filter.search) {
      qb.andWhere('(c.email ILIKE :s OR c.displayName ILIKE :s)', { s: `%${filter.search}%` });
    }
    if (filter.tag) {
      qb.andWhere(':tag = ANY(c.tags)', { tag: filter.tag });
    }
    qb.take(filter.limit).skip(filter.offset).orderBy('c.createdAt', 'DESC');
    const [rows, total] = await qb.getManyAndCount();
    return { items: rows.map(r => this.toDomain(r)), total };
  }

  async delete(id: ContactId): Promise<Result<void, Error>> {
    try {
      await this.repo.delete({ id: id.value });
      return Result.ok(undefined);
    } catch (e) {
      return Result.err(e as Error);
    }
  }

  private toOrm(contact: Contact): ContactOrmEntity {
    const orm = new ContactOrmEntity();
    orm.id = contact.props.id;
    orm.workspaceId = contact.props.workspaceId.value;
    orm.email = contact.props.email;
    orm.displayName = contact.props.displayName;
    orm.phone = contact.props.phone;
    orm.notes = contact.props.notes;
    orm.tags = contact.props.tags;
    return orm;
  }

  private toDomain(row: ContactOrmEntity): Contact {
    return Contact.reconstitute({
      id: row.id,
      workspaceId: WorkspaceId.from(row.workspaceId),
      email: row.email,
      displayName: row.displayName,
      phone: row.phone,
      notes: row.notes,
      tags: row.tags,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
