// apps/backend/src/core/infrastructure/crypto/argon2-hasher.ts
// Adapter: implements IPasswordHasher with argon2id (replace bcrypt for new code).

import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { IPasswordHasher } from '../application/ports/gateways/password-hasher.gateway';

@Injectable()
export class Argon2Hasher implements IPasswordHasher {
  async hash(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id });
  }
  async verify(plain: string, hash: string): Promise<boolean> {
    try { return await argon2.verify(hash, plain); } catch { return false; }
  }
}
