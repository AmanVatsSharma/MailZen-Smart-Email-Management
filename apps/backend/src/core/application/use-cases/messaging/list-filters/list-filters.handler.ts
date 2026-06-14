/**
 * File:        apps/backend/src/core/application/use-cases/messaging/list-filters/list-filters.handler.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     ListFilters use case. Returns the user's filters.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import {
  IEmailFilterRepository,
  EMAIL_FILTER_REPOSITORY,
} from '../../../ports/repositories/email-filter.repository';
import { UserId } from '../../../../../domain/shared/value-objects/ids';
import { Result, makeResult } from '../../../../../domain/shared/result';
import { ListFiltersInput, ListFiltersOutput } from './list-filters.dto';

export const LIST_FILTERS_HANDLER = Symbol('ListFiltersHandler');

export class ListFiltersHandler {
  constructor(private readonly filters: IEmailFilterRepository) {}

  async execute(input: ListFiltersInput): Promise<Result<ListFiltersOutput, Error>> {
    const list = await this.filters.listByOwner(UserId.from(input.ownerUserId));
    return makeResult(Result.ok({
      items: list.map((f) => ({ id: f.id, name: f.name, rules: f.rules })),
    }));
  }
}
