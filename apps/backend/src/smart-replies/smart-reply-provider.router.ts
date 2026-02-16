import { Injectable, Logger } from '@nestjs/common';
import { SmartReplyAnthropicAdapter } from './smart-reply-anthropic.adapter';
import { SmartReplyExternalModelAdapter } from './smart-reply-external-model.adapter';
import { SmartReplyModelProvider } from './smart-reply-model.provider';
import { SmartReplyOpenAiAdapter } from './smart-reply-openai.adapter';
import { SmartReplyProviderRequest } from './smart-reply-provider.interface';

type SmartReplyProviderMode =
  | 'template'
  | 'agent_platform'
  | 'openai'
  | 'anthropic'
  | 'hybrid';

type RoutedProvider = 'openai' | 'anthropic' | 'external';

@Injectable()
export class SmartReplyProviderRouter {
  private readonly logger = new Logger(SmartReplyProviderRouter.name);

  constructor(
    private readonly templateProvider: SmartReplyModelProvider,
    private readonly openAiProvider: SmartReplyOpenAiAdapter,
    private readonly anthropicProvider: SmartReplyAnthropicAdapter,
    private readonly externalProvider: SmartReplyExternalModelAdapter,
  ) {}

  private resolveProviderMode(): SmartReplyProviderMode {
    const normalized = String(process.env.SMART_REPLY_PROVIDER_MODE || 'hybrid')
      .trim()
      .toLowerCase();
    if (normalized === 'template') return 'template';
    if (normalized === 'agent_platform') return 'agent_platform';
    if (normalized === 'openai') return 'openai';
    if (normalized === 'anthropic') return 'anthropic';
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

  private resolveHybridProviderPriority(): RoutedProvider[] {
    const normalizedPrimary = String(
      process.env.SMART_REPLY_HYBRID_PRIMARY || 'openai',
    )
      .trim()
      .toLowerCase();
    if (normalizedPrimary === 'anthropic') {
      return ['anthropic', 'openai', 'external'];
    }
    if (normalizedPrimary === 'agent_platform') {
      return ['external', 'openai', 'anthropic'];
    }
    return ['openai', 'anthropic', 'external'];
  }

  private shouldTryExternalProvider(input: {
    aiModel?: string | null;
  }): RoutedProvider[] {
    const mode = this.resolveProviderMode();
    if (mode === 'template') return [];
    if (mode === 'agent_platform') return ['external'];
    if (mode === 'openai') return ['openai'];
    if (mode === 'anthropic') return ['anthropic'];
    if (!this.shouldPreferExternalByModel(input.aiModel)) return [];
    return this.resolveHybridProviderPriority();
  }

  private async runProvider(
    provider: RoutedProvider,
    request: SmartReplyProviderRequest,
  ): Promise<string[]> {
    if (provider === 'openai') {
      return this.openAiProvider.generateSuggestions(request);
    }
    if (provider === 'anthropic') {
      return this.anthropicProvider.generateSuggestions(request);
    }
    return this.externalProvider.generateSuggestions(request);
  }

  async generateSuggestions(input: {
    aiModel?: string | null;
    request: SmartReplyProviderRequest;
  }): Promise<{
    suggestions: string[];
    source: 'external' | 'internal' | 'openai' | 'anthropic';
    fallbackUsed: boolean;
  }> {
    const routedProviders = this.shouldTryExternalProvider({
      aiModel: input.aiModel,
    });
    for (let index = 0; index < routedProviders.length; index += 1) {
      const provider = routedProviders[index];
      const suggestions = await this.runProvider(provider, input.request);
      if (suggestions.length) {
        const source =
          provider === 'openai'
            ? 'openai'
            : provider === 'anthropic'
              ? 'anthropic'
              : 'external';
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
