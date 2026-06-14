/**
 * File:        apps/backend/src/core/application/use-cases/contacts/delete-contact/delete-contact.handler.ts
 * Module:      Contacts Use Cases
 * Purpose:     Delete a contact
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable, Inject } from '@nestjs/common';
import { CONTACT_REPOSITORY, IContactRepository } from '../../ports/repositories/contact.repository';
import { Result } from '../../../../domain/shared/result';
import { ApplicationError } from '../../exceptions/application-error';
import { DeleteContactCommand } from './delete-contact.command';

@Injectable()
export class DeleteContactHandler {
  constructor(
    @Inject(CONTACT_REPOSITORY) private contactRepo: IContactRepository,
  ) {}

  async execute(command: DeleteContactCommand): Promise<Result<string, ApplicationError>> {
    const contact = await this.contactRepo.findById(command.input.contactId);
    if (!contact) {
      return Result.err(new ApplicationError('NOT_FOUND', 'Contact not found'));
    }

    const deleteResult = await this.contactRepo.delete(contact.id);
    if (deleteResult.isErr()) {
      return Result.err(new ApplicationError('DELETE_FAILED', deleteResult.error.message));
    }

    return Result.ok(contact.id);
  }
}
