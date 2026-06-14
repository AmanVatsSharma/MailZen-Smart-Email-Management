/**
 * File:        core/application/use-cases/identity/logout/logout.dto.ts
 * Module:      Application - Identity Bounded Context
 * Purpose:     Logout use case DTOs
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

export interface LogoutInput {
  refreshToken?: string;
}

export interface LogoutOutput {
  success: boolean;
}