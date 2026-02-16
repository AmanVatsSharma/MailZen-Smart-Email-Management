/* eslint-disable @typescript-eslint/unbound-method */
import { SmartReplyExternalModelAdapter } from './smart-reply-external-model.adapter';
import { SmartReplyModelProvider } from './smart-reply-model.provider';
import { SmartReplyProviderRouter } from './smart-reply-provider.router';

describe('SmartReplyProviderRouter', () => {
  let router: SmartReplyProviderRouter;
  const templateProvider: jest.Mocked<SmartReplyModelProvider> = {
    providerId: 'template',
    generateSuggestions: jest.fn(),
  } as unknown as jest.Mocked<SmartReplyModelProvider>;
  const externalProvider: jest.Mocked<SmartReplyExternalModelAdapter> = {
    providerId: 'agent-platform',
    generateSuggestions: jest.fn(),
  } as unknown as jest.Mocked<SmartReplyExternalModelAdapter>;
  const originalMode = process.env.SMART_REPLY_PROVIDER_MODE;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.SMART_REPLY_PROVIDER_MODE;
    router = new SmartReplyProviderRouter(templateProvider, externalProvider);
  });

  afterAll(() => {
    if (typeof originalMode === 'string') {
      process.env.SMART_REPLY_PROVIDER_MODE = originalMode;
      return;
    }
    delete process.env.SMART_REPLY_PROVIDER_MODE;
  });

  it('uses external provider first in hybrid mode for advanced model', async () => {
    externalProvider.generateSuggestions.mockResolvedValue(['External reply']);
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

    expect(externalProvider.generateSuggestions).toHaveBeenCalled();
    expect(templateProvider.generateSuggestions).not.toHaveBeenCalled();
    expect(result).toEqual({
      suggestions: ['External reply'],
      source: 'external',
      fallbackUsed: false,
    });
  });

  it('uses template provider in hybrid mode for balanced model', async () => {
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

    expect(externalProvider.generateSuggestions).not.toHaveBeenCalled();
    expect(templateProvider.generateSuggestions).toHaveBeenCalled();
    expect(result).toEqual({
      suggestions: ['Template reply'],
      source: 'internal',
      fallbackUsed: false,
    });
  });
});
