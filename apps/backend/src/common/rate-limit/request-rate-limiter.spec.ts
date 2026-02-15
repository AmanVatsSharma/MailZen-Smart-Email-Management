import { RequestRateLimiter } from './request-rate-limiter';

describe('RequestRateLimiter', () => {
  it('allows requests below the threshold', () => {
    const limiter = new RequestRateLimiter({
      windowMs: 60_000,
      maxRequests: 2,
    });
    const first = limiter.consume('user:1:/graphql', 1_000);
    const second = limiter.consume('user:1:/graphql', 1_500);

    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(1);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(0);
  });

  it('blocks requests above threshold and returns retry-after', () => {
    const limiter = new RequestRateLimiter({
      windowMs: 10_000,
      maxRequests: 1,
    });
    limiter.consume('ip:127.0.0.1:/graphql', 10_000);
    const blocked = limiter.consume('ip:127.0.0.1:/graphql', 11_000);

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(blocked.remaining).toBe(0);
  });

  it('resets counters after window elapses', () => {
    const limiter = new RequestRateLimiter({
      windowMs: 5_000,
      maxRequests: 1,
    });
    limiter.consume('ip:127.0.0.1:/graphql', 20_000);
    const afterWindow = limiter.consume('ip:127.0.0.1:/graphql', 26_000);

    expect(afterWindow.allowed).toBe(true);
    expect(afterWindow.count).toBe(1);
    expect(afterWindow.remaining).toBe(0);
  });
});
