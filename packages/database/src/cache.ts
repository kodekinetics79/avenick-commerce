/**
 * Pluggable read-through cache used as the fallback tier for resilient reads.
 *
 * Two roles:
 *   1. Fast path — a short-TTL cache in front of hot, expensive reads (catalog
 *      listings) to cut DB load and latency.
 *   2. Safety net — when the DB is unavailable (circuit open, timeout), a read
 *      can serve the last cached value: "stale but available" beats a 500. Stale
 *      fallbacks are marked so callers/telemetry know the data may be old.
 *
 * The store interface mirrors @avenick/auth's RateLimitStore convention: an
 * in-memory default that always works, swappable for a shared Upstash-backed
 * store at bootstrap so the cache is warm across serverless instances. No SDK,
 * fetch-over-HTTP only — same as the rest of this codebase.
 */
import { recordEvent } from "@avenick/observability";

export interface CacheEntry {
  /** JSON-serialised value. */
  value: string;
  /** Epoch ms when this entry becomes stale (still usable as fallback). */
  freshUntil: number;
}

export interface CacheStore {
  get(key: string): Promise<CacheEntry | null>;
  set(key: string, entry: CacheEntry): Promise<void>;
}

/** Process-local cache. Works everywhere; not shared across instances. */
class MemoryCacheStore implements CacheStore {
  private map = new Map<string, CacheEntry>();
  private lastSweep = Date.now();

  async get(key: string): Promise<CacheEntry | null> {
    return this.map.get(key) ?? null;
  }

  async set(key: string, entry: CacheEntry): Promise<void> {
    // Opportunistic cleanup of entries stale for well over an hour.
    const now = Date.now();
    if (now - this.lastSweep > 60_000) {
      this.lastSweep = now;
      for (const [k, v] of this.map) {
        if (v.freshUntil + 3_600_000 < now) this.map.delete(k);
      }
    }
    this.map.set(key, entry);
  }
}

let store: CacheStore = new MemoryCacheStore();

/** Swap in a shared cache store (e.g. Upstash) at bootstrap. */
export function setCacheStore(next: CacheStore): void {
  store = next;
}

export interface CachedReadOptions {
  /** Cache key — include all query params that affect the result. */
  key: string;
  /** How long the value is considered fresh, in ms. */
  ttlMs: number;
  /**
   * When true (default), on loader failure a stale cached value is returned if
   * present. Set false for reads that must never serve stale data.
   */
  serveStaleOnError?: boolean;
}

export interface CachedResult<T> {
  data: T;
  /** True when this value came from cache after the loader failed. */
  stale: boolean;
}

/**
 * Read-through cache with stale-on-error fallback. Returns fresh data from the
 * loader (and refreshes the cache); on a miss serves the loader; if the loader
 * throws, serves the last cached value when allowed, otherwise rethrows.
 */
export async function cachedRead<T>(
  loader: () => Promise<T>,
  opts: CachedReadOptions,
): Promise<CachedResult<T>> {
  const serveStale = opts.serveStaleOnError ?? true;
  const now = Date.now();
  const cached = await store.get(opts.key).catch(() => null);

  // Fresh hit — serve without touching the DB.
  if (cached && cached.freshUntil > now) {
    recordEvent("cache.hit", { key: opts.key });
    return { data: JSON.parse(cached.value) as T, stale: false };
  }

  try {
    const data = await loader();
    await store
      .set(opts.key, { value: JSON.stringify(data), freshUntil: now + opts.ttlMs })
      .catch(() => {});
    recordEvent("cache.refresh", { key: opts.key });
    return { data, stale: false };
  } catch (err) {
    if (serveStale && cached) {
      // DB failed but we have a prior value — degrade to stale rather than 500.
      recordEvent("cache.stale_fallback", { key: opts.key });
      return { data: JSON.parse(cached.value) as T, stale: true };
    }
    throw err;
  }
}
