// apps/backend/src/core/infrastructure/external-services/ai/http-ai.gateway.ts
// Adapter: implements IAiGateway by calling the AI agent gateway over HTTP.

import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { IAiGateway, SmartReplySuggestion, TriageResult, SenderAnalysis } from '../../../application/ports/gateways/ai.gateway';

@Injectable()
export class HttpAiGateway implements IAiGateway {
  private readonly logger = new Logger(HttpAiGateway.name);

  constructor(private readonly http: HttpService) {}

  async generateSmartReply(email: { subject: string; bodyText: string; from: string }, context: { tone?: string }): Promise<SmartReplySuggestion[]> {
    const res = await firstValueFrom(
      this.http.post<{ suggestions: SmartReplySuggestion[] }>(`/ai/smart-reply`, { email, context }),
    );
    return res.data.suggestions;
  }

  async triageEmail(email: { subject: string; bodyText: string; from: string }): Promise<TriageResult> {
    const res = await firstValueFrom(
      this.http.post<TriageResult>(`/ai/triage`, { email }),
    );
    return res.data;
  }

  async analyzeSender(senderEmail: string, history: unknown[]): Promise<SenderAnalysis> {
    const res = await firstValueFrom(
      this.http.post<SenderAnalysis>(`/ai/sender-analysis`, { senderEmail, history }),
    );
    return res.data;
  }
}
