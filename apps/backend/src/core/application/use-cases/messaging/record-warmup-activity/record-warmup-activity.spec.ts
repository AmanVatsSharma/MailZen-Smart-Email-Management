/**
 * File:        apps/backend/src/core/application/use-cases/messaging/record-warmup-activity/record-warmup-activity.spec.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     Spec for RecordWarmupActivityHandler.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { RecordWarmupActivityHandler } from './record-warmup-activity.handler';
import { InMemoryEmailWarmupRepository } from '../../../../../testing/in-memory-email-warmup.repository';
import { EmailWarmup } from '../../../../../domain/bounded-contexts/messaging/warmup.aggregate';

describe('RecordWarmupActivityHandler', () => {
  it('records activity and persists the updated warmup', async () => {
    const warmups = new InMemoryEmailWarmupRepository();
    const w = EmailWarmup.start({ id: 'w1', providerId: 'p1' });
    if (!w.ok) throw new Error('seed');
    await warmups.save(w.value);
    const handler = new RecordWarmupActivityHandler(warmups);

    const result = await handler.execute({ warmupId: 'w1', emailsSent: 5, openRate: 90 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.currentDailyLimit).toBeGreaterThan(0);
  });

  it('rejects an out-of-range openRate', async () => {
    const handler = new RecordWarmupActivityHandler(new InMemoryEmailWarmupRepository());
    const result = await handler.execute({ warmupId: 'w1', emailsSent: 0, openRate: 150 });
    expect(result.ok).toBe(false);
  });
});
