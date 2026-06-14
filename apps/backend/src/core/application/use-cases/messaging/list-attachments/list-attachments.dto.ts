/**
 * File:        apps/backend/src/core/application/use-cases/messaging/list-attachments/list-attachments.dto.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     DTO for the ListAttachments use case.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
export interface ListAttachmentsInput {
  emailId: string;
}

export interface ListAttachmentsOutput {
  items: Array<{
    id: string;
    filename: string;
    contentType: string;
    size: number;
    storageKey: string;
  }>;
}
