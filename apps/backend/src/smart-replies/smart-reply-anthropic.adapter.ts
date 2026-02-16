import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import {
  SmartReplyProviderRequest,
  SmartReplySuggestionProvider,
} from './smart-reply-provider.interface';

type AnthropicMessagesResponse = {
  content?: Array<{
    type?: string;
    text?: string | null;
  }>;
};

@Injectable()
export class SmartReplyAnthropicAdapter implements SmartReplySuggestionProvider {
  private readonly logger = new Logger(SmartReplyAnthropicAdapter.name);
  readonly providerId = 'anthropic';

  private isEnabled(): boolean {
    return (process.env.SMART_REPLY_USE_ANTHROPIC || 'false').trim() === 'true';
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

  async generateSuggestions(
    input: SmartReplyProviderRequest,
  ): Promise<string[]> {
    if (!this.isEnabled()) return [];

    const apiKey = String(
      process.env.SMART_REPLY_ANTHROPIC_API_KEY || '',
    ).trim();
    if (!apiKey) {
      this.logger.warn(
        'smart-reply-anthropic-adapter: missing SMART_REPLY_ANTHROPIC_API_KEY; skipping provider',
      );
      return [];
    }

    const baseUrl =
      process.env.SMART_REPLY_ANTHROPIC_BASE_URL ||
      'https://api.anthropic.com/v1';
    const model =
      process.env.SMART_REPLY_ANTHROPIC_MODEL || 'claude-3-5-haiku-latest';
    const timeoutMs = Number(
      process.env.SMART_REPLY_ANTHROPIC_TIMEOUT_MS || 4500,
    );
    const maxTokens = Number(
      process.env.SMART_REPLY_ANTHROPIC_MAX_TOKENS || 320,
    );
    const endpoint = `${baseUrl.replace(/\/+$/, '')}/messages`;

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
      const response = await axios.post<AnthropicMessagesResponse>(
        endpoint,
        {
          model,
          temperature: 0.4,
          max_tokens:
            Number.isFinite(maxTokens) && maxTokens > 0
              ? Math.trunc(maxTokens)
              : 320,
          system:
            'You are a business email assistant. Return concise, practical reply suggestions.',
          messages: [
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
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
        },
      );
      const rawContent = String(
        response.data?.content
          ?.map((block) =>
            block?.type === 'text' ? String(block.text || '') : '',
          )
          .join('\n') || '',
      ).trim();
      if (!rawContent) return [];
      const suggestions = this.extractJsonArray(rawContent).slice(
        0,
        input.count,
      );
      this.logger.debug(
        `smart-reply-anthropic-adapter: received ${suggestions.length} suggestions`,
      );
      return suggestions;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `smart-reply-anthropic-adapter: request failed, fallback enabled message=${message}`,
      );
      return [];
    }
  }
}
