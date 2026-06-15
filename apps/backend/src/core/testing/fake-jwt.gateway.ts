/**
 * File:        core/testing/fake-jwt.gateway.ts
 * Module:      Testing
 * Purpose:     In-memory implementation of IJwtGateway for use case specs
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { IJwtGateway, JwtPayload } from 'application/ports/gateways/jwt.gateway';

export class FakeJwtGateway implements IJwtGateway {
  private counter = 0;
  private accessTokens: Map<string, JwtPayload> = new Map();
  private refreshTokens: Map<string, JwtPayload> = new Map();

  async signAccessToken(payload: JwtPayload, ttl?: number): Promise<string> {
    const token = `access_${++this.counter}_${payload.sub}`;
    this.accessTokens.set(token, payload);
    return token;
  }

  async verifyAccessToken(token: string): Promise<JwtPayload> {
    const payload = this.accessTokens.get(token);
    if (!payload) throw new Error('Invalid access token');
    return payload;
  }

  async signRefreshToken(): Promise<{ token: string; hash: string }> {
    const token = `refresh_${++this.counter}`;
    const hash = `hash_${this.counter}`;
    this.refreshTokens.set(token, { sub: '', email: '' });
    return { token, hash };
  }

  async verifyRefreshToken(token: string): Promise<JwtPayload> {
    const payload = this.refreshTokens.get(token);
    if (!payload) throw new Error('Invalid refresh token');
    return payload;
  }
}