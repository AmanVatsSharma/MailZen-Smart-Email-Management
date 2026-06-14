/**
 * File:        apps/backend/src/core/application/use-cases/contacts/list-contacts/list-contacts.command.ts
 * Module:      Contacts Use Cases
 * Purpose:     Command for ListContacts use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { ListContactsDto } from './list-contacts.dto';

export class ListContactsCommand {
  constructor(public readonly input: ListContactsDto) {}
}
