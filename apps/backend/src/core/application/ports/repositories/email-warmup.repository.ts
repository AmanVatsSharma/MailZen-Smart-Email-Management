/**
 * File:        apps/backend/src/core/application/ports/repositories/email-warmup.repository.ts
 * Module:      Core · Application · Ports
 * Purpose:     IEmailWarmupRepository port.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { EmailWarmup } from '../../../domain/bounded-contexts/messaging/warmup.aggregate';

export const EMAIL_WARMUP_REPOSITORY = Symbol('IEmailWarmupRepository');

export interface IEmailWarmupRepository {
  save(warmup: EmailWarmup): Promise<void>;
  findById(id: string): Promise<EmailWarmup | null>;
  findByProviderId(providerId: string): Promise<EmailWarmup | null>;
  listActive(): Promise<EmailWarmup[]>;
  delete(id: string): Promise<void>;
}
