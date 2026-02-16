import { Injectable, Logger } from '@nestjs/common';
import { SmartReplyExternalModelAdapter } from './smart-reply-external-model.adapter';
import { SmartReplyModelProvider } from './smart-reply-model.provider';
import { SmartReplyProviderRequest } from './smart-reply-provider.interface';

type SmartReplyProviderMode = 'template' | 'agent_platform' | 'hybrid';

@Injectable()
export class SmartReplyProviderRouter {
  private readonly logger = new Logger(SmartReplyProviderRouter.name);

  constructor(
    private readonly templateProvider: SmartReplyModelProvider,
    private readonly externalProvider: SmartReplyExternalModelAdapter,
  ) {}

  private resolveProviderMode(): SmartReplyProviderMode {
    const normalized = String(process.env.SMART_REPLY_PROVIDER_MODE || 'hybrid')
      .trim()
      .toLowerCase();
    if (normalized === 'template') return 'template';
    if (normalized === 'agent_platform') return 'agent_platform';
    if (normalized === 'hybrid') return 'hybrid';

    this.logger.warn(
      `smart-reply-provider-router: unknown SMART_REPLY_PROVIDER_MODE=${normalized}; falling back to hybrid`,
    );
    return 'hybrid';
  }

  private shouldPreferExternalByModel(aiModel?: string | null): boolean {
    const normalized = String(aiModel || '')
      .trim()
      .toLowerCase();
    return ['accurate', 'advanced'].includes(normalized);
  }

  private shouldTryExternalProvider(input: {
    aiModel?: string | null;
  }): boolean {
    const mode = this.resolveProviderMode();
    if (mode === 'template') return false;
    if (mode === 'agent_platform') return true;
    return this.shouldPreferExternalByModel(input.aiModel);
  }

  async generateSuggestions(input: {
    aiModel?: string | null;
    request: SmartReplyProviderRequest;
  }): Promise<{
    suggestions: string[];
    source: 'external' | 'internal';
    fallbackUsed: boolean;
  }> {
    const externalFirst = this.shouldTryExternalProvider({
      aiModel: input.aiModel,
    });
    if (externalFirst) {
      const externalSuggestions =
        await this.externalProvider.generateSuggestions(input.request);
      if (externalSuggestions.length) {
        this.logger.debug(
          `smart-reply-provider-router: selected source=external suggestions=${externalSuggestions.length}`,
        );
        return {
          suggestions: externalSuggestions,
          source: 'external',
          fallbackUsed: false,
        };
      }
      this.logger.warn(
        'smart-reply-provider-router: external provider returned no suggestions; falling back to template provider',
      );
    }

    const internalSuggestions = this.templateProvider.generateSuggestions(
      input.request,
    );
    this.logger.debug(
      `smart-reply-provider-router: selected source=internal suggestions=${internalSuggestions.length} fallbackUsed=${externalFirst}`,
    );
    return {
      suggestions: internalSuggestions,
      source: 'internal',
      fallbackUsed: externalFirst,
    };
  }
}
