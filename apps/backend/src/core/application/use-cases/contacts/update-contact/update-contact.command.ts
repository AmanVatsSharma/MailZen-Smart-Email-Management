/**
 * File:        apps/backend/src/core/application/use-cases/contacts/update-contact/update-contact.command.ts
 * Module:      Contacts Use Cases
 * Purpose:     Command for UpdateContact use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { UpdateContactDto } from './update-contact.dto';

export class UpdateContactCommand {
  constructor(public readonly input: UpdateContactDto) {}
}
