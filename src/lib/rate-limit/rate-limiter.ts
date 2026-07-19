export interface RateLimitPolicy {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterMs: number;
}

export interface RateLimiter {
  consume(
    key: string,
    policy: RateLimitPolicy,
    now?: number,
  ): RateLimitResult;
}

interface WindowState {
  count: number;
  resetAt: number;
}

/**
 * A dependency-free, process-local fixed-window limiter for the MVP.
 *
 * It is intentionally non-persistent. In a serverless deployment each instance
 * has its own counters, so deployment-level controls are still required for
 * strong abuse prevention. Callers must provide a coarse, privacy-preserving
 * key and must never use request content as the key.
 */
export class InMemoryRateLimiter implements RateLimiter {
  private readonly windows = new Map<string, WindowState>();

  constructor(private readonly maxWindows = 10_000) {
    if (!Number.isSafeInteger(maxWindows) || maxWindows <= 0) {
      throw new Error(
        "Rate-limit maxWindows must be a positive safe integer.",
      );
    }
  }

  consume(
    key: string,
    policy: RateLimitPolicy,
    now = Date.now(),
  ): RateLimitResult {
    assertValidInput(key, policy, now);

    const current = this.windows.get(key);
    if (current === undefined) {
      this.makeRoomForNewWindow(now);
    }

    const window =
      current === undefined || now >= current.resetAt
        ? { count: 0, resetAt: now + policy.windowMs }
        : current;

    if (window.count >= policy.limit) {
      this.windows.set(key, window);

      return {
        allowed: false,
        limit: policy.limit,
        remaining: 0,
        retryAfterMs: Math.max(0, window.resetAt - now),
      };
    }

    window.count += 1;
    this.windows.set(key, window);

    return {
      allowed: true,
      limit: policy.limit,
      remaining: policy.limit - window.count,
      retryAfterMs: 0,
    };
  }

  private makeRoomForNewWindow(now: number): void {
    if (this.windows.size < this.maxWindows) {
      return;
    }

    for (const [key, window] of this.windows) {
      if (now >= window.resetAt) {
        this.windows.delete(key);
      }
    }

    if (this.windows.size < this.maxWindows) {
      return;
    }

    let oldestKey: string | null = null;
    let oldestResetAt = Number.POSITIVE_INFINITY;

    for (const [key, window] of this.windows) {
      if (window.resetAt < oldestResetAt) {
        oldestKey = key;
        oldestResetAt = window.resetAt;
      }
    }

    if (oldestKey !== null) {
      this.windows.delete(oldestKey);
    }
  }
}

function assertValidInput(
  key: string,
  policy: RateLimitPolicy,
  now: number,
): void {
  if (key.length === 0) {
    throw new Error("A non-empty rate-limit key is required.");
  }

  if (!Number.isSafeInteger(policy.limit) || policy.limit <= 0) {
    throw new Error("Rate-limit policy limit must be a positive safe integer.");
  }

  if (!Number.isSafeInteger(policy.windowMs) || policy.windowMs <= 0) {
    throw new Error(
      "Rate-limit policy windowMs must be a positive safe integer.",
    );
  }

  if (!Number.isFinite(now)) {
    throw new Error("Rate-limit time must be finite.");
  }
}
