/**
 * File:        apps/backend/src/core/application/use-cases/messaging/update-filter/update-filter.handler.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     UpdateFilter use case. Mutates name and/or rules on an
 *              existing EmailFilterRecord owned by the user.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import {
  EmailFilterRecord,
  IEmailFilterRepository,
  EMAIL_FILTER_REPOSITORY,
} from '../../../ports/repositories/email-filter.repository';
import { UserId } from '../../../../../domain/shared/value-objects/ids';
import { Result, makeResult } from '../../../../../domain/shared/result';
import { NotFoundError, ValidationError } from '../../../exceptions/application-error';
import { UpdateFilterInput, UpdateFilterOutput } from './update-filter.dto';

export const UPDATE_FILTER_HANDLER = Symbol('UpdateFilterHandler');

export class UpdateFilterHandler {
  constructor(private readonly filters: IEmailFilterRepository) {}

  async execute(input: UpdateFilterInput): Promise<Result<UpdateFilterOutput, Error>> {
    const existing = await this.filters.findById(input.id);
    if (!existing) return makeResult(Result.err(new NotFoundError('Filter')));
    if (existing.ownerUserId !== UserId.from(input.ownerUserId)) {
      return makeResult(Result.err(new NotFoundError('Filter')));
    }
    if (input.rules && input.rules.length === 0) {
      return makeResult(Result.err(new ValidationError('rules cannot be empty', 'rules')));
    }
    const updated: EmailFilterRecord = {
      ...existing,
      name: input.name ?? existing.name,
      rules: input.rules ?? existing.rules,
      updatedAt: new Date(),
    };
    await this.filters.save(updated);
    return makeResult(Result.ok({ id: updated.id, name: updated.name, ruleCount: updated.rules.length }));
  }
}
