/**
 * File:        apps/backend/src/core/application/use-cases/unified-inbox/mark-read/mark-read.dto.ts
 * Module:      Unified Inbox Use Cases
 * Purpose:     Data transfer object for MarkThreadRead use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

export interface MarkThreadReadDto {
  id: string;
  userId: string;
}
