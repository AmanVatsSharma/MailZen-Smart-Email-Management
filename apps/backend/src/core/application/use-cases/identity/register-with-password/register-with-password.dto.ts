/**
 * File:        core/application/use-cases/identity/register-with-password/register-with-password.dto.ts
 * Module:      Application - Identity Bounded Context
 * Purpose:     Register with password use case DTOs
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

export interface RegisterWithPasswordInput {
  email: string;
  password: string;
  name?: string;
  ip?: string;
  userAgent?: string;
}

export interface RegisterWithPasswordOutput {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    role?: string;
  };
}