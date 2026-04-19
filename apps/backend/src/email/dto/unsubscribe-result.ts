/**
 * File:        apps/backend/src/email/dto/unsubscribe-result.ts
 * Module:      Email · Unsubscribe · Response DTO
 * Purpose:     GraphQL ObjectType returned by the unsubscribeFromSender mutation,
 *              confirming the suppressed address and operation success.
 *
 * Exports:
 *   - UnsubscribeResult  — ObjectType({ success: boolean, senderEmail: string })
 *
 * Depends on:
 *   - none
 *
 * Side-effects:
 *   - none
 *
 * Key invariants:
 *   - none
 *
 * Read order:
 *   1. UnsubscribeResult  — sole exported class
 *
 * Author:      AmanVatsSharma
 * Last-updated: 2026-04-20
 */

import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class UnsubscribeResult {
  @Field()
  success: boolean;

  @Field()
  senderEmail: string;
}
