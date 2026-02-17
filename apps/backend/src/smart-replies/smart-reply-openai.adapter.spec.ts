/* eslint-disable @typescript-eslint/unbound-method */
import axios from 'axios';
import { SmartReplyOpenAiAdapter } from './smart-reply-openai.adapter';

jest.mock('axios', () => ({
  __esModule: true,
  default: { post: jest.fn() },
  post: jest.fn(),
}));

describe('SmartReplyOpenAiAdapter', () => {
  let adapter: SmartReplyOpenAiAdapter;
  const originalUseOpenAi = process.env.SMART_REPLY_USE_OPENAI;
  const originalApiKey = process.env.SMART_REPLY_OPENAI_API_KEY;

  beforeEach(() => {
    adapter = new SmartReplyOpenAiAdapter();
    jest.clearAllMocks();
    process.env.SMART_REPLY_USE_OPENAI = 'true';
    process.env.SMART_REPLY_OPENAI_API_KEY = 'test-key';
  });

  afterAll(() => {
    if (typeof originalUseOpenAi === 'string') {
      process.env.SMART_REPLY_USE_OPENAI = originalUseOpenAi;
    } else {
      delete process.env.SMART_REPLY_USE_OPENAI;
    }
    if (typeof originalApiKey === 'string') {
      process.env.SMART_REPLY_OPENAI_API_KEY = originalApiKey;
    } else {
      delete process.env.SMART_REPLY_OPENAI_API_KEY;
    }
  });

  it('maps JSON-array response content into suggestions', async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              content:
                '["Thanks for the update.", "I will review and share feedback."]',
            },
          },
        ],
      },
    });

    const suggestions = await adapter.generateSuggestions({
      conversation: 'Please prepare response options.',
      count: 2,
      tone: 'professional',
      length: 'medium',
      includeSignature: false,
    });

    expect(suggestions).toEqual([
      'Thanks for the update.',
      'I will review and share feedback.',
    ]);
  });

  it('returns empty list when OpenAI provider is disabled', async () => {
    process.env.SMART_REPLY_USE_OPENAI = 'false';

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
