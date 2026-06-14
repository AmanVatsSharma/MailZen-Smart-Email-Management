/**
 * File:        apps/backend/src/core/application/use-cases/messaging/create-filter/create-filter.dto.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     DTO for the CreateFilter use case.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { EmailFilterRule } from '../../../../../domain/bounded-contexts/messaging/email-filter.specification';

export interface CreateFilterInput {
  ownerUserId: string;
  name: string;
  rules: ReadonlyArray<EmailFilterRule>;
}

export interface CreateFilterOutput {
  id: string;
  name: string;
  ruleCount: number;
}
