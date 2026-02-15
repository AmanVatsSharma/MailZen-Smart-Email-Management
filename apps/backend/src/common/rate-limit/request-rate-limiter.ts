type RateLimitState = {
  count: number;
  windowStartMs: number;
};

type RequestRateLimiterOptions = {
  windowMs: number;
  maxRequests: number;
  maxKeys?: number;
};

type ConsumeResult = {
  allowed: boolean;
  count: number;
  remaining: number;
  retryAfterSeconds: number;
};

const DEFAULT_MAX_KEYS = 50_000;

export class RequestRateLimiter {
  private readonly counters = new Map<string, RateLimitState>();
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly maxKeys: number;

  constructor(input: RequestRateLimiterOptions) {
    this.windowMs = this.normalizePositiveInteger(input.windowMs, 60_000);
    this.maxRequests = this.normalizePositiveInteger(input.maxRequests, 300);
    this.maxKeys = this.normalizePositiveInteger(
      input.maxKeys ?? DEFAULT_MAX_KEYS,
      DEFAULT_MAX_KEYS,
    );
  }

  consume(key: string, nowMs: number = Date.now()): ConsumeResult {
    const normalizedKey = String(key || '').trim();
    if (!normalizedKey) {
      return {
        allowed: true,
        count: 0,
        remaining: this.maxRequests,
        retryAfterSeconds: 0,
      };
    }
    const normalizedNowMs = Number.isFinite(nowMs) ? nowMs : Date.now();
    const existingState = this.counters.get(normalizedKey);
    const shouldResetWindow =
      !existingState ||
      normalizedNowMs - existingState.windowStartMs >= this.windowMs;
    const state: RateLimitState = shouldResetWindow
      ? {
          count: 0,
          windowStartMs: normalizedNowMs,
        }
      : existingState;

    state.count += 1;
    this.counters.set(normalizedKey, state);
    this.compactIfNeeded(normalizedNowMs);

    const remaining = Math.max(this.maxRequests - state.count, 0);
    if (state.count <= this.maxRequests) {
      return {
        allowed: true,
        count: state.count,
        remaining,
        retryAfterSeconds: 0,
      };
    }

    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((state.windowStartMs + this.windowMs - normalizedNowMs) / 1000),
    );
    return {
      allowed: false,
      count: state.count,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  private compactIfNeeded(nowMs: number): void {
    if (this.counters.size <= this.maxKeys) return;
    for (const [key, state] of this.counters.entries()) {
      if (nowMs - state.windowStartMs < this.windowMs) continue;
      this.counters.delete(key);
      if (this.counters.size <= this.maxKeys) return;
    }
  }

  private normalizePositiveInteger(value: number, fallback: number): number {
    if (!Number.isFinite(value)) return fallback;
    const normalizedValue = Math.floor(value);
    if (normalizedValue < 1) return fallback;
    return normalizedValue;
  }
}
