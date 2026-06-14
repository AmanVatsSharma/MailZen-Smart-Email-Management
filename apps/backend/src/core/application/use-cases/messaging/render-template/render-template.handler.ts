/**
 * File:        apps/backend/src/core/application/use-cases/messaging/render-template/render-template.handler.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     RenderTemplate use case. Loads the template and interpolates
 *              {{var}} placeholders using the provided variable map.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import {
  IEmailTemplateRepository,
  EMAIL_TEMPLATE_REPOSITORY,
} from '../../../ports/repositories/email-template.repository';
import { Result, makeResult } from '../../../../../domain/shared/result';
import { NotFoundError } from '../../../exceptions/application-error';
import { RenderTemplateInput, RenderTemplateOutput } from './render-template.dto';

export const RENDER_TEMPLATE_HANDLER = Symbol('RenderTemplateHandler');

export class RenderTemplateHandler {
  constructor(private readonly templates: IEmailTemplateRepository) {}

  async execute(input: RenderTemplateInput): Promise<Result<RenderTemplateOutput, Error>> {
    const t = await this.templates.findById(input.templateId);
    if (!t) return makeResult(Result.err(new NotFoundError('Template')));
    return makeResult(Result.ok(t.render(input.variables)));
  }
}
