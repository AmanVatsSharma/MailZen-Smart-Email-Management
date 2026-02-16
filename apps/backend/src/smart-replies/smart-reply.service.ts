import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { SmartReplyInput } from './dto/smart-reply.input';
import { SmartReplyHistory } from './entities/smart-reply-history.entity';
import { SmartReplySettings } from './entities/smart-reply-settings.entity';
import { UpdateSmartReplySettingsInput } from './dto/update-smart-reply-settings.input';
import { SmartReplyProviderRouter } from './smart-reply-provider.router';

@Injectable()
export class SmartReplyService {
  private readonly logger = new Logger(SmartReplyService.name);
  private static readonly MIN_HISTORY_LIMIT = 1;
  private static readonly MAX_HISTORY_LIMIT = 100;
  private static readonly MIN_EXPORT_HISTORY_LIMIT = 1;
  private static readonly MAX_EXPORT_HISTORY_LIMIT = 500;
  private static readonly MIN_RETENTION_DAYS = 1;
  private static readonly MAX_RETENTION_DAYS = 3650;
  private readonly safeFallbackReply =
    'Thank you for your message. I will review this and follow up shortly.';
  private readonly disabledReply =
    'Smart replies are disabled in your settings. Please enable them to generate suggestions.';

  constructor(
    @InjectRepository(SmartReplySettings)
    private readonly settingsRepo: Repository<SmartReplySettings>,
    @InjectRepository(SmartReplyHistory)
    private readonly historyRepo: Repository<SmartReplyHistory>,
    private readonly providerRouter: SmartReplyProviderRouter,
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
        await this.persistHistoryRecord({
          userId,
          settings,
          conversation: normalizedConversation,
          suggestions: [this.getSafetyBlockedReply()],
          source: 'safety',
          blockedSensitive: true,
          fallbackUsed: false,
        });
        return this.getSafetyBlockedReply();
      }

      this.logger.log(
        `smart-reply-service: generating reply userId=${userId} tone=${settings.defaultTone} length=${settings.defaultLength}`,
      );

