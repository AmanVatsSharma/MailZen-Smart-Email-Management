/**
 * File:        core/infrastructure/persistence/typeorm/repositories/typeorm-email-provider.repository.ts
 * Module:      Infrastructure - Persistence
 * Purpose:     Adapter implementing IEmailProviderRepository with TypeORM.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IEmailProviderRepository } from '../../../application/ports/repositories/email-provider.repository';
import { EmailProvider } from '../../../../domain/bounded-contexts/mailbox/email-provider.aggregate';
import { Result } from '../../../../domain/shared/result';
import { EmailProviderId, UserId, WorkspaceId } from '../../../../domain/shared/value-objects/ids';
import { EmailProviderOrmEntity } from '../entities/email-provider.orm-entity';

@Injectable()
export class TypeOrmEmailProviderRepository implements IEmailProviderRepository {
  constructor(
    @InjectRepository(EmailProviderOrmEntity)
    private readonly repo: Repository<EmailProviderOrmEntity>,
  ) {}

  async save(provider: EmailProvider): Promise<Result<void, Error>> {
    try {
      const orm = this.toOrm(provider);
      await this.repo.save(orm);
      return Result.ok(undefined);
    } catch (e) {
      return Result.err(e as Error);
    }
  }

  async findById(id: EmailProviderId): Promise<EmailProvider | null> {
    const row = await this.repo.findOne({ where: { id: id.value } });
    return row ? this.toDomain(row) : null;
  }

  async listByUser(userId: UserId, workspaceId: WorkspaceId): Promise<EmailProvider[]> {
    const rows = await this.repo.find({
      where: { userId: userId.value, workspaceId: workspaceId.value },
    });
    return rows.map(r => this.toDomain(r));
  }

  private toOrm(p: EmailProvider): EmailProviderOrmEntity {
    const orm = new EmailProviderOrmEntity();
    orm.id = p.id.value;
    orm.workspaceId = p.props.workspaceId.value;
    orm.userId = p.props.userId.value;
    orm.provider = p.props.provider;
    orm.emailAddress = p.props.emailAddress;
    orm.encryptedCredentials = p.props.encryptedCredentials;
    orm.connectedAt = p.props.connectedAt;
    return orm;
  }

  private toDomain(row: EmailProviderOrmEntity): EmailProvider {
    return EmailProvider.reconstitute({
      id: row.id,
      workspaceId: WorkspaceId.from(row.workspaceId),
      userId: UserId.from(row.userId),
      provider: row.provider as never,
      emailAddress: row.emailAddress,
      encryptedCredentials: row.encryptedCredentials,
      connectedAt: row.connectedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
