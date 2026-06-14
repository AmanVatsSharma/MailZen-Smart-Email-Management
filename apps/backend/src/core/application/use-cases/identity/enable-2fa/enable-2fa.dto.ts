/**
 * File:        core/application/use-cases/identity/enable-2fa/enable-2fa.dto.ts
 * Module:      Application - Identity Bounded Context
 * Purpose:     Enable 2FA use case DTOs
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { UserId } from '../../../../domain/shared/value-objects/ids';

export interface Enable2faInput {
  userId: UserId | string;
}

export interface Enable2faOutput {
  userId: string;
  enabled: boolean;
}