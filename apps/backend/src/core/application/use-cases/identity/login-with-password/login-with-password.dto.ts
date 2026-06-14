/**
 * File:        core/application/use-cases/identity/login-with-password/login-with-password.dto.ts
 * Module:      Application - Identity Bounded Context
 * Purpose:     Login with password use case DTOs
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

export interface LoginWithPasswordInput {
  email: string;
  password: string;
  ip?: string;
  userAgent?: string;
}

export interface LoginWithPasswordOutput {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    role?: string;
  };
}