import { Injectable, Logger } from '@nestjs/common';
import { SmartReplyExternalModelAdapter } from './smart-reply-external-model.adapter';
import { SmartReplyModelProvider } from './smart-reply-model.provider';
import { SmartReplyOpenAiAdapter } from './smart-reply-openai.adapter';
import { SmartReplyProviderRequest } from './smart-reply-provider.interface';

type SmartReplyProviderMode =
  | 'template'
  | 'agent_platform'
  | 'openai'
  | 'hybrid';

type RoutedProvider = 'openai' | 'external';

@Injectable()
export class SmartReplyProviderRouter {
  private readonly logger = new Logger(SmartReplyProviderRouter.name);

  constructor(
    private readonly templateProvider: SmartReplyModelProvider,
    private readonly openAiProvider: SmartReplyOpenAiAdapter,
    private readonly externalProvider: SmartReplyExternalModelAdapter,
  ) {}

  private resolveProviderMode(): SmartReplyProviderMode {
    const normalized = String(process.env.SMART_REPLY_PROVIDER_MODE || 'hybrid')
      .trim()
      .toLowerCase();
    if (normalized === 'template') return 'template';
    if (normalized === 'agent_platform') return 'agent_platform';
    if (normalized === 'openai') return 'openai';
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
  }): RoutedProvider[] {
    const mode = this.resolveProviderMode();
    if (mode === 'template') return [];
    if (mode === 'agent_platform') return ['external'];
    if (mode === 'openai') return ['openai'];
    if (!this.shouldPreferExternalByModel(input.aiModel)) return [];
    return ['openai', 'external'];
  }

  private async runProvider(
    provider: RoutedProvider,
    request: SmartReplyProviderRequest,
  ): Promise<string[]> {
    if (provider === 'openai') {
      return this.openAiProvider.generateSuggestions(request);
    }
    return this.externalProvider.generateSuggestions(request);
  }

  async generateSuggestions(input: {
    aiModel?: string | null;
    request: SmartReplyProviderRequest;
  }): Promise<{
    suggestions: string[];
    source: 'external' | 'internal' | 'openai';
    fallbackUsed: boolean;
  }> {
    const routedProviders = this.shouldTryExternalProvider({
      aiModel: input.aiModel,
    });
    for (let index = 0; index < routedProviders.length; index += 1) {
      const provider = routedProviders[index];
      const suggestions = await this.runProvider(provider, input.request);
      if (suggestions.length) {
        const source = provider === 'openai' ? 'openai' : 'external';
        const fallbackUsed = index > 0;
        this.logger.debug(
          `smart-reply-provider-router: selected source=${source} suggestions=${suggestions.length} fallbackUsed=${fallbackUsed}`,
        );
        return {
          suggestions,
          source,
          fallbackUsed,
        };
      }
      this.logger.warn(
        `smart-reply-provider-router: provider=${provider} returned no suggestions`,
      );
    }

    const internalSuggestions = this.templateProvider.generateSuggestions(
      input.request,
    );
    this.logger.debug(
      `smart-reply-provider-router: selected source=internal suggestions=${internalSuggestions.length} fallbackUsed=${routedProviders.length > 0}`,
    );
    return {
      suggestions: internalSuggestions,
      source: 'internal',
      fallbackUsed: routedProviders.length > 0,
    };
  }
}
