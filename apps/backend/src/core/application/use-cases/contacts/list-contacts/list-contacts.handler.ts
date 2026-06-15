/**
 * File:        apps/backend/src/core/application/use-cases/contacts/list-contacts/list-contacts.handler.ts
 * Module:      Contacts Use Cases
 * Purpose:     List contacts in a workspace
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable, Inject } from '@nestjs/common';
import { CONTACT_REPOSITORY, IContactRepository } from '../../../ports/repositories/contact.repository';
import { Result } from '../../../../domain/shared/result';
import { ApplicationError } from '../../../exceptions/application-error';
import { Contact } from '../../../../domain/bounded-contexts/contacts/contact.aggregate';
import { ListContactsCommand } from './list-contacts.command';

@Injectable()
export class ListContactsHandler {
  constructor(
    @Inject(CONTACT_REPOSITORY) private contactRepo: IContactRepository,
  ) {}

  async execute(command: ListContactsCommand): Promise<Result<{ items: Contact[]; total: number }, ApplicationError>> {
    const result = await this.contactRepo.query({
      workspaceId: command.input.workspaceId,
      tag: command.input.tag,
      searchTerm: command.input.searchTerm,
      limit: command.input.limit,
      offset: command.input.offset,
    });
    return Result.ok(result);
  }
}