      const generated = await this.generateModelSuggestions(
        normalizedConversation,
        settings,
        Math.max(1, settings.maxSuggestions),
      );
      const first = generated.suggestions[0];
      await this.persistHistoryRecord({
        userId,
        settings,
        conversation: normalizedConversation,
        suggestions: generated.suggestions,
        source: generated.source,
        blockedSensitive: false,
        fallbackUsed: generated.fallbackUsed,
      });
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
      const generated = await this.generateModelSuggestions(
        normalizedConversation,
        settings,
        requestedCount,
      );
      await this.persistHistoryRecord({
        userId,
        settings,
        conversation: normalizedConversation,
        suggestions: generated.suggestions,
        source: generated.source,
        blockedSensitive: false,
        fallbackUsed: generated.fallbackUsed,
      });
      if (!generated.suggestions.length) return [this.safeFallbackReply];
      return generated.suggestions;
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
  ): Promise<{
    suggestions: string[];
    source: 'external' | 'internal' | 'openai';
    fallbackUsed: boolean;
  }> {
    return this.providerRouter.generateSuggestions({
      aiModel: settings.aiModel,
      request: {
        conversation,
        tone: settings.defaultTone,
        length: settings.defaultLength,
        count,
        includeSignature: settings.includeSignature,
        customInstructions: settings.customInstructions || undefined,
      },
    });
  }

  private resolveHistoryRetentionDays(settings: SmartReplySettings): number {
    const configured = Number(settings.historyLength || 30);
    if (!Number.isFinite(configured)) return 30;
    if (configured < 1) return 1;
    if (configured > 365) return 365;
    return Math.trunc(configured);
  }

  private async persistHistoryRecord(input: {
    userId: string;
    settings: SmartReplySettings;
    conversation: string;
    suggestions: string[];
    source: string;
    blockedSensitive: boolean;
    fallbackUsed: boolean;
  }): Promise<void> {
    if (input.settings.keepHistory === false) return;

    try {
      const conversationPreview = input.conversation.slice(0, 800);
      const normalizedSuggestions = (input.suggestions || [])
        .map((suggestion) => String(suggestion || '').trim())
        .filter(Boolean)
        .slice(0, 5)
        .map((suggestion) => suggestion.slice(0, 500));

      const record = this.historyRepo.create({
        userId: input.userId,
        conversationPreview,
        suggestions: normalizedSuggestions,
        source: String(input.source || 'internal').slice(0, 64),
        blockedSensitive: Boolean(input.blockedSensitive),
        fallbackUsed: Boolean(input.fallbackUsed),
      });
      await this.historyRepo.save(record);
      const retentionDays = this.resolveHistoryRetentionDays(input.settings);
      const retentionCutoff = new Date(
        Date.now() - retentionDays * 24 * 60 * 60 * 1000,
      );
      await this.historyRepo.delete({
        userId: input.userId,
        createdAt: LessThan(retentionCutoff),
      });
      this.logger.debug(
        `smart-reply-service: history persisted userId=${input.userId} source=${record.source} suggestions=${record.suggestions.length}`,
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `smart-reply-service: failed history persistence userId=${input.userId} message=${message}`,
      );
    }
  }

  async listHistory(
    userId: string,
    limit: number = 20,
  ): Promise<SmartReplyHistory[]> {
    const normalizedLimit = Math.max(
      SmartReplyService.MIN_HISTORY_LIMIT,
      Math.min(SmartReplyService.MAX_HISTORY_LIMIT, Math.trunc(limit || 20)),
    );
    return this.historyRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: normalizedLimit,
    });
  }

  async purgeHistory(userId: string): Promise<{ purgedRows: number }> {
    const result = await this.historyRepo.delete({ userId });
    return {
      purgedRows: Number(result.affected || 0),
    };
  }

  private resolveAutoPurgeRetentionDays(overrideDays?: number | null): number {
    const candidate =
      typeof overrideDays === 'number' && Number.isFinite(overrideDays)
        ? Math.trunc(overrideDays)
        : Number(
            process.env.MAILZEN_SMART_REPLY_HISTORY_RETENTION_DAYS || '365',
          );
    if (!Number.isFinite(candidate)) return 365;
    if (candidate < SmartReplyService.MIN_RETENTION_DAYS) {
      return SmartReplyService.MIN_RETENTION_DAYS;
    }
    if (candidate > SmartReplyService.MAX_RETENTION_DAYS) {
      return SmartReplyService.MAX_RETENTION_DAYS;
    }
    return candidate;
  }

  async purgeHistoryByRetentionPolicy(input?: {
    retentionDays?: number | null;
  }): Promise<{
    deletedRows: number;
    retentionDays: number;
  }> {
    const retentionDays = this.resolveAutoPurgeRetentionDays(
      input?.retentionDays,
    );
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const result = await this.historyRepo.delete({
      createdAt: LessThan(cutoff),
    });
    return {
      deletedRows: Number(result.affected || 0),
      retentionDays,
    };
  }

  private normalizeExportLimit(limit?: number): number {
    if (typeof limit !== 'number' || !Number.isFinite(limit)) {
      return 200;
    }
    return Math.max(
      SmartReplyService.MIN_EXPORT_HISTORY_LIMIT,
      Math.min(
        SmartReplyService.MAX_EXPORT_HISTORY_LIMIT,
        Math.trunc(limit || 200),
      ),
    );
  }

  async exportSmartReplyData(
    userId: string,
    limit?: number,
  ): Promise<{ generatedAtIso: string; dataJson: string }> {
    const settings = await this.getSettings(userId);
    const exportHistoryLimit = this.normalizeExportLimit(limit);
    const historyRows = await this.historyRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: exportHistoryLimit,
    });
    const generatedAtIso = new Date().toISOString();
    const dataJson = JSON.stringify({
      exportVersion: 'v1',
      generatedAtIso,
      settings: {
        enabled: settings.enabled,
        defaultTone: settings.defaultTone,
        defaultLength: settings.defaultLength,
        aiModel: settings.aiModel,
        includeSignature: settings.includeSignature,
        personalization: settings.personalization,
        creativityLevel: settings.creativityLevel,
        maxSuggestions: settings.maxSuggestions,
        customInstructions: settings.customInstructions || null,
        keepHistory: settings.keepHistory,
        historyLengthDays: settings.historyLength,
      },
      retentionPolicy: {
        keepHistory: settings.keepHistory,
        historyLengthDays: this.resolveHistoryRetentionDays(settings),
      },
      history: historyRows.map((row) => ({
        id: row.id,
        conversationPreview: row.conversationPreview,
        suggestions: row.suggestions || [],
        source: row.source,
        blockedSensitive: row.blockedSensitive,
        fallbackUsed: row.fallbackUsed,
        createdAtIso: row.createdAt.toISOString(),
      })),
    });

    return {
      generatedAtIso,
      dataJson,
    };
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
