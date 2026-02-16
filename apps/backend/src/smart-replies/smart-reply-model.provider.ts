import { Injectable, Logger } from '@nestjs/common';
import {
  SmartReplyProviderRequest,
  SmartReplySuggestionProvider,
} from './smart-reply-provider.interface';

export type SmartReplyTone = 'professional' | 'friendly' | 'concise' | 'formal';
export type SmartReplyLength = 'short' | 'medium' | 'long';

@Injectable()
export class SmartReplyModelProvider implements SmartReplySuggestionProvider {
  private readonly logger = new Logger(SmartReplyModelProvider.name);
  readonly providerId = 'template';

  private readonly intentTemplates: Record<string, string[]> = {
    scheduling: [
      'Thanks for the update. I am available and can confirm the schedule shortly.',
      'I appreciate the note. Let us align on a meeting slot and finalize this.',
      'Got it. I can join and will confirm the exact timing in a moment.',
    ],
    status_update: [
      'Thank you for checking in. I am reviewing this and will share a detailed update soon.',
      'Appreciate the follow-up. I will review the current status and respond shortly.',
      'Thanks for the reminder. I am on it and will revert with next steps.',
    ],
    issue: [
      'Thank you for flagging this. I am investigating the issue and will follow up with a resolution.',
      'I appreciate you sharing this. I will look into it immediately and update you soon.',
      'Understood. I am reviewing the problem now and will send a fix plan shortly.',
    ],
    gratitude: [
      'Thank you for the update. I appreciate it and will proceed accordingly.',
      'Many thanks for sharing this. I will take it forward from here.',
      'Appreciate the note. I will continue with the next steps.',
    ],
    generic: [
      'Thank you for your email. I am reviewing it and will get back to you shortly.',
      'I appreciate your message. I will review the details and respond soon.',
      'Thanks for reaching out. I will follow up with a complete response shortly.',
    ],
  };

  generateSuggestions(input: SmartReplyProviderRequest): string[] {
    const normalizedConversation = input.conversation.trim();
    if (!normalizedConversation) return [];

    const tone = this.normalizeTone(input.tone);
    const length = this.normalizeLength(input.length);
    const intent = this.detectIntent(normalizedConversation);
    const templates = this.intentTemplates[intent];
    const deterministicSeed = this.hashString(
      `${normalizedConversation}|${tone}|${length}|${input.customInstructions || ''}`,
    );

    this.logger.debug(
      `smart-reply-model-provider: intent=${intent} tone=${tone} length=${length} count=${input.count}`,
    );

    const orderedTemplates = templates
      .map((template, index) => ({
        template,
        order: (deterministicSeed + index * 31) % 997,
      }))
      .sort((a, b) => a.order - b.order)
      .map((item) => item.template);

    const suggestions: string[] = [];
    for (const template of orderedTemplates) {
      const rendered = this.applyRenderingPipeline(template, {
        tone,
        length,
        includeSignature: input.includeSignature,
        customInstructions: input.customInstructions,
      });
      if (!rendered) continue;
      if (suggestions.includes(rendered)) continue;
      suggestions.push(rendered);
      if (suggestions.length >= input.count) break;
    }

    return suggestions;
  }

  private applyRenderingPipeline(
    baseText: string,
    options: {
      tone: SmartReplyTone;
      length: SmartReplyLength;
      includeSignature: boolean;
      customInstructions?: string | null;
    },
  ): string {
    let reply = this.applyTone(baseText, options.tone);
    reply = this.applyLength(reply, options.length);
    reply = this.applyCustomInstructions(reply, options.customInstructions);
    reply = this.appendSignatureIfNeeded(reply, options.includeSignature);
    return reply.trim();
  }

  private normalizeTone(rawTone: string): SmartReplyTone {
    const tone = String(rawTone || '')
      .trim()
      .toLowerCase();
    if (tone === 'friendly') return 'friendly';
    if (tone === 'concise') return 'concise';
    if (tone === 'formal') return 'formal';
    return 'professional';
  }

  private normalizeLength(rawLength: string): SmartReplyLength {
    const length = String(rawLength || '')
      .trim()
      .toLowerCase();
    if (length === 'short') return 'short';
    if (length === 'long') return 'long';
    return 'medium';
  }

  private applyTone(text: string, tone: SmartReplyTone): string {
    if (tone === 'friendly') {
      return text
        .replace('Thank you', 'Thanks')
        .replace('I appreciate', 'Really appreciate');
    }
    if (tone === 'concise') {
      return text
        .replace(
          'I am reviewing it and will get back to you shortly.',
          'I will review and reply soon.',
        )
        .replace(
          'I will follow up with a complete response shortly.',
          'I will follow up soon.',
        );
    }
    if (tone === 'formal') {
      if (text.startsWith('Thanks')) {
        return text.replace('Thanks', 'Thank you');
      }
      return text.replace('shortly', 'at the earliest opportunity');
    }
    return text;
  }

  private applyLength(text: string, length: SmartReplyLength): string {
    if (length === 'short') {
      const firstSentence = text.split('.').find((sentence) => sentence.trim());
      return firstSentence ? `${firstSentence.trim()}.` : text;
    }
    if (length === 'long') {
      return `${text} If anything changes on your side, please let me know and I will adjust accordingly.`;
    }
    return text;
  }

  private applyCustomInstructions(
    text: string,
    customInstructions?: string | null,
  ): string {
    const instructions = String(customInstructions || '').trim();
    if (!instructions) return text;
    return `${text} (${instructions})`;
  }

  private appendSignatureIfNeeded(
    text: string,
    includeSignature: boolean,
  ): string {
    if (!includeSignature) return text;
    return `${text}\n\nBest regards,\nMailZen User`;
  }

  private detectIntent(conversation: string): string {
    const normalized = conversation.toLowerCase();
    if (/schedule|meeting|calendar|slot|availability|time/.test(normalized)) {
      return 'scheduling';
    }
    if (/status|update|timeline|eta|progress/.test(normalized)) {
      return 'status_update';
    }
    if (/issue|problem|error|bug|blocked|failure|urgent/.test(normalized)) {
      return 'issue';
    }
    if (/thanks|thank you|appreciate/.test(normalized)) {
      return 'gratitude';
    }
    return 'generic';
  }

  private hashString(value: string): number {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = (hash * 31 + value.charCodeAt(index)) % 2_147_483_647;
    }
    return Math.abs(hash);
  }
}
