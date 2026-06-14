/**
 * File:        apps/backend/src/core/application/use-cases/messaging/list-templates/list-templates.handler.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     ListTemplates use case. Returns the user's email templates.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import {
  IEmailTemplateRepository,
  EMAIL_TEMPLATE_REPOSITORY,
} from '../../../ports/repositories/email-template.repository';
import { UserId } from '../../../../../domain/shared/value-objects/ids';
import { Result, makeResult } from '../../../../../domain/shared/result';
import { ListTemplatesInput, ListTemplatesOutput } from './list-templates.dto';

export const LIST_TEMPLATES_HANDLER = Symbol('ListTemplatesHandler');

export class ListTemplatesHandler {
  constructor(private readonly templates: IEmailTemplateRepository) {}

  async execute(input: ListTemplatesInput): Promise<Result<ListTemplatesOutput, Error>> {
    const list = await this.templates.listByOwner(UserId.from(input.ownerUserId));
    return makeResult(Result.ok({
      items: list.map((t) => {
        const props = (t as unknown as { props: { id: string; name: string; subject: string; body: string } }).props;
        return { id: props.id, name: props.name, subject: props.subject, body: props.body };
      }),
    }));
  }
}
