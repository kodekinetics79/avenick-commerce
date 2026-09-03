import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { installRedisCacheStore } from "../redis-cache-store";

describe("shared read cache installation", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });
  afterEach(() => { process.env = { ...saved }; });

  it("no-ops when Upstash is not configured, leaving the local store in place", () => {
    // Local dev and the pilot must keep working without Redis.
    expect(installRedisCacheStore()).toBe(false);
  });

  it("no-ops when only one of the two variables is set", () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    expect(installRedisCacheStore()).toBe(false);

    delete process.env.UPSTASH_REDIS_REST_URL;
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    expect(installRedisCacheStore()).toBe(false);
  });

  it("installs the shared store when both are configured", () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    expect(installRedisCacheStore()).toBe(true);
  });

  it("treats whitespace-only configuration as unset", () => {
    process.env.UPSTASH_REDIS_REST_URL = "   ";
    process.env.UPSTASH_REDIS_REST_TOKEN = "   ";
    expect(installRedisCacheStore()).toBe(false);
  });
});
