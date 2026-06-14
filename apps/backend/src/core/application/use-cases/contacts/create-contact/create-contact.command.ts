/**
 * File:        apps/backend/src/core/application/use-cases/contacts/create-contact/create-contact.command.ts
 * Module:      Contacts Use Cases
 * Purpose:     Command for CreateContact use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { CreateContactDto } from './create-contact.dto';

export class CreateContactCommand {
  constructor(public readonly input: CreateContactDto) {}
}
