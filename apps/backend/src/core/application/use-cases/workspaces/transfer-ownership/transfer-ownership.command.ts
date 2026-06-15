/**
 * File:        apps/backend/src/core/application/use-cases/workspaces/transfer-ownership/transfer-ownership.command.ts
 * Module:      Workspaces Use Cases
 * Purpose:     Command for TransferOwnership use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { TransferOwnershipDto } from './transfer-ownership.dto';

export class TransferOwnershipCommand {
  constructor(public readonly input: TransferOwnershipDto) {}
}
