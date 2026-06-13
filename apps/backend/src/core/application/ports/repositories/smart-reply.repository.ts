/**
 * File:        apps/backend/src/core/application/ports/repositories/smart-reply.repository.ts
 * Module:      Application · Port
 * Purpose:     SmartReply repository port. Persistence operations
 *              for SmartReply aggregates.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { SmartReply } from '../../../domain/bounded-contexts/ai/smart-reply.aggregate';

export interface ISmartReplyRepository {
  findById(id: string): Promise<SmartReply | null>;
  findByEmailId(emailId: string): Promise<SmartReply[]>;
  findByUserId(userId: string, limit?: number): Promise<SmartReply[]>;
  save(reply: SmartReply): Promise<void>;
  delete(id: string): Promise<void>;
}

export const SMART_REPLY_REPOSITORY = Symbol('ISmartReplyRepository');
