import { describe, it, expect, vi, beforeEach } from "vitest";

// The resilience module reads config from env at import time and keeps a single
// process-wide breaker. Each test tunes behaviour via per-call config where
// possible; the breaker is shared, so tests that exercise it are ordered and
// self-healing (a success closes it again).
import { resilient, CircuitOpenError, DbTimeoutError, dbCircuitState } from "../resilience";
import { cachedRead, setCacheStore, type CacheStore, type CacheEntry } from "../cache";

// A simple in-test cache store we can inspect.
function makeStore(): CacheStore & { map: Map<string, CacheEntry> } {
  const map = new Map<string, CacheEntry>();
  return {
    map,
    async get(k) {
      return map.get(k) ?? null;
    },
    async set(k, e) {
      map.set(k, e);
    },
  };
}

describe("resilient()", () => {
  it("returns the value on success without retrying", async () => {
    const op = vi.fn().mockResolvedValue(42);
    const out = await resilient(op, { name: "t.success" });
    expect(out).toBe(42);
    expect(op).toHaveBeenCalledTimes(1);
  });

  it("retries transient errors then succeeds", async () => {
    const op = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error("conn reset"), { code: "P1017" }))
      .mockResolvedValue("ok");
    const out = await resilient(op, {
      name: "t.retry",
      config: { maxAttempts: 3, backoffMs: 1 },
    });
    expect(out).toBe("ok");
    expect(op).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry deterministic errors", async () => {
    const op = vi.fn().mockRejectedValue(Object.assign(new Error("unique violation"), { code: "P2002" }));
    await expect(resilient(op, { name: "t.noretry", config: { maxAttempts: 3, backoffMs: 1 } })).rejects.toThrow(
      /unique/,
    );
    expect(op).toHaveBeenCalledTimes(1);
  });

  it("times out a hung operation", async () => {
    const op = () => new Promise((r) => setTimeout(r, 1000));
    await expect(
      resilient(op, { name: "t.timeout", config: { timeoutMs: 20, maxAttempts: 1 } }),
    ).rejects.toBeInstanceOf(DbTimeoutError);
  });

  it("opens the circuit after the failure threshold, then fails fast", async () => {
    // The breaker is a single process-wide instance configured from env at
    // import (DEFAULTS): threshold DB_BREAKER_THRESHOLD (5), cooldown
    // DB_BREAKER_COOLDOWN_MS (10s). Per-call config tunes timeout/retries only,
    // not the shared breaker — so we drive it with its real threshold and reset
    // to a known-CLOSED state via a success first.
    await resilient(() => Promise.resolve("reset"), { name: "t.break.reset", config: { maxAttempts: 1 } });
    expect(dbCircuitState()).toBe("CLOSED");

    const boom = () => Promise.reject(Object.assign(new Error("down"), { code: "P1001" }));
    const THRESHOLD = Number(process.env.DB_BREAKER_THRESHOLD ?? 5);
    // `threshold` consecutive failures → breaker opens.
    for (let i = 0; i < THRESHOLD; i++) {
      await expect(resilient(boom, { name: "t.break", config: { maxAttempts: 1 } })).rejects.toThrow(/down/);
    }
    expect(dbCircuitState()).toBe("OPEN");

    // Next call fails fast with CircuitOpenError (op not even invoked).
    const op = vi.fn().mockResolvedValue("nope");
    await expect(resilient(op, { name: "t.break", config: { maxAttempts: 1 } })).rejects.toBeInstanceOf(
      CircuitOpenError,
    );
    expect(op).not.toHaveBeenCalled();
  });
});

describe("cachedRead()", () => {
  beforeEach(() => setCacheStore(makeStore()));

  it("serves fresh from cache without calling the loader", async () => {
    const store = makeStore();
    setCacheStore(store);
    const loader = vi.fn().mockResolvedValue({ v: 1 });
    // First call populates the cache.
    await cachedRead(loader, { key: "k", ttlMs: 1000 });
    // Second call within TTL is a fresh hit.
    const out = await cachedRead(loader, { key: "k", ttlMs: 1000 });
    expect(out).toEqual({ data: { v: 1 }, stale: false });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("serves stale data when the loader fails after a prior success", async () => {
    const store = makeStore();
    setCacheStore(store);
    const loader = vi
      .fn()
      .mockResolvedValueOnce({ v: "good" })
      .mockRejectedValue(new Error("db down"));
    // Prime cache, then let it go stale.
    await cachedRead(loader, { key: "k", ttlMs: 1 });
    await new Promise((r) => setTimeout(r, 5));
    // Loader now fails → stale fallback.
    const out = await cachedRead(loader, { key: "k", ttlMs: 1 });
    expect(out.stale).toBe(true);
    expect(out.data).toEqual({ v: "good" });
  });

  it("rethrows when the loader fails and no cached value exists", async () => {
    setCacheStore(makeStore());
    const loader = vi.fn().mockRejectedValue(new Error("db down"));
    await expect(cachedRead(loader, { key: "cold", ttlMs: 1000 })).rejects.toThrow(/db down/);
  });

  it("does not serve stale when serveStaleOnError is false", async () => {
    const store = makeStore();
    setCacheStore(store);
    const loader = vi.fn().mockResolvedValueOnce({ v: 1 }).mockRejectedValue(new Error("down"));
    await cachedRead(loader, { key: "k", ttlMs: 1 });
    await new Promise((r) => setTimeout(r, 5));
    await expect(
      cachedRead(loader, { key: "k", ttlMs: 1, serveStaleOnError: false }),
    ).rejects.toThrow(/down/);
  });
});
