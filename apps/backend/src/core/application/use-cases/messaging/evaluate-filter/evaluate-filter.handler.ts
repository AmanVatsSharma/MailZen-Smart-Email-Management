/**
 * File:        apps/backend/src/core/application/use-cases/messaging/evaluate-filter/evaluate-filter.handler.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     EvaluateFilter use case. Loads the filter and the target
 *              email, applies the spec, and returns the matching state plus
 *              the action to take.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import {
  IEmailFilterRepository,
  EMAIL_FILTER_REPOSITORY,
} from '../../../ports/repositories/email-filter.repository';
import { IEmailRepository, EMAIL_REPOSITORY } from '../../../ports/repositories/email.repository';
import { buildEmailFilter } from '../../../../../domain/bounded-contexts/messaging/email-filter.specification';
import { EmailId } from '../../../../../domain/shared/value-objects/ids';
import { Result, makeResult } from '../../../../../domain/shared/result';
import { NotFoundError } from '../../../exceptions/application-error';
import { EvaluateFilterInput, EvaluateFilterOutput } from './evaluate-filter.dto';

export const EVALUATE_FILTER_HANDLER = Symbol('EvaluateFilterHandler');

export class EvaluateFilterHandler {
  constructor(
    private readonly filters: IEmailFilterRepository,
    private readonly emails: IEmailRepository,
  ) {}

  async execute(input: EvaluateFilterInput): Promise<Result<EvaluateFilterOutput, Error>> {
    const filter = await this.filters.findById(input.filterId);
    if (!filter) return makeResult(Result.err(new NotFoundError('Filter')));
    const email = await this.emails.findById(EmailId.from(input.emailId));
    if (!email) return makeResult(Result.err(new NotFoundError('Email')));
    const spec = buildEmailFilter({ id: filter.id, name: filter.name, rules: filter.rules });
    const matches = spec.matches(email);
    const firstRule = filter.rules[0] ?? null;
    return makeResult(Result.ok({
      matches,
      action: matches && firstRule ? firstRule.action : null,
      actionValue: matches && firstRule ? firstRule.actionValue ?? null : null,
    }));
  }
}
