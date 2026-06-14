/**
 * File:        apps/backend/src/core/application/use-cases/phone/request-verification/request-verification.dto.ts
 * Module:      Phone Use Cases
 * Purpose:     Data transfer object for RequestVerification use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

export interface RequestVerificationDto {
  userId: string;
  phoneE164: string;
}
