/**
 * File:        apps/backend/src/core/application/use-cases/messaging/create-filter/create-filter.handler.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     CreateFilter use case. Persists a new EmailFilterRecord with
 *              the supplied rules.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { randomUUID } from 'crypto';
import {
  EmailFilterRecord,
  IEmailFilterRepository,
  EMAIL_FILTER_REPOSITORY,
} from '../../../ports/repositories/email-filter.repository';
import { UserId } from '../../../../../domain/shared/value-objects/ids';
import { Result, makeResult } from '../../../../../domain/shared/result';
import { ValidationError } from '../../../exceptions/application-error';
import { CreateFilterInput, CreateFilterOutput } from './create-filter.dto';

export const CREATE_FILTER_HANDLER = Symbol('CreateFilterHandler');

export class CreateFilterHandler {
  constructor(private readonly filters: IEmailFilterRepository) {}

  async execute(input: CreateFilterInput): Promise<Result<CreateFilterOutput, Error>> {
    if (!input.name || input.name.trim().length === 0) {
      return makeResult(Result.err(new ValidationError('name is required', 'name')));
    }
    if (!Array.isArray(input.rules) || input.rules.length === 0) {
      return makeResult(Result.err(new ValidationError('at least one rule is required', 'rules')));
    }
    const record: EmailFilterRecord = {
      id: randomUUID(),
      ownerUserId: UserId.from(input.ownerUserId),
      name: input.name,
      rules: input.rules,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await this.filters.save(record);
    return makeResult(Result.ok({ id: record.id, name: record.name, ruleCount: record.rules.length }));
  }
}
