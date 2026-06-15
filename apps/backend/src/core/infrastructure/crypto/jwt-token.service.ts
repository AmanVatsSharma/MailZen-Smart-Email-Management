/**
 * File:        core/infrastructure/crypto/jwt-token.service.ts
 * Module:      Infrastructure - Crypto
 * Purpose:     Adapter implementing IJwtGateway with @nestjs/jwt
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { IJwtGateway, JwtPayload } from '../application/ports/gateways/jwt.gateway';

@Injectable()
export class JwtTokenService implements IJwtGateway {
  constructor(private readonly jwt: JwtService) {}

  async signAccessToken(payload: JwtPayload, ttl?: number): Promise<string> {
    return this.jwt.signAsync(payload, { expiresIn: ttl ?? '15m' });
  }

  async verifyAccessToken(token: string): Promise<JwtPayload> {
    return this.jwt.verifyAsync<JwtPayload>(token);
  }

  async signRefreshToken(): Promise<{ token: string; hash: string }> {
    const token = await this.jwt.signAsync({}, { expiresIn: '30d' });
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    return { token, hash };
  }

  async verifyRefreshToken(token: string): Promise<JwtPayload> {
    return this.jwt.verifyAsync<JwtPayload>(token);
  }
}
