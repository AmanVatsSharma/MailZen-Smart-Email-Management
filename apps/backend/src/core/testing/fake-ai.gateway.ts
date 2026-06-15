/**
 * File:        apps/backend/src/core/testing/fake-ai.gateway.ts
 * Module:      Testing · Fake
 * Purpose:     Fake IAiGateway for unit tests. Returns pre-configured
 *              canned responses; no LLM calls are made.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { IAiGateway, EmailSummary, SmartReplyContext, SmartReplySuggestionDto, TriageResultDto, SenderAnalysisDto } from 'application/ports/gateways/ai.gateway';
import { TriagePriority, TriageCategory } from '../domain/bounded-contexts/ai/triage-result.aggregate';

export class FakeAiGateway implements IAiGateway {
  private nextReplies: SmartReplySuggestionDto[] = [];
  private nextTriage: TriageResultDto | null = null;
  private nextAnalysis: SenderAnalysisDto | null = null;

  generateSmartReplyCallCount = 0;
  triageEmailCallCount = 0;
  analyzeSenderCallCount = 0;

  setNextReplySuggestions(suggestions: SmartReplySuggestionDto[]): void {
    this.nextReplies = suggestions;
  }

  setNextTriage(triage: TriageResultDto): void {
    this.nextTriage = triage;
  }

  setNextAnalysis(analysis: SenderAnalysisDto): void {
    this.nextAnalysis = analysis;
  }

  async generateSmartReply(
    email: EmailSummary,
    context: SmartReplyContext,
  ): Promise<SmartReplySuggestionDto[]> {
    this.generateSmartReplyCallCount++;
    return this.nextReplies;
  }

  async triageEmail(email: EmailSummary): Promise<TriageResultDto> {
    this.triageEmailCallCount++;
    return this.nextTriage ?? {
      priority: TriagePriority.NORMAL,
      category: TriageCategory.PERSONAL,
      reasoning: 'no triage configured',
      suggestedActions: [],
    };
  }

  async analyzeSender(
    senderEmail: string,
    history: SenderAnalysisDto,
  ): Promise<SenderAnalysisDto> {
    this.analyzeSenderCallCount++;
    return this.nextAnalysis ?? history;
  }

  reset(): void {
    this.nextReplies = [];
    this.nextTriage = null;
    this.nextAnalysis = null;
    this.generateSmartReplyCallCount = 0;
    this.triageEmailCallCount = 0;
    this.analyzeSenderCallCount = 0;
  }
}
