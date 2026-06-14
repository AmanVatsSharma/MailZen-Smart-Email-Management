/**
 * File:        apps/backend/src/core/application/use-cases/organization/delete-label/delete-label.command.ts
 * Module:      Organization Use Cases
 * Purpose:     Command for DeleteLabel use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { DeleteLabelDto } from './delete-label.dto';

export class DeleteLabelCommand {
  constructor(public readonly input: DeleteLabelDto) {}
}
