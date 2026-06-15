/**
 * File:        apps/backend/src/core/application/use-cases/contacts/update-contact/update-contact.handler.ts
 * Module:      Contacts Use Cases
 * Purpose:     Update a contact
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable, Inject } from '@nestjs/common';
import { CONTACT_REPOSITORY, IContactRepository } from '../../../ports/repositories/contact.repository';
import { Result } from '../../../../domain/shared/result';
import { ApplicationError } from '../../../exceptions/application-error';
import { UpdateContactCommand } from './update-contact.command';

@Injectable()
export class UpdateContactHandler {
  constructor(
    @Inject(CONTACT_REPOSITORY) private contactRepo: IContactRepository,
  ) {}

  async execute(command: UpdateContactCommand): Promise<Result<string, ApplicationError>> {
    const contact = await this.contactRepo.findById(command.input.contactId);
    if (!contact) {
      return Result.err(new ApplicationError('NOT_FOUND', 'Contact not found'));
    }

    const result = contact.update({
      displayName: command.input.displayName,
      phone: command.input.phone,
      notes: command.input.notes,
    });

    if (result.isErr()) {
      return Result.err(new ApplicationError('UPDATE_FAILED', result.error.message));
    }

    const save = await this.contactRepo.save(contact);
    if (save.isErr()) {
      return Result.err(new ApplicationError('SAVE_FAILED', save.error.message));
    }

    return Result.ok(contact.id);
  }
}
