/**
 * File:        apps/backend/src/core/application/use-cases/phone/confirm-verification/confirm-verification.dto.ts
 * Module:      Phone Use Cases
 * Purpose:     Data transfer object for ConfirmVerification use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

export interface ConfirmVerificationDto {
  phoneE164: string;
  code: string;
}
