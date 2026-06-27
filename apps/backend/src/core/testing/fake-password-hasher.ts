/**
 * File:        core/testing/fake-password-hasher.ts
 * Module:      Testing
 * Purpose:     In-memory implementation of IPasswordHasher for use case specs
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { IPasswordHasher } from '../application/ports/gateways/password-hasher.gateway';

export class FakePasswordHasher implements IPasswordHasher {
  private hashes: Map<string, string> = new Map();

  async hash(plain: string): Promise<string> {
    const hash = `$2a$12$${plain}_hashed`;
    this.hashes.set(plain, hash);
    return hash;
  }

  async verify(plain: string, hash: string): Promise<boolean> {
    return this.hashes.get(plain) === hash;
  }

  // Test helper - preset a known hash
  presetHash(plain: string, hash: string): void {
    this.hashes.set(plain, hash);
  }
}