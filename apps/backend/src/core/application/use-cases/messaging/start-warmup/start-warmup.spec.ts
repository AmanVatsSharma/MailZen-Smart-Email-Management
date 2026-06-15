/**
 * File:        apps/backend/src/core/application/use-cases/messaging/start-warmup/start-warmup.spec.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     Spec for StartWarmupHandler.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { StartWarmupHandler } from './start-warmup.handler';
import { InMemoryEmailWarmupRepository } from '../../../../testing/in-memory-email-warmup.repository';
import { EmailWarmup } from '../../../../domain/bounded-contexts/messaging/warmup.aggregate';

describe('StartWarmupHandler', () => {
  it('starts a new warm-up for a provider', async () => {
    const warmups = new InMemoryEmailWarmupRepository();
    const handler = new StartWarmupHandler(warmups);

    const result = await handler.execute({ providerId: 'p1' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe('ACTIVE');
  });

  it('rejects starting a warm-up with invalid config', async () => {
    const handler = new StartWarmupHandler(new InMemoryEmailWarmupRepository());
    const result = await handler.execute({ providerId: 'p1', config: { dailyIncrement: 0, maxDailyEmails: 100, minimumInterval: 15, targetOpenRate: 80 } });
    expect(result.ok).toBe(false);
  });

  it('returns ConflictError when a warm-up already exists for the provider', async () => {
    const warmups = new InMemoryEmailWarmupRepository();
    const w = EmailWarmup.start({ id: 'w1', providerId: 'p1' });
    if (!w.ok) throw new Error('seed');
    await warmups.save(w.value);
    const handler = new StartWarmupHandler(warmups);

    const result = await handler.execute({ providerId: 'p1' });
    expect(result.ok).toBe(false);
  });
});
