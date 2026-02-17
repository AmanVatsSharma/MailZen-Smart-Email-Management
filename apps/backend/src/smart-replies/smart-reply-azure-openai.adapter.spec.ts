/* eslint-disable @typescript-eslint/unbound-method */
import axios from 'axios';
import { SmartReplyAzureOpenAiAdapter } from './smart-reply-azure-openai.adapter';

jest.mock('axios', () => ({
  __esModule: true,
  default: { post: jest.fn() },
  post: jest.fn(),
}));

describe('SmartReplyAzureOpenAiAdapter', () => {
  let adapter: SmartReplyAzureOpenAiAdapter;
  const originalUseAzureOpenAi = process.env.SMART_REPLY_USE_AZURE_OPENAI;
  const originalApiKey = process.env.SMART_REPLY_AZURE_OPENAI_API_KEY;
  const originalEndpoint = process.env.SMART_REPLY_AZURE_OPENAI_ENDPOINT;
  const originalDeployment = process.env.SMART_REPLY_AZURE_OPENAI_DEPLOYMENT;

  beforeEach(() => {
    adapter = new SmartReplyAzureOpenAiAdapter();
    jest.clearAllMocks();
    process.env.SMART_REPLY_USE_AZURE_OPENAI = 'true';
    process.env.SMART_REPLY_AZURE_OPENAI_API_KEY = 'test-key';
    process.env.SMART_REPLY_AZURE_OPENAI_ENDPOINT =
      'https://example-resource.openai.azure.com';
    process.env.SMART_REPLY_AZURE_OPENAI_DEPLOYMENT = 'mailzen-mini';
  });

  afterAll(() => {
    if (typeof originalUseAzureOpenAi === 'string') {
      process.env.SMART_REPLY_USE_AZURE_OPENAI = originalUseAzureOpenAi;
    } else {
      delete process.env.SMART_REPLY_USE_AZURE_OPENAI;
    }
    if (typeof originalApiKey === 'string') {
      process.env.SMART_REPLY_AZURE_OPENAI_API_KEY = originalApiKey;
    } else {
      delete process.env.SMART_REPLY_AZURE_OPENAI_API_KEY;
    }
    if (typeof originalEndpoint === 'string') {
      process.env.SMART_REPLY_AZURE_OPENAI_ENDPOINT = originalEndpoint;
    } else {
      delete process.env.SMART_REPLY_AZURE_OPENAI_ENDPOINT;
    }
    if (typeof originalDeployment === 'string') {
      process.env.SMART_REPLY_AZURE_OPENAI_DEPLOYMENT = originalDeployment;
    } else {
      delete process.env.SMART_REPLY_AZURE_OPENAI_DEPLOYMENT;
    }
  });

  it('maps Azure OpenAI response into suggestions', async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              content:
                '["Thanks for the update.", "I will review and share next steps."]',
            },
          },
        ],
      },
    });

    const suggestions = await adapter.generateSuggestions({
      conversation: 'Please draft polished options.',
      count: 2,
      tone: 'professional',
      length: 'medium',
      includeSignature: false,
    });

    expect(suggestions).toEqual([
      'Thanks for the update.',
      'I will review and share next steps.',
    ]);
  });

  it('returns empty list when Azure OpenAI provider is disabled', async () => {
    process.env.SMART_REPLY_USE_AZURE_OPENAI = 'false';

    const suggestions = await adapter.generateSuggestions({
      conversation: 'Any update?',
      count: 2,
      tone: 'professional',
      length: 'short',
      includeSignature: false,
    });

    expect(suggestions).toEqual([]);
    expect(axios.post).not.toHaveBeenCalled();
  });
});
