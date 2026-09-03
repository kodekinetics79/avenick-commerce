/**
 * Ergonomic entry points that compose the resilience primitive with the cache.
 * These are what services/routes should call instead of hitting `db` directly
 * on the paths that matter for uptime.
 *
 *   read()  — resilient (timeout+retry+breaker) AND, when a cache key is given,
 *             serves last-known-good data if the DB is unavailable. For catalog
 *             browse, search, category pages: the pages that must stay up.
 *   write() — resilient (timeout+breaker) and FAIL-FAST: no retry, never cached,
 *             never falling back. Orders, payments, inventory mutations: these
 *             must error loudly rather than pretend to succeed. A caller whose
 *             operation is genuinely idempotent can opt back into retry per
 *             call with `idempotent: true`.
 *
 * Reads without a cache key still get timeout/retry/breaker protection — you
 * just don't get a stale fallback (there is nothing to fall back to).
 */
import { resilient, type PerCallConfig, type ResilientOptions } from "./resilience";
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

export interface WriteOptions extends ResilientOptions {
  /**
   * Opt in to transient retry for THIS call. Only set it when re-running the
   * operation from scratch is harmless — it is guarded by a unique key, an
   * idempotency fence, or is a pure upsert. It is not enough that the operation
   * "usually" fails cleanly: see the note on `write()` for why.
   */
  idempotent?: boolean;
}

/** Read a positive integer from the environment, as client.ts does. */
function envInt(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * The per-attempt timeout writes get when the caller does not pick one.
 *
 * `DB_TIMEOUT_MS` (4000) is shorter than the interactive-transaction budget, so a
 * slow transaction lost the race here while Postgres was still perfectly willing
 * to commit it — telling the customer their order failed while the order was
 * still being written. Writes therefore wait out the transaction's own deadline
 * plus a margin: a timeout on this path means the database has already given up,
 * not that we stopped watching.
 *
 * That budget is BOTH halves of what client.ts configures — `DB_TX_MAX_WAIT_MS`
 * (queuing for a pooled connection) and then `DB_TX_TIMEOUT_MS` (running the
 * body). Waiting out only the second leaves the original window open for any
 * write that queued first, which under pool exhaustion is precisely the write
 * most likely to be slow. An explicit per-call `timeoutMs` is honoured verbatim.
 */
const WRITE_TIMEOUT_MS =
  envInt("DB_TX_MAX_WAIT_MS", 2_000) + envInt("DB_TX_TIMEOUT_MS", 5_000) + 500;

/**
 * Resilient write. Timeout + circuit breaker, but no retry, no cache and no
 * fallback: on failure it throws so the caller returns a real error. Use for
 * every state mutation (orders, payments, inventory).
 *
 * No retry is the whole point. The timeout is a `Promise.race`, which rejects
 * our promise but cannot cancel the statement already running inside Postgres,
 * so retrying a write that has only *appeared* to fail starts a second copy of
 * it alongside the first — two order transactions, each holding a pooled
 * connection, during exactly the overload the breaker exists to relieve. A
 * caller that can prove re-running is safe passes `idempotent: true`.
 */
export async function write<T>(op: () => Promise<T>, opts: WriteOptions): Promise<T> {
  const config: Partial<PerCallConfig> = {
    timeoutMs: WRITE_TIMEOUT_MS,
    ...definedKnobs(opts.config),
    ...(opts.idempotent ? {} : { maxAttempts: 1 }),
  };
  return resilient(op, { name: opts.name, config });
}

/**
 * Drop knobs explicitly passed as `undefined`. They are assignable here, and
 * spreading one over the resilience defaults would leave e.g. `maxAttempts:
 * undefined` — a retry loop that never runs a single attempt.
 */
function definedKnobs(config: Partial<PerCallConfig> = {}): Partial<PerCallConfig> {
  return Object.fromEntries(
    Object.entries(config).filter(([, value]) => value !== undefined),
  ) as Partial<PerCallConfig>;
}
