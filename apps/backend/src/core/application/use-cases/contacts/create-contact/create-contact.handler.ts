/**
 * File:        apps/backend/src/core/application/use-cases/contacts/create-contact/create-contact.handler.ts
 * Module:      Contacts Use Cases
 * Purpose:     Create a new contact
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable, Inject } from '@nestjs/common';
import { CONTACT_REPOSITORY, IContactRepository } from '../../../ports/repositories/contact.repository';
import { Result } from '../../../../domain/shared/result';
import { ApplicationError } from '../../../exceptions/application-error';
import { Contact } from '../../../../domain/bounded-contexts/contacts/contact.aggregate';
import { CreateContactCommand } from './create-contact.command';

@Injectable()
export class CreateContactHandler {
  constructor(
    @Inject(CONTACT_REPOSITORY) private contactRepo: IContactRepository,
  ) {}

  async execute(command: CreateContactCommand): Promise<Result<Contact, ApplicationError>> {
    if (!command.input.email || !command.input.displayName) {
      return Result.err(new ApplicationError('INVALID_INPUT', 'Email and display name are required'));
    }

    const existing = await this.contactRepo.findByEmail(command.input.workspaceId, command.input.email.toLowerCase());
    if (existing) {
      return Result.err(new ApplicationError('CONFLICT', 'Contact with this email already exists'));
    }

    const contactResult = Contact.create({
      workspaceId: command.input.workspaceId,
      email: command.input.email,
      displayName: command.input.displayName,
      phone: command.input.phone,
      notes: command.input.notes,
      tags: command.input.tags || [],
    });

    if (contactResult.isErr()) {
      return Result.err(new ApplicationError('CREATE_FAILED', contactResult.error.message));
    }

    const save = await this.contactRepo.save(contactResult.value);
    if (save.isErr()) {
      return Result.err(new ApplicationError('SAVE_FAILED', save.error.message));
    }

    return Result.ok(contactResult.value);
  }
}
