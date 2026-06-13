/**
 * File:        core/application/ports/gateways/jwt.gateway.ts
 * Module:      Application - Identity Bounded Context
 * Purpose:     JWT gateway port for token signing and verification
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

export const JWT_GATEWAY = Symbol('IJwtGateway');

export interface JwtPayload {
  sub: string;
  email: string;
  role?: string;
  [key: string]: unknown;
}

export interface IJwtGateway {
  signAccessToken(payload: JwtPayload, ttl?: number): Promise<string>;
  verifyAccessToken(token: string): Promise<JwtPayload>;
  signRefreshToken(): Promise<{ token: string; hash: string }>;
  verifyRefreshToken(token: string): Promise<JwtPayload>;
}