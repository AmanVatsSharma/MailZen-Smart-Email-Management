/**
 * File:        apps/backend/src/core/application/ports/gateways/ai-credit-burner.gateway.ts
 * Module:      Application Ports
 * Purpose:     Port for AI credit consumption tracking
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { Result } from '../../../domain/shared/result';

export const AI_CREDIT_BURNER = Symbol('IAiCreditBurner');

export interface AiCreditBurnInput {
  userId: string;
  amount: number;
  requestId?: string;
  operation: string;
  metadata?: Record<string, unknown>;
}

export interface AiCreditBurnResult {
  allowed: boolean;
  usedCredits: number;
  monthlyLimit: number;
  remainingCredits: number;
  periodStart: string;
}

export interface AiCreditBurner {
  consumeCredits(input: AiCreditBurnInput): Promise<Result<AiCreditBurnResult, Error>>;
  getBalance(userId: string): Promise<Result<AiCreditBurnResult, Error>>;
  refundCredits(input: { userId: string; amount: number; requestId?: string }): Promise<Result<AiCreditBurnResult, Error>>;
}