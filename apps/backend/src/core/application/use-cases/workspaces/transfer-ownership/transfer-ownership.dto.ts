/**
 * File:        apps/backend/src/core/application/use-cases/workspaces/transfer-ownership/transfer-ownership.dto.ts
 * Module:      Workspaces Use Cases
 * Purpose:     Data transfer object for TransferOwnership use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

export interface TransferOwnershipDto {
  workspaceId: string;
  newOwnerUserId: string;
  actorUserId: string;
}
