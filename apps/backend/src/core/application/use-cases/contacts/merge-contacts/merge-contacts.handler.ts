/**
 * File:        apps/backend/src/core/application/use-cases/contacts/merge-contacts/merge-contacts.handler.ts
 * Module:      Contacts Use Cases
 * Purpose:     Merge two contacts into one
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable, Inject } from '@nestjs/common';
import { CONTACT_REPOSITORY, IContactRepository } from '../../../ports/repositories/contact.repository';
import { Result } from '../../../../domain/shared/result';
import { ApplicationError } from '../../../exceptions/application-error';
import { MergeContactsCommand } from './merge-contacts.command';

@Injectable()
export class MergeContactsHandler {
  constructor(
    @Inject(CONTACT_REPOSITORY) private contactRepo: IContactRepository,
  ) {}

  async execute(command: MergeContactsCommand): Promise<Result<string, ApplicationError>> {
    if (command.input.primaryContactId === command.input.duplicateContactId) {
      return Result.err(new ApplicationError('INVALID_INPUT', 'Cannot merge a contact with itself'));
    }

    const primary = await this.contactRepo.findById(command.input.primaryContactId);
    const duplicate = await this.contactRepo.findById(command.input.duplicateContactId);

    if (!primary || !duplicate) {
      return Result.err(new ApplicationError('NOT_FOUND', 'One or both contacts not found'));
    }

    if (primary.workspaceId !== duplicate.workspaceId) {
      return Result.err(new ApplicationError('FORBIDDEN', 'Contacts belong to different workspaces'));
    }

    const mergedTags = [...new Set([...primary.tags, ...duplicate.tags])];
    const mergedNotes = [primary.notes, duplicate.notes].filter(Boolean).join('\n---\n');
    const phone = primary.phone || duplicate.phone;

    const updateResult = primary.update({
      phone,
      notes: mergedNotes,
    });
    if (updateResult.isErr()) {
      return Result.err(new ApplicationError('MERGE_FAILED', updateResult.error.message));
    }

    for (const tag of mergedTags) {
      if (!primary.hasTag(tag)) {
        const tagResult = primary.addTag(tag);
        if (tagResult.isErr()) {
          return Result.err(new ApplicationError('MERGE_FAILED', tagResult.error.message));
        }
      }
    }

    const save = await this.contactRepo.save(primary);
    if (save.isErr()) {
      return Result.err(new ApplicationError('SAVE_FAILED', save.error.message));
    }

    const del = await this.contactRepo.delete(duplicate.id);
    if (del.isErr()) {
      return Result.err(new ApplicationError('DELETE_FAILED', del.error.message));
    }

    return Result.ok(primary.id);
  }
}
