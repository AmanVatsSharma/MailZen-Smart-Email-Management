/**
 * File:        apps/backend/src/core/application/use-cases/messaging/get-attachment/get-attachment.dto.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     DTO for the GetAttachment use case.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
export interface GetAttachmentInput {
  id: string;
}

export interface GetAttachmentOutput {
  id: string;
  emailId: string;
  filename: string;
  contentType: string;
  size: number;
  storageKey: string;
}
