/**
 * File:        apps/backend/src/core/application/use-cases/messaging/end-warmup/end-warmup.spec.ts
 * Module:      Core · Application · Use Cases · Messaging
 * Purpose:     Spec for EndWarmupHandler.
 * Author:      AmanVatsSharma
 * Last-updated: 2026-06-13
 */
import { EndWarmupHandler } from './end-warmup.handler';
import { InMemoryEmailWarmupRepository } from '../../../../testing/in-memory-email-warmup.repository';
import { EmailWarmup } from '../../../../domain/bounded-contexts/messaging/warmup.aggregate';

describe('EndWarmupHandler', () => {
  it('marks the warm-up as completed', async () => {
    const warmups = new InMemoryEmailWarmupRepository();
    const w = EmailWarmup.start({ id: 'w1', providerId: 'p1' });
    if (!w.ok) throw new Error('seed');
    await warmups.save(w.value);
    const handler = new EndWarmupHandler(warmups);

    const result = await handler.execute({ warmupId: 'w1' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe('COMPLETED');
  });

  it('returns NotFoundError when warm-up does not exist', async () => {
    const handler = new EndWarmupHandler(new InMemoryEmailWarmupRepository());
    const result = await handler.execute({ warmupId: 'nope' });
    expect(result.ok).toBe(false);
  });
});
