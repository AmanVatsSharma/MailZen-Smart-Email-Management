/**
 * File:        apps/backend/src/core/application/use-cases/contacts/remove-tag/remove-tag.handler.ts
 * Module:      Contacts Use Cases
 * Purpose:     Remove a tag from a contact
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable, Inject } from '@nestjs/common';
import { CONTACT_REPOSITORY, IContactRepository } from '../../ports/repositories/contact.repository';
import { Result } from '../../../../domain/shared/result';
import { ApplicationError } from '../../exceptions/application-error';
import { RemoveTagCommand } from './remove-tag.command';

@Injectable()
export class RemoveTagHandler {
  constructor(
    @Inject(CONTACT_REPOSITORY) private contactRepo: IContactRepository,
  ) {}

  async execute(command: RemoveTagCommand): Promise<Result<string, ApplicationError>> {
    const contact = await this.contactRepo.findById(command.input.contactId);
    if (!contact) {
      return Result.err(new ApplicationError('NOT_FOUND', 'Contact not found'));
    }

    const result = contact.removeTag(command.input.tag);
    if (result.isErr()) {
      return Result.err(new ApplicationError('TAG_FAILED', result.error.message));
    }

    const save = await this.contactRepo.save(contact);
    if (save.isErr()) {
      return Result.err(new ApplicationError('SAVE_FAILED', save.error.message));
    }

    return Result.ok(contact.id);
  }
}
