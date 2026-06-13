/**
 * File:        core/application/ports/gateways/password-hasher.gateway.ts
 * Module:      Application - Identity Bounded Context
 * Purpose:     Password hasher port for secure password hashing
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

export const PASSWORD_HASHER = Symbol('IPasswordHasher');

export interface IPasswordHasher {
  hash(plain: string): Promise<string>;
  verify(plain: string, hash: string): Promise<boolean>;
}