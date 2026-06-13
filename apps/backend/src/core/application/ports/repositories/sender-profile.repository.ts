/**
 * File:        apps/backend/src/core/application/ports/repositories/sender-profile.repository.ts
 * Module:      Application · Port
 * Purpose:     SenderProfile repository port. Persistence operations
 *              for SenderProfile aggregates.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { SenderProfile } from '../../../domain/bounded-contexts/ai/sender-intelligence.aggregate';

export interface ISenderProfileRepository {
  findById(id: string): Promise<SenderProfile | null>;
  findByEmailAddress(emailAddress: string): Promise<SenderProfile | null>;
  findByUserId(userId: string): Promise<SenderProfile[]>;
  save(profile: SenderProfile): Promise<void>;
  delete(id: string): Promise<void>;
}

export const SENDER_PROFILE_REPOSITORY = Symbol('ISenderProfileRepository');
