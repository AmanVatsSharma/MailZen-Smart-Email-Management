/**
 * File:        apps/backend/src/core/application/use-cases/messaging/list-filters/list-filters.dto.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     DTO for the ListFilters use case.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { EmailFilterRule } from '../../../../../domain/bounded-contexts/messaging/email-filter.specification';

export interface ListFiltersInput {
  ownerUserId: string;
}

export interface ListFiltersOutput {
  items: Array<{ id: string; name: string; rules: ReadonlyArray<EmailFilterRule> }>;
}
