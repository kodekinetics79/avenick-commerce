/**
 * Ergonomic entry points that compose the resilience primitive with the cache.
 * These are what services/routes should call instead of hitting `db` directly
 * on the paths that matter for uptime.
 *
 *   read()  — resilient (timeout+retry+breaker) AND, when a cache key is given,
 *             serves last-known-good data if the DB is unavailable. For catalog
 *             browse, search, category pages: the pages that must stay up.
 *   write() — resilient (timeout+retry+breaker) but FAIL-FAST, never cached,
 *             never falling back. Orders, payments, inventory mutations: these
 *             must error loudly rather than pretend to succeed.
 *
 * Reads without a cache key still get timeout/retry/breaker protection — you
 * just don't get a stale fallback (there is nothing to fall back to).
 */
import { resilient, type ResilientOptions } from "./resilience";
import { cachedRead, type CachedResult } from "./cache";

export interface ReadOptions extends ResilientOptions {
  /** Enable stale-on-failure fallback by giving a stable cache key + TTL. */
  cache?: { key: string; ttlMs: number; serveStaleOnError?: boolean };
}

/**
 * Resilient read. With `cache`, wraps the resilient loader in a read-through
 * cache so a DB outage degrades to stale-but-available instead of a 500.
 * Returns `{ data, stale }`; `stale` is true when the value came from cache
 * after the DB failed — surface it (e.g. a "showing cached data" banner or a
 * response header) so nobody mistakes stale data for live.
 */
export async function read<T>(loader: () => Promise<T>, opts: ReadOptions): Promise<CachedResult<T>> {
  const run = () => resilient(loader, { name: opts.name, config: opts.config });
  if (opts.cache) {
    return cachedRead(run, {
      key: opts.cache.key,
      ttlMs: opts.cache.ttlMs,
      serveStaleOnError: opts.cache.serveStaleOnError,
    });
  }
  return { data: await run(), stale: false };
}

/**
 * Resilient write. Timeout + transient-retry + circuit breaker, but no cache and
 * no fallback: on failure it throws so the caller returns a real error. Use for
 * every state mutation (orders, payments, inventory).
 */
export async function write<T>(op: () => Promise<T>, opts: ResilientOptions): Promise<T> {
  return resilient(op, opts);
}
