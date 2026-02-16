import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import {
  SmartReplyProviderRequest,
  SmartReplySuggestionProvider,
} from './smart-reply-provider.interface';

type AzureOpenAiChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    } | null;
  } | null>;
};

@Injectable()
export class SmartReplyAzureOpenAiAdapter implements SmartReplySuggestionProvider {
  private readonly logger = new Logger(SmartReplyAzureOpenAiAdapter.name);
  readonly providerId = 'azure-openai';

  private isEnabled(): boolean {
    return (
      (process.env.SMART_REPLY_USE_AZURE_OPENAI || 'false').trim() === 'true'
    );
  }

  private extractJsonArray(rawContent: string): string[] {
    const normalized = String(rawContent || '').trim();
    if (!normalized) return [];
    const jsonMatch = normalized.match(/\[[\s\S]*\]/);
    const candidate = jsonMatch ? jsonMatch[0] : normalized;
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.map((entry) => String(entry || '').trim()).filter(Boolean);
    } catch {
      return normalized
        .split('\n')
        .map((line) => line.replace(/^\d+[).\s-]*/, '').trim())
        .filter(Boolean);
    }
  }

  private resolveEndpoint(): string | null {
    const endpoint = String(
      process.env.SMART_REPLY_AZURE_OPENAI_ENDPOINT || '',
    ).trim();
    const deployment = String(
      process.env.SMART_REPLY_AZURE_OPENAI_DEPLOYMENT || '',
    ).trim();
    const apiVersion = String(
      process.env.SMART_REPLY_AZURE_OPENAI_API_VERSION || '2024-08-01-preview',
    ).trim();
    if (!endpoint || !deployment) return null;
    const normalizedBase = endpoint.replace(/\/+$/, '');
    return `${normalizedBase}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;
  }

  async generateSuggestions(
    input: SmartReplyProviderRequest,
  ): Promise<string[]> {
    if (!this.isEnabled()) return [];

    const apiKey = String(
      process.env.SMART_REPLY_AZURE_OPENAI_API_KEY || '',
    ).trim();
    if (!apiKey) {
      this.logger.warn(
        'smart-reply-azure-openai-adapter: missing SMART_REPLY_AZURE_OPENAI_API_KEY; skipping provider',
      );
      return [];
    }
    const endpoint = this.resolveEndpoint();
    if (!endpoint) {
      this.logger.warn(
        'smart-reply-azure-openai-adapter: endpoint/deployment env missing; skipping provider',
      );
      return [];
    }

    const timeoutMs = Number(
      process.env.SMART_REPLY_AZURE_OPENAI_TIMEOUT_MS || 4500,
    );
    const userPrompt = [
      `Draft ${input.count} business email reply suggestions.`,
      `Tone=${input.tone}, length=${input.length}, includeSignature=${input.includeSignature}.`,
      input.customInstructions
        ? `Custom instructions: ${input.customInstructions}`
        : null,
      `Conversation: ${input.conversation}`,
      'Output strictly as a JSON array of strings. No markdown and no numbering.',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const response = await axios.post<AzureOpenAiChatCompletionResponse>(
        endpoint,
        {
          temperature: 0.4,
          messages: [
            {
              role: 'system',
              content:
                'You are a business email assistant. Return concise, practical reply suggestions.',
            },
            {
              role: 'user',
              content: userPrompt,
            },
          ],
        },
        {
          timeout: Number.isFinite(timeoutMs)
            ? Math.max(timeoutMs, 1000)
            : 4500,
          headers: {
            'api-key': apiKey,
            'content-type': 'application/json',
          },
        },
      );
      const rawContent = String(
        response.data?.choices?.[0]?.message?.content || '',
      ).trim();
      if (!rawContent) return [];
      const suggestions = this.extractJsonArray(rawContent).slice(
        0,
        input.count,
      );
      this.logger.debug(
        `smart-reply-azure-openai-adapter: received ${suggestions.length} suggestions`,
      );
      return suggestions;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `smart-reply-azure-openai-adapter: request failed, fallback enabled message=${message}`,
      );
      return [];
    }
  }
}
