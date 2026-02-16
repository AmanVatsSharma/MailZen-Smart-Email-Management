import { Injectable, Logger } from '@nestjs/common';
import { SmartReplyAnthropicAdapter } from './smart-reply-anthropic.adapter';
import { SmartReplyAzureOpenAiAdapter } from './smart-reply-azure-openai.adapter';
import { SmartReplyExternalModelAdapter } from './smart-reply-external-model.adapter';
import { SmartReplyModelProvider } from './smart-reply-model.provider';
import { SmartReplyOpenAiAdapter } from './smart-reply-openai.adapter';
import { SmartReplyProviderRequest } from './smart-reply-provider.interface';

type SmartReplyProviderMode =
  | 'template'
  | 'agent_platform'
  | 'openai'
  | 'azure_openai'
  | 'anthropic'
  | 'hybrid';

type RoutedProvider = 'openai' | 'azure_openai' | 'anthropic' | 'external';

@Injectable()
export class SmartReplyProviderRouter {
  private readonly logger = new Logger(SmartReplyProviderRouter.name);

  constructor(
    private readonly templateProvider: SmartReplyModelProvider,
    private readonly openAiProvider: SmartReplyOpenAiAdapter,
    private readonly azureOpenAiProvider: SmartReplyAzureOpenAiAdapter,
    private readonly anthropicProvider: SmartReplyAnthropicAdapter,
    private readonly externalProvider: SmartReplyExternalModelAdapter,
  ) {}

  private isTruthyEnv(raw: string | undefined, fallback: string): boolean {
    const normalized = String(raw ?? fallback)
      .trim()
      .toLowerCase();
    return ['true', '1', 'yes', 'on'].includes(normalized);
  }

  private resolveProviderMode(): SmartReplyProviderMode {
    const normalized = String(process.env.SMART_REPLY_PROVIDER_MODE || 'hybrid')
      .trim()
      .toLowerCase();
    if (normalized === 'template') return 'template';
    if (normalized === 'agent_platform') return 'agent_platform';
    if (normalized === 'openai') return 'openai';
    if (normalized === 'azure_openai') return 'azure_openai';
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
      return ['anthropic', 'openai', 'azure_openai', 'external'];
    }
    if (normalizedPrimary === 'azure_openai') {
      return ['azure_openai', 'openai', 'anthropic', 'external'];
    }
    if (normalizedPrimary === 'agent_platform') {
      return ['external', 'openai', 'azure_openai', 'anthropic'];
    }
    return ['openai', 'azure_openai', 'anthropic', 'external'];
  }

  private resolveHybridPrimaryForHealth(): string {
    const normalized = String(
      process.env.SMART_REPLY_HYBRID_PRIMARY || 'openai',
    )
      .trim()
      .toLowerCase();
    if (normalized === 'openai') return 'openai';
    if (normalized === 'azure_openai') return 'azure_openai';
    if (normalized === 'anthropic') return 'anthropic';
    if (normalized === 'agent_platform') return 'agent_platform';
    return 'openai';
  }

  private shouldTryExternalProvider(input: {
    aiModel?: string | null;
  }): RoutedProvider[] {
    const mode = this.resolveProviderMode();
    if (mode === 'template') return [];
    if (mode === 'agent_platform') return ['external'];
    if (mode === 'openai') return ['openai'];
    if (mode === 'azure_openai') return ['azure_openai'];
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
    if (provider === 'azure_openai') {
      return this.azureOpenAiProvider.generateSuggestions(request);
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
    source: 'external' | 'internal' | 'openai' | 'azure_openai' | 'anthropic';
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
            : provider === 'azure_openai'
              ? 'azure_openai'
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

  getProviderHealthSnapshot(): {
    mode: SmartReplyProviderMode;
    hybridPrimary: string;
    providers: Array<{
      providerId: string;
      enabled: boolean;
      configured: boolean;
      priority: number;
      note?: string;
    }>;
  } {
    const mode = this.resolveProviderMode();
    const hybridPrimary = this.resolveHybridPrimaryForHealth();
    const priorityMap = new Map<RoutedProvider, number>();
    if (mode === 'hybrid') {
      const priority = this.resolveHybridProviderPriority();
      priority.forEach((providerId, index) => {
        priorityMap.set(providerId, index + 1);
      });
    } else if (mode === 'openai') {
      priorityMap.set('openai', 1);
    } else if (mode === 'azure_openai') {
      priorityMap.set('azure_openai', 1);
    } else if (mode === 'anthropic') {
      priorityMap.set('anthropic', 1);
    } else if (mode === 'agent_platform') {
      priorityMap.set('external', 1);
    }

    const openAiEnabled = this.isTruthyEnv(
      process.env.SMART_REPLY_USE_OPENAI,
      'false',
    );
    const azureOpenAiEnabled = this.isTruthyEnv(
      process.env.SMART_REPLY_USE_AZURE_OPENAI,
      'false',
    );
    const anthropicEnabled = this.isTruthyEnv(
      process.env.SMART_REPLY_USE_ANTHROPIC,
      'false',
    );
    const externalEnabled = this.isTruthyEnv(
      process.env.SMART_REPLY_USE_AGENT_PLATFORM,
      'false',
    );
    const openAiConfigured = Boolean(
      String(process.env.SMART_REPLY_OPENAI_API_KEY || '').trim(),
    );
    const azureOpenAiConfigured =
      Boolean(
        String(process.env.SMART_REPLY_AZURE_OPENAI_API_KEY || '').trim(),
      ) &&
      Boolean(
        String(process.env.SMART_REPLY_AZURE_OPENAI_ENDPOINT || '').trim(),
      ) &&
      Boolean(
        String(process.env.SMART_REPLY_AZURE_OPENAI_DEPLOYMENT || '').trim(),
      );
    const anthropicConfigured = Boolean(
      String(process.env.SMART_REPLY_ANTHROPIC_API_KEY || '').trim(),
    );
    const externalConfigured = Boolean(
      String(process.env.AI_AGENT_PLATFORM_URL || '').trim(),
    );

    return {
      mode,
      hybridPrimary,
      providers: [
        {
          providerId: 'template',
          enabled: true,
          configured: true,
          priority: mode === 'template' ? 1 : 999,
          note: 'deterministic fallback provider',
        },
        {
          providerId: 'openai',
          enabled: openAiEnabled,
          configured: openAiConfigured,
          priority: priorityMap.get('openai') || 999,
        },
        {
          providerId: 'azure_openai',
          enabled: azureOpenAiEnabled,
          configured: azureOpenAiConfigured,
          priority: priorityMap.get('azure_openai') || 999,
        },
        {
          providerId: 'anthropic',
          enabled: anthropicEnabled,
          configured: anthropicConfigured,
          priority: priorityMap.get('anthropic') || 999,
        },
        {
          providerId: 'agent_platform',
          enabled: externalEnabled,
          configured: externalConfigured,
          priority: priorityMap.get('external') || 999,
        },
      ],
    };
  }
}
