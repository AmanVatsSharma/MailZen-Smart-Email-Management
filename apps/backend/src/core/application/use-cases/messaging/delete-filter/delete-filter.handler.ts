/**
 * File:        apps/backend/src/core/application/use-cases/messaging/delete-filter/delete-filter.handler.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     DeleteFilter use case. Removes an EmailFilterRecord by id and
 *              owner; idempotent (returns success even if it does not exist).
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import {
  IEmailFilterRepository,
  EMAIL_FILTER_REPOSITORY,
} from '../../../ports/repositories/email-filter.repository';
import { UserId } from '../../../../domain/shared/value-objects/ids';
import { Result, makeResult } from '../../../../domain/shared/result';
import { DeleteFilterInput, DeleteFilterOutput } from './delete-filter.dto';

export const DELETE_FILTER_HANDLER = Symbol('DeleteFilterHandler');

export class DeleteFilterHandler {
  constructor(private readonly filters: IEmailFilterRepository) {}

  async execute(input: DeleteFilterInput): Promise<Result<DeleteFilterOutput, Error>> {
    const existing = await this.filters.findById(input.id);
    if (existing && existing.ownerUserId === UserId.from(input.ownerUserId)) {
      await this.filters.delete(input.id);
    }
    return makeResult(Result.ok({ deleted: true }));
  }
}
