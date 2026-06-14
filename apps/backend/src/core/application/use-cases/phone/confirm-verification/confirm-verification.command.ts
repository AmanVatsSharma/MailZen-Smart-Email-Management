/**
 * File:        apps/backend/src/core/application/use-cases/phone/confirm-verification/confirm-verification.command.ts
 * Module:      Phone Use Cases
 * Purpose:     Command for ConfirmVerification use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { ConfirmVerificationDto } from './confirm-verification.dto';

export class ConfirmVerificationCommand {
  constructor(public readonly input: ConfirmVerificationDto) {}
}
