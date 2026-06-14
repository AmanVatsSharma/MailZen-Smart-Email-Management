/**
 * File:        apps/backend/src/core/application/use-cases/contacts/delete-contact/delete-contact.command.ts
 * Module:      Contacts Use Cases
 * Purpose:     Command for DeleteContact use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { DeleteContactDto } from './delete-contact.dto';

export class DeleteContactCommand {
  constructor(public readonly input: DeleteContactDto) {}
}
