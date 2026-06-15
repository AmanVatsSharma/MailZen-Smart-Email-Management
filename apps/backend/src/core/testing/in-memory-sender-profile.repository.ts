/**
 * File:        apps/backend/src/core/testing/in-memory-sender-profile.repository.ts
 * Module:      Testing · Fake
 * Purpose:     In-memory SenderProfile repository for unit tests.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { ISenderProfileRepository } from '../application/ports/repositories/sender-profile.repository';
import { SenderProfile } from '../domain/bounded-contexts/ai/sender-intelligence.aggregate';

export class InMemorySenderProfileRepository implements ISenderProfileRepository {
  private profiles: Map<string, SenderProfile> = new Map();

  async findById(id: string): Promise<SenderProfile | null> {
    return this.profiles.get(id) ?? null;
  }

  async findByEmailAddress(emailAddress: string): Promise<SenderProfile | null> {
    return Array.from(this.profiles.values())
      .find((p) => p.emailAddress === emailAddress) ?? null;
  }

  async findByUserId(userId: string): Promise<SenderProfile[]> {
    return Array.from(this.profiles.values()).filter((p) => p.workspaceId === userId);
  }

  async save(profile: SenderProfile): Promise<void> {
    this.profiles.set(profile.id, profile);
  }

  async delete(id: string): Promise<void> {
    this.profiles.delete(id);
  }

  reset(): void {
    this.profiles.clear();
  }
}
