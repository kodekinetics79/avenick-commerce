/**
 * Shared, serverless-safe read cache backed by Upstash Redis (REST API).
 *
 * Why this exists: `cache.ts` ships a well-built two-tier read-through cache
 * with stale-on-error fallback, and documents itself as "swappable for a shared
 * Upstash-backed store at bootstrap" — but that bootstrap was never written.
 * `setCacheStore()` had zero call sites, so the active store was always the
 * process-local Map.
 *
 * The consequences on serverless are worse than "no cache": with N warm
 * instances the hit rate is roughly 1/N, and — the part that matters — the
 * stale-on-error safety net only protects an instance that already served that
 * exact query. During a database incident, cold instances return errors instead
 * of stale-but-serviceable data, which is precisely when the fallback was meant
 * to earn its keep.
 *
 * Mirrors installRedisRateLimitStore(): same REST-over-fetch convention, same
 * env vars, same no-op-when-unset behaviour so local dev and the pilot keep
 * working without Redis.
 *
 * Enable by calling installRedisCacheStore() once at bootstrap with:
 *   UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 */
import { setCacheStore, type CacheEntry, type CacheStore } from "./cache";

/** Keep entries retrievable well past freshness so stale fallback still works. */
const STALE_RETENTION_SECONDS = 24 * 60 * 60;

class UpstashCacheStore implements CacheStore {
  constructor(
    private readonly url: string,
    private readonly token: string,
  ) {}

  private key(key: string): string {
    return `avenick:cache:${key}`;
  }

  async get(key: string): Promise<CacheEntry | null> {
    try {
      const res = await fetch(`${this.url}/get/${encodeURIComponent(this.key(key))}`, {
        headers: { authorization: `Bearer ${this.token}` },
        cache: "no-store",
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { result?: string | null };
      if (!body.result) return null;
      const parsed = JSON.parse(body.result) as CacheEntry;
      // Defend against a malformed or truncated entry rather than handing junk
      // back to a caller that will treat it as a cached read.
      if (typeof parsed?.value !== "string" || typeof parsed?.freshUntil !== "number") return null;
      return parsed;
    } catch {
      // A cache that throws is worse than no cache — the caller falls through
      // to the database, which is the correct outcome.
      return null;
    }
  }

  async set(key: string, entry: CacheEntry): Promise<void> {
    try {
      await fetch(`${this.url}/set/${encodeURIComponent(this.key(key))}?EX=${STALE_RETENTION_SECONDS}`, {
        method: "POST",
        headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json" },
        body: JSON.stringify(entry),
        cache: "no-store",
      });
    } catch {
      // Best-effort write. Never fail a request because the cache is down.
    }
  }
}

/**
 * Install the shared cache store when Upstash is configured.
 *
 * @returns true when the shared store was installed; false leaves the
 *          process-local store in place.
 */
export function installRedisCacheStore(): boolean {
  const url = process.env["UPSTASH_REDIS_REST_URL"]?.trim();
  const token = process.env["UPSTASH_REDIS_REST_TOKEN"]?.trim();
  if (!url || !token) return false;

  setCacheStore(new UpstashCacheStore(url, token));
  return true;
}
