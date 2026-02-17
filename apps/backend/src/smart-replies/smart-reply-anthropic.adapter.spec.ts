/* eslint-disable @typescript-eslint/unbound-method */
import axios from 'axios';
import { SmartReplyAnthropicAdapter } from './smart-reply-anthropic.adapter';

jest.mock('axios', () => ({
  __esModule: true,
  default: { post: jest.fn() },
  post: jest.fn(),
}));

describe('SmartReplyAnthropicAdapter', () => {
  let adapter: SmartReplyAnthropicAdapter;
  const originalUseAnthropic = process.env.SMART_REPLY_USE_ANTHROPIC;
  const originalApiKey = process.env.SMART_REPLY_ANTHROPIC_API_KEY;

  beforeEach(() => {
    adapter = new SmartReplyAnthropicAdapter();
    jest.clearAllMocks();
    process.env.SMART_REPLY_USE_ANTHROPIC = 'true';
    process.env.SMART_REPLY_ANTHROPIC_API_KEY = 'test-key';
  });

  afterAll(() => {
    if (typeof originalUseAnthropic === 'string') {
      process.env.SMART_REPLY_USE_ANTHROPIC = originalUseAnthropic;
    } else {
      delete process.env.SMART_REPLY_USE_ANTHROPIC;
    }
    if (typeof originalApiKey === 'string') {
      process.env.SMART_REPLY_ANTHROPIC_API_KEY = originalApiKey;
    } else {
      delete process.env.SMART_REPLY_ANTHROPIC_API_KEY;
    }
  });

  it('maps anthropic response blocks into suggestion list', async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: {
        content: [
          {
            type: 'text',
            text: '["Thanks for sharing the details.", "I will review and revert with next steps."]',
          },
        ],
      },
    });

    const suggestions = await adapter.generateSuggestions({
      conversation: 'Need polished reply options.',
      count: 2,
      tone: 'professional',
      length: 'medium',
      includeSignature: false,
    });

    expect(suggestions).toEqual([
      'Thanks for sharing the details.',
      'I will review and revert with next steps.',
    ]);
  });

  it('returns empty list when anthropic provider is disabled', async () => {
    process.env.SMART_REPLY_USE_ANTHROPIC = 'false';

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
