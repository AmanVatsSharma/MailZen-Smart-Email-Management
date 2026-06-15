/**
 * File:        apps/backend/src/core/testing/in-memory-smart-reply.repository.ts
 * Module:      Testing · Fake
 * Purpose:     In-memory SmartReply repository for unit tests.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { ISmartReplyRepository } from '../application/ports/repositories/smart-reply.repository';
import { SmartReply } from '../domain/bounded-contexts/ai/smart-reply.aggregate';

export class InMemorySmartReplyRepository implements ISmartReplyRepository {
  private replies: Map<string, SmartReply> = new Map();

  async findById(id: string): Promise<SmartReply | null> {
    return this.replies.get(id) ?? null;
  }

  async findByEmailId(emailId: string): Promise<SmartReply[]> {
    return Array.from(this.replies.values()).filter((r) => r.emailId === emailId);
  }

  async findByUserId(userId: string, limit?: number): Promise<SmartReply[]> {
    const all = Array.from(this.replies.values()).filter((r) => r.userId === userId);
    return limit ? all.slice(0, limit) : all;
  }

  async save(reply: SmartReply): Promise<void> {
    this.replies.set(reply.id, reply);
  }

  async delete(id: string): Promise<void> {
    this.replies.delete(id);
  }

  reset(): void {
    this.replies.clear();
  }
}
