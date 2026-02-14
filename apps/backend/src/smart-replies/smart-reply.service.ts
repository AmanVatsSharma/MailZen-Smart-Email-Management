import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SmartReplyInput } from './dto/smart-reply.input';
import { SmartReplySettings } from './entities/smart-reply-settings.entity';
import { UpdateSmartReplySettingsInput } from './dto/update-smart-reply-settings.input';

@Injectable()
export class SmartReplyService {
  private readonly logger = new Logger(SmartReplyService.name);

  constructor(
    @InjectRepository(SmartReplySettings)
    private readonly settingsRepo: Repository<SmartReplySettings>,
  ) {}

  async generateReply(input: SmartReplyInput): Promise<string> {
    try {
      this.logger.log(
        `Generating smart reply for conversation: ${input.conversation.substring(0, 50)}...`,
      );

      // Store the conversation in the database for future training
      await this.storeConversation(input.conversation);

      // Simple response templates based on conversation context
      // In a real implementation, this would use AI/ML models
      const templates = [
        "Thank you for your email. I'll review and get back to you soon.",
        'I appreciate your message. Let me look into this and respond shortly.',
        "Thanks for reaching out. I'll handle this right away.",
        "Got it! I'll process your request and follow up.",
        "Thank you for the information. I'll take appropriate action.",
      ];

      // Get a "smart" reply (for demo purposes, just select randomly)
      const smartReply =
        templates[Math.floor(Math.random() * templates.length)];

      return smartReply;
    } catch (error) {
      this.logger.error(
        `Error generating smart reply: ${error.message}`,
        error.stack,
      );
      return "I'm sorry, I couldn't generate a reply at this time.";
    }
  }

  private async storeConversation(conversation: string): Promise<void> {
    try {
      // In a real implementation, you would store this in a database
      // For example, using a DB table + TypeORM repository:
      /*
      await this.conversationLogRepo.save(
        this.conversationLogRepo.create({ text: conversation, timestamp: new Date() }),
      );
      */

      // For now, just log that we would store it
      this.logger.debug('Conversation stored for future training');
    } catch (error) {
      this.logger.error(`Error storing conversation: ${error.message}`);
    }
  }

  async getSuggestedReplies(
    emailBody: string,
    count: number = 3,
  ): Promise<string[]> {
    // This would integrate with an AI service in a real implementation
    const suggestions = [
      'Yes, that works for me.',
      "I'll check and get back to you.",
      'Can we discuss this further?',
      'Thank you for the update.',
      "Let's schedule a call to discuss.",
    ];

    return suggestions.slice(0, count);
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
