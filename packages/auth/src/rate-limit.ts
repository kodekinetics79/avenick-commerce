/**
 * Lightweight fixed-window rate limiter.
 *
 * The default store is in-memory: correct per server instance, zero
 * dependencies, and safe in every runtime (Node, Edge, tests). On serverless
 * this still throttles bursts because instances are reused across requests.
 * For globally-consistent limits in production, plug in a Redis-backed
 * RateLimitStore (e.g. Upstash) via `setRateLimitStore()` at bootstrap.
 */

export interface RateLimitResult {
  /** True when the request is allowed. */
  ok: boolean;
  /** Requests already used in the current window (including this one). */
  count: number;
  /** Maximum allowed per window. */
  limit: number;
  /** Epoch ms when the current window resets. */
  resetAt: number;
}

export interface RateLimitStore {
  /** Increment `key` and return the new count plus the window's reset time. */
  incr(key: string, windowMs: number): Promise<{ count: number; resetAt: number }>;
}

class MemoryStore implements RateLimitStore {
  private buckets = new Map<string, { count: number; resetAt: number }>();
  private lastSweep = Date.now();

  async incr(key: string, windowMs: number) {
    const now = Date.now();
    // Opportunistic cleanup so the map can't grow unbounded.
    if (now - this.lastSweep > 60_000) {
      this.lastSweep = now;
      for (const [k, v] of this.buckets) if (v.resetAt <= now) this.buckets.delete(k);
    }
    const existing = this.buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      const fresh = { count: 1, resetAt: now + windowMs };
      this.buckets.set(key, fresh);
      return fresh;
    }
    existing.count += 1;
    return existing;
  }
}

let store: RateLimitStore = new MemoryStore();

/** Swap in a shared store (e.g. Redis) at application bootstrap. */
export function setRateLimitStore(s: RateLimitStore) {
  store = s;
}

export interface RateLimitRule {
  /** Logical bucket, e.g. "login", "order-create". */
  name: string;
  /** Max requests per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

/** Common rules used across the portals. */
export const RATE_LIMITS = {
  /** Credential sign-in attempts per identifier. */
  login: { name: "login", limit: 10, windowMs: 15 * 60_000 },
  /** Sign-in attempts per client IP (covers many identifiers). */
  loginIp: { name: "login-ip", limit: 30, windowMs: 15 * 60_000 },
  /** Account registrations per client IP. */
  register: { name: "register", limit: 5, windowMs: 60 * 60_000 },
  /** Order submissions per user. */
  orderCreate: { name: "order-create", limit: 30, windowMs: 60_000 },
  /** AI draft generations per user. */
  aiDraft: { name: "ai-draft", limit: 20, windowMs: 60 * 60_000 },
  /**
   * Public catalog reads per client IP.
   *
   * /api/products is unauthenticated and runs an unbounded count() alongside the
   * page query — the same seven-column ILIKE across two tables, with no LIMIT,
   * because it must match every row rather than the first page. That made it the
   * cheapest external way to load the database, and checkout transactions hold
   * advisory locks behind the same connection pool. Generous enough for real
   * browsing, low enough to stop a scraper.
   */
  catalogRead: { name: "catalog-read", limit: 120, windowMs: 60_000 },
} satisfies Record<string, RateLimitRule>;

export async function checkRateLimit(rule: RateLimitRule, identifier: string): Promise<RateLimitResult> {
  const { count, resetAt } = await store.incr(`${rule.name}:${identifier}`, rule.windowMs);
  return { ok: count <= rule.limit, count, limit: rule.limit, resetAt };
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIpFrom(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "unknown";
}
