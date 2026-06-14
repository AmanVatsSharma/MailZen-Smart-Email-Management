/**
 * File:        core/application/use-cases/identity/get-current-user/get-current-user.dto.ts
 * Module:      Application - Identity Bounded Context
 * Purpose:     Get current user use case DTOs
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { UserId } from '../../../../domain/shared/value-objects/ids';

export interface GetCurrentUserInput {
  userId: UserId | string;
}

export interface GetCurrentUserOutput {
  id: string;
  email: string;
  role: string;
  isEmailVerified: boolean;
  is2faEnabled: boolean;
}