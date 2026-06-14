/**
 * File:        apps/backend/src/core/application/use-cases/messaging/delete-filter/delete-filter.dto.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     DTO for the DeleteFilter use case.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
export interface DeleteFilterInput {
  id: string;
  ownerUserId: string;
}

export interface DeleteFilterOutput {
  deleted: boolean;
}
