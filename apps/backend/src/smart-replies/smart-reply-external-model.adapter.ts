import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

type ExternalSuggestionRequest = {
  conversation: string;
  count: number;
  tone: string;
  length: string;
};

@Injectable()
export class SmartReplyExternalModelAdapter {
  private readonly logger = new Logger(SmartReplyExternalModelAdapter.name);

  private isExternalProviderEnabled(): boolean {
    return (
      (process.env.SMART_REPLY_USE_AGENT_PLATFORM || 'false').trim() === 'true'
    );
  }

  async generateSuggestions(
    input: ExternalSuggestionRequest,
  ): Promise<string[]> {
    if (!this.isExternalProviderEnabled()) {
      return [];
    }

    const platformUrl =
      process.env.AI_AGENT_PLATFORM_URL || 'http://localhost:8100';
    const endpoint = `${platformUrl}/v1/agent/respond`;
    const timeoutMs = Number(
      process.env.SMART_REPLY_EXTERNAL_TIMEOUT_MS || 3000,
    );

    const payload = {
      version: 'v1',
      skill: 'inbox',
      requestId: `smart-reply-${Date.now()}`,
      messages: [
        {
          role: 'user',
          content: `Generate ${input.count} ${input.tone} ${input.length} email reply suggestions:\n${input.conversation}`,
        },
      ],
      context: {
        surface: 'smart-replies',
        locale: 'en-IN',
        email: null,
        metadata: {},
      },
      allowedActions: [],
      requestedAction: null,
      requestedActionPayload: {},
    };

    try {
      const response = await axios.post<{
        assistantText?: string;
      }>(endpoint, payload, {
        timeout: timeoutMs,
        headers: {
          ...(process.env.AI_AGENT_PLATFORM_KEY
            ? { 'x-agent-platform-key': process.env.AI_AGENT_PLATFORM_KEY }
            : {}),
        },
      });

      const assistantText = String(response.data?.assistantText || '').trim();
      if (!assistantText) return [];

      const suggestions = assistantText
        .split('\n')
        .map((line) => line.replace(/^\d+[).\s-]*/, '').trim())
        .filter(Boolean)
        .slice(0, input.count);

      this.logger.debug(
        `smart-reply-external-adapter: received ${suggestions.length} suggestions`,
      );
      return suggestions;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `smart-reply-external-adapter: external provider failed, fallback enabled message=${message}`,
      );
      return [];
    }
  }
}
