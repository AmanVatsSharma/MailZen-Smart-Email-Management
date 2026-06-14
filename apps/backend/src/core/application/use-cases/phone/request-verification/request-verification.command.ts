/**
 * File:        apps/backend/src/core/application/use-cases/phone/request-verification/request-verification.command.ts
 * Module:      Phone Use Cases
 * Purpose:     Command for RequestVerification use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { RequestVerificationDto } from './request-verification.dto';

export class RequestVerificationCommand {
  constructor(public readonly input: RequestVerificationDto) {}
}
