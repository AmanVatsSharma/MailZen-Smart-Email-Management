import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import {
  SmartReplyProviderRequest,
  SmartReplySuggestionProvider,
} from './smart-reply-provider.interface';
import { serializeStructuredLog } from '../common/logging/structured-log.util';

type OpenAiChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    } | null;
  } | null>;
};

@Injectable()
export class SmartReplyOpenAiAdapter implements SmartReplySuggestionProvider {
  private readonly logger = new Logger(SmartReplyOpenAiAdapter.name);
  readonly providerId = 'openai';

  private isEnabled(): boolean {
    return (process.env.SMART_REPLY_USE_OPENAI || 'false').trim() === 'true';
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

  private resolveTemperature(creativityLevel?: number | null): number {
    if (typeof creativityLevel !== 'number' || !Number.isFinite(creativityLevel)) {
      return 0.4;
    }
    return Math.max(0, Math.min(1, creativityLevel / 100));
  }

  private resolveSystemPrompt(personalization?: number | null): string {
    const level = typeof personalization === 'number' && Number.isFinite(personalization)
      ? Math.max(0, Math.min(100, personalization))
      : 75;
    if (level >= 80) {
      return 'You are a business email assistant. Match the user\'s personal voice and writing style closely — be warm, natural, and true to how they typically express themselves. Return concise, practical reply suggestions.';
    }
    if (level >= 50) {
      return 'You are a business email assistant. Balance a professional tone with a natural, human touch. Return concise, practical reply suggestions.';
    }
    return 'You are a business email assistant. Use a clear, generic professional tone that is universally appropriate. Return concise, practical reply suggestions.';
  }

  async generateSuggestions(
    input: SmartReplyProviderRequest,
  ): Promise<string[]> {
    if (!this.isEnabled()) return [];

    const apiKey = String(process.env.SMART_REPLY_OPENAI_API_KEY || '').trim();
    if (!apiKey) {
      this.logger.warn(
        serializeStructuredLog({
          event: 'smart_reply_openai_skipped_missing_api_key',
        }),
      );
      return [];
    }

    const baseUrl =
      process.env.SMART_REPLY_OPENAI_BASE_URL || 'https://api.openai.com/v1';
    const model = input.modelOverride?.trim() || process.env.SMART_REPLY_OPENAI_MODEL || 'gpt-4o-mini';
    const timeoutMs = Number(process.env.SMART_REPLY_OPENAI_TIMEOUT_MS || 4500);
    const temperature = this.resolveTemperature(input.creativityLevel);
    const systemPrompt = this.resolveSystemPrompt(input.personalization);

    const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const userPrompt = [
      `Draft ${input.count} business email reply suggestions.`,
      `Tone=${input.tone}, length=${input.length}, includeSignature=${input.includeSignature}.`,
      input.customInstructions
        ? `Custom instructions: ${input.customInstructions}`
        : null,
      `Conversation:\n${input.conversation}`,
      'Output strictly as a JSON array of strings. No markdown and no numbering.',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const response = await axios.post<OpenAiChatCompletionResponse>(
        endpoint,
        {
          model,
          temperature,
          messages: [
            {
              role: 'system',
              content: systemPrompt,
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
            authorization: `Bearer ${apiKey}`,
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
        serializeStructuredLog({
          event: 'smart_reply_openai_completed',
          suggestions: suggestions.length,
        }),
      );
      return suggestions;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        serializeStructuredLog({
          event: 'smart_reply_openai_failed_fallback',
          error: message,
        }),
      );
      return [];
    }
  }
}
