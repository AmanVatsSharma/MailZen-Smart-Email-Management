/**
 * File:        apps/backend/src/core/application/use-cases/messaging/update-filter/update-filter.dto.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     DTO for the UpdateFilter use case.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { EmailFilterRule } from '../../../../../domain/bounded-contexts/messaging/email-filter.specification';

export interface UpdateFilterInput {
  id: string;
  ownerUserId: string;
  name?: string;
  rules?: ReadonlyArray<EmailFilterRule>;
}

export interface UpdateFilterOutput {
  id: string;
  name: string;
  ruleCount: number;
}
