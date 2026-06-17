/**
 * File:        core/infrastructure/persistence/typeorm/repositories/typeorm-phone-verification.repository.ts
 * Module:      Infrastructure - Persistence
 * Purpose:     Adapter for PhoneVerification repository.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { IPhoneVerificationRepository } from '../../../../application/ports/repositories/phone-verification.repository';
import { PhoneVerification } from '../../../../domain/bounded-contexts/phone/phone-verification.aggregate';
import { Result } from '../../../../domain/shared/result';
import { PhoneVerificationOrmEntity } from '../entities/phone-verification.orm-entity';

@Injectable()
export class TypeOrmPhoneVerificationRepository implements IPhoneVerificationRepository {
  constructor(
    @InjectRepository(PhoneVerificationOrmEntity)
    private readonly repo: Repository<PhoneVerificationOrmEntity>,
  ) {}

  async save(verification: PhoneVerification): Promise<Result<void, Error>> {
    try {
      const orm = this.toOrm(verification);
      await this.repo.save(orm);
      return Result.ok(undefined);
    } catch (e) {
      return Result.err(e as Error);
    }
  }

  async findActiveForPhone(phoneE164: string): Promise<PhoneVerification | null> {
    const row = await this.repo.findOne({
      where: { phoneE164, verifiedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    return row ? this.toDomain(row) : null;
  }

  private toOrm(v: PhoneVerification): PhoneVerificationOrmEntity {
    const orm = new PhoneVerificationOrmEntity();
    orm.id = v.id;
    orm.userId = v.props.userId;
    orm.phoneE164 = v.props.phoneE164;
    orm.codeHash = v.props.codeHash;
    orm.attempts = v.props.attempts;
    orm.expiresAt = v.props.expiresAt;
    orm.verifiedAt = v.props.verifiedAt;
    return orm;
  }

  private toDomain(row: PhoneVerificationOrmEntity): PhoneVerification {
    return PhoneVerification.reconstitute({
      id: row.id,
      userId: row.userId,
      phoneE164: row.phoneE164,
      codeHash: row.codeHash,
      attempts: row.attempts,
      expiresAt: row.expiresAt,
      verifiedAt: row.verifiedAt,
      createdAt: row.createdAt,
    });
  }
}
