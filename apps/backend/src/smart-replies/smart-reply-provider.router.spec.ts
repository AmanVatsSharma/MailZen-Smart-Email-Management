/* eslint-disable @typescript-eslint/unbound-method */
import { SmartReplyAnthropicAdapter } from './smart-reply-anthropic.adapter';
import { SmartReplyAzureOpenAiAdapter } from './smart-reply-azure-openai.adapter';
import { SmartReplyExternalModelAdapter } from './smart-reply-external-model.adapter';
import { SmartReplyModelProvider } from './smart-reply-model.provider';
import { SmartReplyOpenAiAdapter } from './smart-reply-openai.adapter';
import { SmartReplyProviderRouter } from './smart-reply-provider.router';

describe('SmartReplyProviderRouter', () => {
  let router: SmartReplyProviderRouter;
  const templateProvider: jest.Mocked<SmartReplyModelProvider> = {
    providerId: 'template',
    generateSuggestions: jest.fn(),
  } as unknown as jest.Mocked<SmartReplyModelProvider>;
  const openAiProvider: jest.Mocked<SmartReplyOpenAiAdapter> = {
    providerId: 'openai',
    generateSuggestions: jest.fn(),
  } as unknown as jest.Mocked<SmartReplyOpenAiAdapter>;
  const azureOpenAiProvider: jest.Mocked<SmartReplyAzureOpenAiAdapter> = {
    providerId: 'azure-openai',
    generateSuggestions: jest.fn(),
  } as unknown as jest.Mocked<SmartReplyAzureOpenAiAdapter>;
  const anthropicProvider: jest.Mocked<SmartReplyAnthropicAdapter> = {
    providerId: 'anthropic',
    generateSuggestions: jest.fn(),
  } as unknown as jest.Mocked<SmartReplyAnthropicAdapter>;
  const externalProvider: jest.Mocked<SmartReplyExternalModelAdapter> = {
    providerId: 'agent-platform',
    generateSuggestions: jest.fn(),
  } as unknown as jest.Mocked<SmartReplyExternalModelAdapter>;
  const originalMode = process.env.SMART_REPLY_PROVIDER_MODE;
  const originalHybridPrimary = process.env.SMART_REPLY_HYBRID_PRIMARY;
  const originalUseAzureOpenAi = process.env.SMART_REPLY_USE_AZURE_OPENAI;
  const originalAzureOpenAiApiKey =
    process.env.SMART_REPLY_AZURE_OPENAI_API_KEY;
  const originalAzureOpenAiEndpoint =
    process.env.SMART_REPLY_AZURE_OPENAI_ENDPOINT;
  const originalAzureOpenAiDeployment =
    process.env.SMART_REPLY_AZURE_OPENAI_DEPLOYMENT;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.SMART_REPLY_PROVIDER_MODE;
    delete process.env.SMART_REPLY_HYBRID_PRIMARY;
    delete process.env.SMART_REPLY_USE_AZURE_OPENAI;
    delete process.env.SMART_REPLY_AZURE_OPENAI_API_KEY;
    delete process.env.SMART_REPLY_AZURE_OPENAI_ENDPOINT;
    delete process.env.SMART_REPLY_AZURE_OPENAI_DEPLOYMENT;
    router = new SmartReplyProviderRouter(
      templateProvider,
      openAiProvider,
      azureOpenAiProvider,
      anthropicProvider,
      externalProvider,
    );
  });

  afterAll(() => {
    if (typeof originalMode === 'string') {
      process.env.SMART_REPLY_PROVIDER_MODE = originalMode;
    } else {
      delete process.env.SMART_REPLY_PROVIDER_MODE;
    }
    if (typeof originalHybridPrimary === 'string') {
      process.env.SMART_REPLY_HYBRID_PRIMARY = originalHybridPrimary;
    } else {
      delete process.env.SMART_REPLY_HYBRID_PRIMARY;
    }
    if (typeof originalUseAzureOpenAi === 'string') {
      process.env.SMART_REPLY_USE_AZURE_OPENAI = originalUseAzureOpenAi;
    } else {
      delete process.env.SMART_REPLY_USE_AZURE_OPENAI;
    }
    if (typeof originalAzureOpenAiApiKey === 'string') {
      process.env.SMART_REPLY_AZURE_OPENAI_API_KEY = originalAzureOpenAiApiKey;
    } else {
      delete process.env.SMART_REPLY_AZURE_OPENAI_API_KEY;
    }
    if (typeof originalAzureOpenAiEndpoint === 'string') {
      process.env.SMART_REPLY_AZURE_OPENAI_ENDPOINT =
        originalAzureOpenAiEndpoint;
    } else {
      delete process.env.SMART_REPLY_AZURE_OPENAI_ENDPOINT;
    }
    if (typeof originalAzureOpenAiDeployment === 'string') {
      process.env.SMART_REPLY_AZURE_OPENAI_DEPLOYMENT =
        originalAzureOpenAiDeployment;
    } else {
      delete process.env.SMART_REPLY_AZURE_OPENAI_DEPLOYMENT;
    }
  });

  it('uses openai provider first in hybrid mode for advanced model', async () => {
    openAiProvider.generateSuggestions.mockResolvedValue(['OpenAI reply']);
    azureOpenAiProvider.generateSuggestions.mockResolvedValue([
      'Azure OpenAI reply',
    ]);
    anthropicProvider.generateSuggestions.mockResolvedValue([
      'Anthropic reply',
    ]);
    externalProvider.generateSuggestions.mockResolvedValue([
      'External fallback',
    ]);
    templateProvider.generateSuggestions.mockReturnValue(['Template reply']);

    const result = await router.generateSuggestions({
      aiModel: 'advanced',
      request: {
        conversation: 'Please send status update.',
        tone: 'professional',
        length: 'medium',
        count: 2,
        includeSignature: false,
      },
    });

    expect(openAiProvider.generateSuggestions).toHaveBeenCalled();
    expect(azureOpenAiProvider.generateSuggestions).not.toHaveBeenCalled();
    expect(anthropicProvider.generateSuggestions).not.toHaveBeenCalled();
    expect(externalProvider.generateSuggestions).not.toHaveBeenCalled();
    expect(templateProvider.generateSuggestions).not.toHaveBeenCalled();
    expect(result).toEqual({
      suggestions: ['OpenAI reply'],
      source: 'openai',
      fallbackUsed: false,
    });
  });

  it('uses template provider in hybrid mode for balanced model', async () => {
    openAiProvider.generateSuggestions.mockResolvedValue(['OpenAI reply']);
    azureOpenAiProvider.generateSuggestions.mockResolvedValue([
      'Azure OpenAI reply',
    ]);
    anthropicProvider.generateSuggestions.mockResolvedValue([
      'Anthropic reply',
    ]);
    externalProvider.generateSuggestions.mockResolvedValue(['External reply']);
    templateProvider.generateSuggestions.mockReturnValue(['Template reply']);

    const result = await router.generateSuggestions({
      aiModel: 'balanced',
      request: {
        conversation: 'Can we align on timeline?',
        tone: 'friendly',
        length: 'short',
        count: 1,
        includeSignature: true,
      },
    });

    expect(openAiProvider.generateSuggestions).not.toHaveBeenCalled();
    expect(azureOpenAiProvider.generateSuggestions).not.toHaveBeenCalled();
    expect(anthropicProvider.generateSuggestions).not.toHaveBeenCalled();
    expect(externalProvider.generateSuggestions).not.toHaveBeenCalled();
    expect(templateProvider.generateSuggestions).toHaveBeenCalled();
    expect(result).toEqual({
      suggestions: ['Template reply'],
      source: 'internal',
      fallbackUsed: false,
    });
  });

  it('falls back to template provider in agent-platform mode', async () => {
    process.env.SMART_REPLY_PROVIDER_MODE = 'agent_platform';
    openAiProvider.generateSuggestions.mockResolvedValue(['OpenAI reply']);
    azureOpenAiProvider.generateSuggestions.mockResolvedValue([
      'Azure OpenAI reply',
    ]);
    anthropicProvider.generateSuggestions.mockResolvedValue([
      'Anthropic reply',
    ]);
    externalProvider.generateSuggestions.mockResolvedValue([]);
    templateProvider.generateSuggestions.mockReturnValue(['Template reply']);

    const result = await router.generateSuggestions({
      aiModel: 'balanced',
      request: {
        conversation: 'Need your confirmation.',
        tone: 'formal',
        length: 'long',
        count: 3,
        includeSignature: false,
      },
    });

    expect(openAiProvider.generateSuggestions).not.toHaveBeenCalled();
    expect(azureOpenAiProvider.generateSuggestions).not.toHaveBeenCalled();
    expect(anthropicProvider.generateSuggestions).not.toHaveBeenCalled();
    expect(externalProvider.generateSuggestions).toHaveBeenCalled();
    expect(templateProvider.generateSuggestions).toHaveBeenCalled();
    expect(result).toEqual({
      suggestions: ['Template reply'],
      source: 'internal',
      fallbackUsed: true,
    });
  });

  it('forces template mode regardless of aiModel preference', async () => {
    process.env.SMART_REPLY_PROVIDER_MODE = 'template';
    openAiProvider.generateSuggestions.mockResolvedValue(['OpenAI reply']);
    azureOpenAiProvider.generateSuggestions.mockResolvedValue([
      'Azure OpenAI reply',
    ]);
    anthropicProvider.generateSuggestions.mockResolvedValue([
      'Anthropic reply',
    ]);
    externalProvider.generateSuggestions.mockResolvedValue(['External reply']);
    templateProvider.generateSuggestions.mockReturnValue(['Template reply']);

    const result = await router.generateSuggestions({
      aiModel: 'advanced',
      request: {
        conversation: 'Share rollout plan update',
        tone: 'professional',
        length: 'medium',
        count: 2,
        includeSignature: false,
      },
    });

    expect(openAiProvider.generateSuggestions).not.toHaveBeenCalled();
    expect(azureOpenAiProvider.generateSuggestions).not.toHaveBeenCalled();
    expect(anthropicProvider.generateSuggestions).not.toHaveBeenCalled();
    expect(externalProvider.generateSuggestions).not.toHaveBeenCalled();
    expect(templateProvider.generateSuggestions).toHaveBeenCalled();
    expect(result).toEqual({
      suggestions: ['Template reply'],
      source: 'internal',
      fallbackUsed: false,
    });
  });

  it('uses openai mode regardless of model preference', async () => {
    process.env.SMART_REPLY_PROVIDER_MODE = 'openai';
    openAiProvider.generateSuggestions.mockResolvedValue(['OpenAI reply']);
    azureOpenAiProvider.generateSuggestions.mockResolvedValue([
      'Azure OpenAI reply',
    ]);
    anthropicProvider.generateSuggestions.mockResolvedValue([
      'Anthropic reply',
    ]);
    externalProvider.generateSuggestions.mockResolvedValue(['External reply']);
    templateProvider.generateSuggestions.mockReturnValue(['Template reply']);

    const result = await router.generateSuggestions({
      aiModel: 'balanced',
      request: {
        conversation: 'Please confirm rollout timeline.',
        tone: 'professional',
        length: 'medium',
        count: 2,
        includeSignature: false,
      },
    });

    expect(openAiProvider.generateSuggestions).toHaveBeenCalled();
    expect(azureOpenAiProvider.generateSuggestions).not.toHaveBeenCalled();
    expect(anthropicProvider.generateSuggestions).not.toHaveBeenCalled();
    expect(externalProvider.generateSuggestions).not.toHaveBeenCalled();
    expect(templateProvider.generateSuggestions).not.toHaveBeenCalled();
    expect(result).toEqual({
      suggestions: ['OpenAI reply'],
      source: 'openai',
      fallbackUsed: false,
    });
  });

  it('falls back from openai to external in hybrid mode', async () => {
    openAiProvider.generateSuggestions.mockResolvedValue([]);
    azureOpenAiProvider.generateSuggestions.mockResolvedValue([]);
    anthropicProvider.generateSuggestions.mockResolvedValue([]);
    externalProvider.generateSuggestions.mockResolvedValue(['External reply']);
    templateProvider.generateSuggestions.mockReturnValue(['Template reply']);

    const result = await router.generateSuggestions({
      aiModel: 'advanced',
      request: {
        conversation: 'Need update on escalation ticket.',
        tone: 'formal',
        length: 'short',
        count: 1,
        includeSignature: false,
      },
    });

    expect(openAiProvider.generateSuggestions).toHaveBeenCalled();
    expect(azureOpenAiProvider.generateSuggestions).toHaveBeenCalled();
    expect(anthropicProvider.generateSuggestions).toHaveBeenCalled();
    expect(externalProvider.generateSuggestions).toHaveBeenCalled();
    expect(templateProvider.generateSuggestions).not.toHaveBeenCalled();
    expect(result).toEqual({
      suggestions: ['External reply'],
      source: 'external',
      fallbackUsed: true,
    });
  });

  it('uses anthropic mode regardless of model preference', async () => {
    process.env.SMART_REPLY_PROVIDER_MODE = 'anthropic';
    openAiProvider.generateSuggestions.mockResolvedValue(['OpenAI reply']);
    azureOpenAiProvider.generateSuggestions.mockResolvedValue([
      'Azure OpenAI reply',
    ]);
    anthropicProvider.generateSuggestions.mockResolvedValue([
      'Anthropic reply',
    ]);
    externalProvider.generateSuggestions.mockResolvedValue(['External reply']);
    templateProvider.generateSuggestions.mockReturnValue(['Template reply']);

    const result = await router.generateSuggestions({
      aiModel: 'balanced',
      request: {
        conversation: 'Please align on launch owner and timeline.',
        tone: 'professional',
        length: 'medium',
        count: 2,
        includeSignature: false,
      },
    });

    expect(openAiProvider.generateSuggestions).not.toHaveBeenCalled();
    expect(azureOpenAiProvider.generateSuggestions).not.toHaveBeenCalled();
    expect(anthropicProvider.generateSuggestions).toHaveBeenCalled();
    expect(externalProvider.generateSuggestions).not.toHaveBeenCalled();
    expect(templateProvider.generateSuggestions).not.toHaveBeenCalled();
    expect(result).toEqual({
      suggestions: ['Anthropic reply'],
      source: 'anthropic',
      fallbackUsed: false,
    });
  });

  it('uses anthropic as hybrid primary when configured', async () => {
    process.env.SMART_REPLY_HYBRID_PRIMARY = 'anthropic';
    openAiProvider.generateSuggestions.mockResolvedValue(['OpenAI reply']);
    azureOpenAiProvider.generateSuggestions.mockResolvedValue([
      'Azure OpenAI reply',
    ]);
    anthropicProvider.generateSuggestions.mockResolvedValue([
      'Anthropic reply',
    ]);
    externalProvider.generateSuggestions.mockResolvedValue(['External reply']);
    templateProvider.generateSuggestions.mockReturnValue(['Template reply']);

    const result = await router.generateSuggestions({
      aiModel: 'advanced',
      request: {
        conversation: 'Please prioritize this customer escalation response.',
        tone: 'formal',
        length: 'short',
        count: 1,
        includeSignature: false,
      },
    });

    expect(anthropicProvider.generateSuggestions).toHaveBeenCalled();
    expect(openAiProvider.generateSuggestions).not.toHaveBeenCalled();
    expect(azureOpenAiProvider.generateSuggestions).not.toHaveBeenCalled();
    expect(result).toEqual({
      suggestions: ['Anthropic reply'],
      source: 'anthropic',
      fallbackUsed: false,
    });
  });

  it('uses azure_openai mode regardless of model preference', async () => {
    process.env.SMART_REPLY_PROVIDER_MODE = 'azure_openai';
    openAiProvider.generateSuggestions.mockResolvedValue(['OpenAI reply']);
    azureOpenAiProvider.generateSuggestions.mockResolvedValue([
      'Azure OpenAI reply',
    ]);
    anthropicProvider.generateSuggestions.mockResolvedValue([
      'Anthropic reply',
    ]);
    externalProvider.generateSuggestions.mockResolvedValue(['External reply']);
    templateProvider.generateSuggestions.mockReturnValue(['Template reply']);

    const result = await router.generateSuggestions({
      aiModel: 'balanced',
      request: {
        conversation: 'Please share enterprise pricing next steps.',
        tone: 'professional',
        length: 'medium',
        count: 2,
        includeSignature: false,
      },
    });

    expect(openAiProvider.generateSuggestions).not.toHaveBeenCalled();
    expect(azureOpenAiProvider.generateSuggestions).toHaveBeenCalled();
    expect(anthropicProvider.generateSuggestions).not.toHaveBeenCalled();
    expect(externalProvider.generateSuggestions).not.toHaveBeenCalled();
    expect(templateProvider.generateSuggestions).not.toHaveBeenCalled();
    expect(result).toEqual({
      suggestions: ['Azure OpenAI reply'],
      source: 'azure_openai',
      fallbackUsed: false,
    });
  });

  it('uses azure_openai as hybrid primary when configured', async () => {
    process.env.SMART_REPLY_HYBRID_PRIMARY = 'azure_openai';
    openAiProvider.generateSuggestions.mockResolvedValue(['OpenAI reply']);
    azureOpenAiProvider.generateSuggestions.mockResolvedValue([
      'Azure OpenAI reply',
    ]);
    anthropicProvider.generateSuggestions.mockResolvedValue([
      'Anthropic reply',
    ]);
    externalProvider.generateSuggestions.mockResolvedValue(['External reply']);
    templateProvider.generateSuggestions.mockReturnValue(['Template reply']);

    const result = await router.generateSuggestions({
      aiModel: 'advanced',
      request: {
        conversation: 'Need escalation response draft with crisp tone.',
        tone: 'formal',
        length: 'short',
        count: 1,
        includeSignature: false,
      },
    });

    expect(azureOpenAiProvider.generateSuggestions).toHaveBeenCalled();
    expect(openAiProvider.generateSuggestions).not.toHaveBeenCalled();
    expect(anthropicProvider.generateSuggestions).not.toHaveBeenCalled();
    expect(result).toEqual({
      suggestions: ['Azure OpenAI reply'],
      source: 'azure_openai',
      fallbackUsed: false,
    });
  });

  it('reports provider health snapshot with priorities', () => {
    process.env.SMART_REPLY_PROVIDER_MODE = 'hybrid';
    process.env.SMART_REPLY_HYBRID_PRIMARY = 'azure_openai';
    process.env.SMART_REPLY_USE_AZURE_OPENAI = 'true';
    process.env.SMART_REPLY_AZURE_OPENAI_API_KEY = 'key';
    process.env.SMART_REPLY_AZURE_OPENAI_ENDPOINT =
      'https://resource.openai.azure.com';
    process.env.SMART_REPLY_AZURE_OPENAI_DEPLOYMENT = 'mailzen-mini';

    const health = router.getProviderHealthSnapshot();
    const azureProvider = health.providers.find(
      (provider) => provider.providerId === 'azure_openai',
    );

    expect(health.mode).toBe('hybrid');
    expect(health.hybridPrimary).toBe('azure_openai');
    expect(azureProvider).toEqual(
      expect.objectContaining({
        enabled: true,
        configured: true,
        priority: 1,
      }),
    );
  });
});
