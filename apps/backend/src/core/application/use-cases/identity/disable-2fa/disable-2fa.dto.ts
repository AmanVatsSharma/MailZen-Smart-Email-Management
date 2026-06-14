/**
 * File:        core/application/use-cases/identity/disable-2fa/disable-2fa.dto.ts
 * Module:      Application - Identity Bounded Context
 * Purpose:     Disable 2FA use case DTOs
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { UserId } from '../../../../domain/shared/value-objects/ids';

export interface Disable2faInput {
  userId: UserId | string;
}

export interface Disable2faOutput {
  userId: string;
  enabled: boolean;
}