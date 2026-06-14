/**
 * File:        apps/backend/src/core/application/use-cases/contacts/remove-tag/remove-tag.command.ts
 * Module:      Contacts Use Cases
 * Purpose:     Command for RemoveTag use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { RemoveTagDto } from './remove-tag.dto';

export class RemoveTagCommand {
  constructor(public readonly input: RemoveTagDto) {}
}
