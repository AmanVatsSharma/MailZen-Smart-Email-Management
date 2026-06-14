/**
 * File:        apps/backend/src/core/application/use-cases/contacts/add-tag/add-tag.command.ts
 * Module:      Contacts Use Cases
 * Purpose:     Command for AddTag use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { AddTagDto } from './add-tag.dto';

export class AddTagCommand {
  constructor(public readonly input: AddTagDto) {}
}
