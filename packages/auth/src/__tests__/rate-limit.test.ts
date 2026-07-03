import { describe, it, expect } from "vitest";
import { checkRateLimit, clientIpFrom, type RateLimitRule } from "../rate-limit";

const rule = (name: string, limit: number, windowMs = 60_000): RateLimitRule => ({ name, limit, windowMs });

describe("checkRateLimit", () => {
  it("allows up to the limit and then blocks", async () => {
    const r = rule("t-basic", 3);
    expect((await checkRateLimit(r, "a")).ok).toBe(true);
    expect((await checkRateLimit(r, "a")).ok).toBe(true);
    expect((await checkRateLimit(r, "a")).ok).toBe(true);
    const fourth = await checkRateLimit(r, "a");
    expect(fourth.ok).toBe(false);
    expect(fourth.count).toBe(4);
    expect(fourth.limit).toBe(3);
  });

  it("tracks identifiers independently", async () => {
    const r = rule("t-ident", 1);
    expect((await checkRateLimit(r, "x")).ok).toBe(true);
    expect((await checkRateLimit(r, "x")).ok).toBe(false);
    expect((await checkRateLimit(r, "y")).ok).toBe(true);
  });

  it("tracks buckets independently for the same identifier", async () => {
    expect((await checkRateLimit(rule("t-b1", 1), "same")).ok).toBe(true);
    expect((await checkRateLimit(rule("t-b2", 1), "same")).ok).toBe(true);
  });

  it("resets after the window elapses", async () => {
    const r = rule("t-window", 1, 30);
    expect((await checkRateLimit(r, "w")).ok).toBe(true);
    expect((await checkRateLimit(r, "w")).ok).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect((await checkRateLimit(r, "w")).ok).toBe(true);
  });

  it("reports a reset time in the future", async () => {
    const res = await checkRateLimit(rule("t-reset", 5), "r");
    expect(res.resetAt).toBeGreaterThan(Date.now());
  });
});

describe("clientIpFrom", () => {
  it("takes the first x-forwarded-for entry", () => {
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }))).toBe("203.0.113.9");
  });

  it("falls back to x-real-ip then to 'unknown'", () => {
    expect(clientIpFrom(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIpFrom(new Headers())).toBe("unknown");
  });
});
