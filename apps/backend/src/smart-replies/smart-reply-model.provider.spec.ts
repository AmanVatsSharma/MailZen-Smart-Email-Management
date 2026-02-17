import { SmartReplyModelProvider } from './smart-reply-model.provider';

describe('SmartReplyModelProvider', () => {
  let provider: SmartReplyModelProvider;

  beforeEach(() => {
    provider = new SmartReplyModelProvider();
  });

  it('returns deterministic suggestions for same input', () => {
    const input = {
      conversation: 'Can we schedule the launch review for tomorrow?',
      tone: 'professional',
      length: 'medium',
      count: 2,
      includeSignature: false,
      customInstructions: null,
    };

    const first = provider.generateSuggestions(input);
    const second = provider.generateSuggestions(input);

    expect(first).toEqual(second);
    expect(first.length).toBe(2);
  });

  it('applies short length and signature options', () => {
    const suggestions = provider.generateSuggestions({
      conversation: 'Please share a status update for the rollout.',
      tone: 'friendly',
      length: 'short',
      count: 1,
      includeSignature: true,
      customInstructions: null,
    });

    expect(suggestions[0]).toContain('Best regards');
  });
});
