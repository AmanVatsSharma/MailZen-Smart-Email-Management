/**
 * File:        apps/backend/src/core/application/ports/gateways/ai.gateway.ts
 * Module:      Application · Port
 * Purpose:     AI gateway port. Hides the underlying LLM provider
 *              (OpenAI, Azure, Anthropic, agent platform) behind a
 *              single interface used by AI use cases.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { TriagePriority, TriageCategory } from '../../../domain/bounded-contexts/ai/triage-result.aggregate';

export interface EmailSummary {
  id: string;
  subject: string;
  from: string;
  body: string;
}

export interface SmartReplySuggestionDto {
  text: string;
  score: number;
}

export interface SmartReplyContext {
  emailId: string;
  tone?: string;
  workspaceId: string;
  userId: string;
}

export interface TriageResultDto {
  priority: TriagePriority;
  category: TriageCategory;
  reasoning: string;
  suggestedActions: { type: string; description: string }[];
}

export interface SenderAnalysisDto {
  emailAddress: string;
  totalReceived: number;
  totalReplied: number;
  averageReplyTimeMs: number;
  openRate: number;
  clickRate: number;
  trustScore: number;
}

export interface IAiGateway {
  generateSmartReply(
    email: EmailSummary,
    context: SmartReplyContext,
  ): Promise<SmartReplySuggestionDto[]>;

  triageEmail(
    email: EmailSummary,
  ): Promise<TriageResultDto>;

  analyzeSender(
    senderEmail: string,
    history: SenderAnalysisDto,
  ): Promise<SenderAnalysisDto>;
}

export const AI_GATEWAY = Symbol('IAiGateway');
