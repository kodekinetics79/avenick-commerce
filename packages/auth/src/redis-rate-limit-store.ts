/**
 * Shared, serverless-safe rate-limit store backed by Upstash Redis (REST API).
 *
 * Why REST and not a Redis socket: the portals run on serverless/Fluid Compute
 * where many instances handle requests concurrently. The default in-memory
 * store counts per instance, so limits reset on cold start and an attacker gets
 * N × the limit across instances — i.e. login/register/order throttling is
 * effectively bypassable. A shared store fixes that. The REST client needs no
 * dependency and no persistent socket, matching this codebase's no-SDK,
 * fetch-over-HTTP convention (see email.ts / ai.ts).
 *
 * Enable by calling installRedisRateLimitStore() once at bootstrap and setting:
 *   UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 * When unset, this no-ops and the in-memory store remains in effect, so local
 * dev and the pilot keep working without Redis.
 */
import { setRateLimitStore, type RateLimitStore } from "./rate-limit";

class UpstashRestStore implements RateLimitStore {
  constructor(
    private readonly url: string,
    private readonly token: string,
  ) {}

  private async pipeline(commands: string[][]): Promise<Array<{ result?: unknown; error?: string }>> {
    const res = await fetch(`${this.url}/pipeline`, {
      method: "POST",
      headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json" },
      body: JSON.stringify(commands),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Upstash pipeline failed: ${res.status}`);
    return (await res.json()) as Array<{ result?: unknown; error?: string }>;
  }

  async incr(key: string, windowMs: number): Promise<{ count: number; resetAt: number }> {
    const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
    // Atomic fixed-window: INCR the counter, and on first hit set its TTL.
    // PTTL tells us when the window resets. One round-trip via pipeline.
    const [incrRes, , pttlRes] = await this.pipeline([
      ["INCR", key],
      ["EXPIRE", key, String(windowSec), "NX"],
      ["PTTL", key],
    ]);

    const count = Number(incrRes?.result ?? 1);
    const pttl = Number(pttlRes?.result ?? windowMs);
    // PTTL returns -1 (no expiry) / -2 (missing) in edge cases; fall back to full window.
    const remaining = pttl > 0 ? pttl : windowMs;
    return { count, resetAt: Date.now() + remaining };
  }
}

/**
 * Install the Redis-backed store if Upstash credentials are present.
 * Returns true if installed, false if it fell back to in-memory. Safe to call
 * more than once. Failures to reach Redis surface at request time as the
 * limiter's own error handling, never at bootstrap.
 */
export function installRedisRateLimitStore(): boolean {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return false;
  setRateLimitStore(new UpstashRestStore(url, token));
  return true;
}
