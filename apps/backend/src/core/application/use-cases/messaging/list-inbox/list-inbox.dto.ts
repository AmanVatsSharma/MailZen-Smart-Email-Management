/**
 * File:        apps/backend/src/core/application/use-cases/messaging/list-inbox/list-inbox.dto.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     DTOs for the ListInbox use case.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { EmailStatus } from '../../../../domain/bounded-contexts/messaging/email.aggregate';

export interface ListInboxInput {
  workspaceId: string;
  limit: number;
  offset: number;
  status?: EmailStatus;
  threadId?: string;
}

export interface ListInboxOutput {
  items: Array<{ id: string; subject: string; status: EmailStatus; threadId: string | null }>;
  total: number;
}
