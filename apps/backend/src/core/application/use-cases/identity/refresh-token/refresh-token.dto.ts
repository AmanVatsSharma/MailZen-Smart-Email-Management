/**
 * File:        core/application/use-cases/identity/refresh-token/refresh-token.dto.ts
 * Module:      Application - Identity Bounded Context
 * Purpose:     Refresh token use case DTOs
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

export interface RefreshTokenInput {
  refreshToken: string;
  ip?: string;
  userAgent?: string;
}

export interface RefreshTokenOutput {
  accessToken: string;
  refreshToken: string;
  userId: string;
}