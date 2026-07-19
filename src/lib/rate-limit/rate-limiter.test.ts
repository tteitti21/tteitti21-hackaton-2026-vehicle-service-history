import { describe, expect, it } from "vitest";

import { InMemoryRateLimiter } from "./rate-limiter";

const policy = { limit: 2, windowMs: 1_000 };

describe("InMemoryRateLimiter", () => {
  it("allows requests within the fixed window", () => {
    const limiter = new InMemoryRateLimiter();

    expect(limiter.consume("coarse-key", policy, 1_000)).toEqual({
      allowed: true,
      limit: 2,
      remaining: 1,
      retryAfterMs: 0,
    });
    expect(limiter.consume("coarse-key", policy, 1_001)).toEqual({
      allowed: true,
      limit: 2,
      remaining: 0,
      retryAfterMs: 0,
    });
  });

  it("blocks requests over the limit without logging their key", () => {
    const limiter = new InMemoryRateLimiter();
    limiter.consume("coarse-key", policy, 1_000);
    limiter.consume("coarse-key", policy, 1_100);

    expect(limiter.consume("coarse-key", policy, 1_250)).toEqual({
      allowed: false,
      limit: 2,
      remaining: 0,
      retryAfterMs: 750,
    });
  });

  it("starts a fresh window after expiry", () => {
    const limiter = new InMemoryRateLimiter();
    limiter.consume("coarse-key", policy, 1_000);
    limiter.consume("coarse-key", policy, 1_001);

    expect(limiter.consume("coarse-key", policy, 2_000).allowed).toBe(true);
  });

  it("keeps separate coarse keys isolated", () => {
    const limiter = new InMemoryRateLimiter();
    limiter.consume("key-a", { limit: 1, windowMs: 1_000 }, 1_000);

    expect(
      limiter.consume("key-b", { limit: 1, windowMs: 1_000 }, 1_001).allowed,
    ).toBe(true);
  });

  it("bounds memory and evicts the window that expires first", () => {
    const limiter = new InMemoryRateLimiter(2);
    limiter.consume("key-a", { limit: 1, windowMs: 500 }, 1_000);
    limiter.consume("key-b", { limit: 1, windowMs: 1_000 }, 1_000);
    limiter.consume("key-c", { limit: 1, windowMs: 1_000 }, 1_100);

    expect(
      limiter.consume("key-b", { limit: 1, windowMs: 1_000 }, 1_200).allowed,
    ).toBe(false);
    expect(
      limiter.consume("key-a", { limit: 1, windowMs: 500 }, 1_200).allowed,
    ).toBe(true);
  });

  it("removes expired windows before evicting an active one", () => {
    const limiter = new InMemoryRateLimiter(2);
    limiter.consume("expired", policy, 1_000);
    limiter.consume("active", policy, 1_900);
    limiter.consume("new", policy, 2_001);

    expect(limiter.consume("active", policy, 2_002).remaining).toBe(0);
  });

  it("rejects invalid policies", () => {
    const limiter = new InMemoryRateLimiter();

    expect(() =>
      limiter.consume("coarse-key", { limit: 0, windowMs: 1_000 }),
    ).toThrow("positive safe integer");
    expect(() => new InMemoryRateLimiter(0)).toThrow(
      "positive safe integer",
    );
  });
});
