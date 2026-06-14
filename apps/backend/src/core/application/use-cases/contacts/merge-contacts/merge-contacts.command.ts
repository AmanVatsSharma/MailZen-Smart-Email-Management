/**
 * File:        apps/backend/src/core/application/use-cases/contacts/merge-contacts/merge-contacts.command.ts
 * Module:      Contacts Use Cases
 * Purpose:     Command for MergeContacts use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { MergeContactsDto } from './merge-contacts.dto';

export class MergeContactsCommand {
  constructor(public readonly input: MergeContactsDto) {}
}
