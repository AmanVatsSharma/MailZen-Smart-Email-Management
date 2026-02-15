import axios from 'axios';
import { SmartReplyExternalModelAdapter } from './smart-reply-external-model.adapter';

jest.mock('axios', () => ({
  __esModule: true,
  default: { post: jest.fn() },
  post: jest.fn(),
}));

describe('SmartReplyExternalModelAdapter', () => {
  let adapter: SmartReplyExternalModelAdapter;

  beforeEach(() => {
    adapter = new SmartReplyExternalModelAdapter();
    jest.clearAllMocks();
    process.env.SMART_REPLY_USE_AGENT_PLATFORM = 'true';
  });

  afterEach(() => {
    delete process.env.SMART_REPLY_USE_AGENT_PLATFORM;
  });

  it('maps assistant text into suggestion list', async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: {
        assistantText:
          '1. Thanks for the update.\n2. I will review and revert.\n3. Can we align tomorrow?',
      },
    });

    const suggestions = await adapter.generateSuggestions({
      conversation: 'Please share your response draft',
      count: 2,
      tone: 'professional',
      length: 'medium',
    });

    expect(suggestions).toEqual([
      'Thanks for the update.',
      'I will review and revert.',
    ]);
  });

  it('returns empty list when adapter is disabled', async () => {
    process.env.SMART_REPLY_USE_AGENT_PLATFORM = 'false';

    const suggestions = await adapter.generateSuggestions({
      conversation: 'Any update?',
      count: 2,
      tone: 'professional',
      length: 'short',
    });

    expect(suggestions).toEqual([]);
  });
});
