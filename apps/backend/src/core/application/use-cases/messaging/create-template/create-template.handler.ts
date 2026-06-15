/**
 * File:        apps/backend/src/core/application/use-cases/messaging/create-template/create-template.handler.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     CreateTemplate use case. Validates inputs and persists a new
 *              EmailTemplate aggregate.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { randomUUID } from 'crypto';
import {
  IEmailTemplateRepository,
  EMAIL_TEMPLATE_REPOSITORY,
} from '../../../ports/repositories/email-template.repository';
import { EmailTemplate } from '../../../../domain/bounded-contexts/messaging/email-template.aggregate';
import { UserId } from '../../../../domain/shared/value-objects/ids';
import { Result, makeResult } from '../../../../domain/shared/result';
import { ValidationError } from '../../../exceptions/application-error';
import { CreateTemplateInput, CreateTemplateOutput } from './create-template.dto';

export const CREATE_TEMPLATE_HANDLER = Symbol('CreateTemplateHandler');

export class CreateTemplateHandler {
  constructor(private readonly templates: IEmailTemplateRepository) {}

  async execute(input: CreateTemplateInput): Promise<Result<CreateTemplateOutput, Error>> {
    const created = EmailTemplate.create({
      id: randomUUID(),
      ownerUserId: UserId.from(input.ownerUserId),
      name: input.name,
      subject: input.subject,
      body: input.body,
    });
    if (!created.ok) return makeResult(Result.err(new ValidationError(created.error.message, 'name')));
    await this.templates.save(created.value);
    return makeResult(Result.ok({ id: created.value.id, name: created.value.name }));
  }
}
