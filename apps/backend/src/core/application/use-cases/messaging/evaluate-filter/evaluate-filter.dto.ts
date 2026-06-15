/**
 * File:        apps/backend/src/core/application/use-cases/messaging/evaluate-filter/evaluate-filter.dto.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     DTO for the EvaluateFilter use case. Applies a filter spec to
 *              an email and returns matching + action.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { FilterAction } from '../../../../domain/bounded-contexts/messaging/email-filter.specification';

export interface EvaluateFilterInput {
  filterId: string;
  emailId: string;
}

export interface EvaluateFilterOutput {
  matches: boolean;
  action: FilterAction | null;
  actionValue: string | null;
}
