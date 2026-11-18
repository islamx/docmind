export interface RateLimitResult {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly retryAfterSec: number;
}

export interface RateLimiter {
  check(key: string): RateLimitResult;
}

/**
 * Fixed-window limiter, in memory. Serverless instances do not share memory, so this is a
 * best-effort guard against a single client hammering one instance, not a global quota.
 * A shared store (Redis/KV) is the upgrade path; the interface stays the same.
 */
export function createRateLimiter(options: { limit: number; windowMs: number; now?: () => number }): RateLimiter {
  const { limit, windowMs, now = Date.now } = options;
  const windows = new Map<string, { start: number; count: number }>();

  return {
    check(key) {
      const t = now();
      if (windows.size > 5000) {
        for (const [k, w] of windows) if (t - w.start >= windowMs) windows.delete(k);
      }
      let w = windows.get(key);
      if (!w || t - w.start >= windowMs) {
        w = { start: t, count: 0 };
        windows.set(key, w);
      }
      w.count++;
      const retryAfterSec = Math.max(1, Math.ceil((w.start + windowMs - t) / 1000));
      return { allowed: w.count <= limit, remaining: Math.max(0, limit - w.count), retryAfterSec };
    },
  };
}
