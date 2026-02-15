import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SmartReplyInput } from './dto/smart-reply.input';
import { SmartReplyExternalModelAdapter } from './smart-reply-external-model.adapter';
import { SmartReplySettings } from './entities/smart-reply-settings.entity';
import { UpdateSmartReplySettingsInput } from './dto/update-smart-reply-settings.input';
import { SmartReplyModelProvider } from './smart-reply-model.provider';

@Injectable()
export class SmartReplyService {
  private readonly logger = new Logger(SmartReplyService.name);
  private readonly safeFallbackReply =
    'Thank you for your message. I will review this and follow up shortly.';
  private readonly disabledReply =
    'Smart replies are disabled in your settings. Please enable them to generate suggestions.';

  constructor(
    @InjectRepository(SmartReplySettings)
    private readonly settingsRepo: Repository<SmartReplySettings>,
    private readonly modelProvider: SmartReplyModelProvider,
    private readonly externalModelAdapter: SmartReplyExternalModelAdapter,
  ) {}

  async generateReply(input: SmartReplyInput, userId: string): Promise<string> {
    try {
      const settings = await this.getSettings(userId);
      if (!settings.enabled) {
        this.logger.warn(
          `smart-reply-service: settings disabled for userId=${userId}`,
        );
        return this.disabledReply;
      }

      const normalizedConversation = this.normalizeConversation(
        input.conversation,
      );
      if (this.containsSensitiveContext(normalizedConversation)) {
        this.logger.warn(
          `smart-reply-service: sensitive context blocked userId=${userId}`,
        );
        return this.getSafetyBlockedReply();
      }

      this.logger.log(
        `smart-reply-service: generating reply userId=${userId} tone=${settings.defaultTone} length=${settings.defaultLength}`,
      );

      this.storeConversation(normalizedConversation, userId);
      const suggestions = await this.generateModelSuggestions(
        normalizedConversation,
        settings,
        Math.max(1, settings.maxSuggestions),
      );
      const first = suggestions[0];
      if (!first) {
        this.logger.warn(
          `smart-reply-service: provider returned no suggestions userId=${userId}`,
        );
        return this.safeFallbackReply;
      }

      return first;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `smart-reply-service: failed generation userId=${userId} message=${message}`,
        stack,
      );
      return this.safeFallbackReply;
    }
  }

  private storeConversation(conversation: string, userId: string): void {
    try {
      // In future iterations this can be persisted to a dedicated conversation history table.
      /*
      await this.conversationLogRepo.save(
        this.conversationLogRepo.create({ text: conversation, timestamp: new Date() }),
      );
      */

      this.logger.debug(
        `smart-reply-service: conversation observed for training userId=${userId} chars=${conversation.length}`,
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `smart-reply-service: failed to track conversation userId=${userId} message=${message}`,
      );
    }
  }

  async getSuggestedReplies(
    emailBody: string,
    count: number = 3,
    userId: string,
  ): Promise<string[]> {
    const settings = await this.getSettings(userId);
    if (!settings.enabled) {
      this.logger.warn(
        `smart-reply-service: skipped suggestions because disabled userId=${userId}`,
      );
      return [];
    }

    const normalizedConversation = this.normalizeConversation(emailBody);
    if (!normalizedConversation) return [];

    if (this.containsSensitiveContext(normalizedConversation)) {
      this.logger.warn(
        `smart-reply-service: blocked sensitive suggestion request userId=${userId}`,
      );
      return [this.getSafetyBlockedReply()];
    }

    const maxAllowedSuggestions = Math.max(1, settings.maxSuggestions);
    const requestedCount = Math.max(1, Math.min(count, maxAllowedSuggestions));

    try {
      const suggestions = await this.generateModelSuggestions(
        normalizedConversation,
        settings,
        requestedCount,
      );
      if (!suggestions.length) return [this.safeFallbackReply];
      return suggestions;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `smart-reply-service: failed suggestions userId=${userId} message=${message}`,
      );
      return [this.safeFallbackReply];
    }
  }

  private normalizeConversation(conversation: string): string {
    return String(conversation || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private containsSensitiveContext(conversation: string): boolean {
    return /\b(password|passcode|otp|api key|secret key|credit card|cvv|ssn|social security)\b/i.test(
      conversation,
    );
  }

  private getSafetyBlockedReply(): string {
    return 'Thanks for your message. For security reasons, please avoid sharing sensitive credentials over email.';
  }

  private async generateModelSuggestions(
    conversation: string,
    settings: SmartReplySettings,
    count: number,
  ): Promise<string[]> {
    const externalPreferred = ['accurate', 'advanced'].includes(
      String(settings.aiModel || '').toLowerCase(),
    );

    if (externalPreferred) {
      const externalSuggestions =
        await this.externalModelAdapter.generateSuggestions({
          conversation,
          count,
          tone: settings.defaultTone,
          length: settings.defaultLength,
        });
      if (externalSuggestions.length) return externalSuggestions;
    }

    return this.modelProvider.generateSuggestions({
      conversation,
      tone: settings.defaultTone,
      length: settings.defaultLength,
      count,
      includeSignature: settings.includeSignature,
      customInstructions: settings.customInstructions || undefined,
    });
  }

  async getSettings(userId: string): Promise<SmartReplySettings> {
    const existing = await this.settingsRepo.findOne({ where: { userId } });
    if (existing) return existing;

    const created = this.settingsRepo.create({ userId });
    return this.settingsRepo.save(created);
  }

  async updateSettings(
    userId: string,
    input: UpdateSmartReplySettingsInput,
  ): Promise<SmartReplySettings> {
    const existing = await this.getSettings(userId);

    const updated = this.settingsRepo.merge(existing, {
      enabled: input.enabled ?? existing.enabled,
      defaultTone: input.defaultTone ?? existing.defaultTone,
      defaultLength: input.defaultLength ?? existing.defaultLength,
      aiModel: input.aiModel ?? existing.aiModel,
      includeSignature: input.includeSignature ?? existing.includeSignature,
      personalization: input.personalization ?? existing.personalization,
      creativityLevel: input.creativityLevel ?? existing.creativityLevel,
      maxSuggestions: input.maxSuggestions ?? existing.maxSuggestions,
      customInstructions:
        input.customInstructions !== undefined
          ? input.customInstructions
          : existing.customInstructions,
      keepHistory: input.keepHistory ?? existing.keepHistory,
      historyLength: input.historyLength ?? existing.historyLength,
    });

    return this.settingsRepo.save(updated);
  }
}
