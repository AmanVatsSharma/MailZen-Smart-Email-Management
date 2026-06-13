/**
 * File:        apps/backend/src/core/application/use-cases/billing/consume-ai-credits/consume-ai-credits.spec.ts
 * Module:      Billing Use Cases
 * Purpose:     Tests for ConsumeAiCredits use case
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */

import { ConsumeAiCreditsHandler } from './consume-ai-credits.handler';
import { ConsumeAiCreditsCommand } from './consume-ai-credits.command';

class FakeBurner {
  async consumeCredits() { return { isOk: () => true, value: { allowed: true, remainingCredits: 100 } }; }
}

describe('ConsumeAiCreditsHandler', () => {
  let handler: ConsumeAiCreditsHandler;
  let burner: FakeBurner;

  beforeEach(() => {
    burner = new FakeBurner();
    handler = new ConsumeAiCreditsHandler(burner as any);
  });

  it('should consume credits', async () => {
    const result = await handler.execute(new ConsumeAiCreditsCommand({ userId: 'u1', amount: 5 }));
    expect(result.isOk()).toBe(true);
    expect(result.value?.allowed).toBe(true);
  });
});
