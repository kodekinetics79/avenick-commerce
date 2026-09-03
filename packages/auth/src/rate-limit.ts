/**
 * Lightweight fixed-window rate limiter.
 *
 * The default store is in-memory: correct per server instance, zero
 * dependencies, and safe in every runtime (Node, Edge, tests). On serverless
 * this still throttles bursts because instances are reused across requests.
 * For globally-consistent limits in production, call installRedisRateLimitStore()
 * at bootstrap with UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN both set.
 * With either unset that install is a no-op and each instance keeps a private
 * bucket map that resets on restart — single-instance throttling only.
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
  /**
   * "You already have an account" notices per target address.
   *
   * The consumer registration route answers neutrally and tells the address's
   * real owner by email instead. Without a cap that makes the route a mail
   * cannon: anyone can point unlimited notices at any address, and the per-IP
   * register limit does not help because a distributed attacker has many IPs
   * and one target. One notice a day is enough to tell the owner someone tried;
   * the second attempt in that window is logged and not sent.
   */
  alreadyRegisteredNotice: { name: "already-registered-notice", limit: 1, windowMs: 24 * 60 * 60_000 },
  /**
   * Password-reset requests per target address. The route answers neutrally
   * whether or not the address exists, so the only thing a cap protects is the
   * mailbox: without one the route is a mail cannon aimed at any address.
   */
  passwordResetRequest: { name: "password-reset-request", limit: 3, windowMs: 60 * 60_000 },
  /** Password-reset requests per client IP (covers many addresses). */
  passwordResetRequestIp: { name: "password-reset-request-ip", limit: 20, windowMs: 60 * 60_000 },
  /** Reset-token redemptions per client IP: the token is HMAC-signed, this only slows brute force on its expiry window. */
  passwordResetRedeem: { name: "password-reset-redeem", limit: 10, windowMs: 15 * 60_000 },
  /** Seller self-registrations per client IP. */
  sellerRegister: { name: "seller-register", limit: 5, windowMs: 60 * 60_000 },
  /** Product review submissions per user. */
  reviewSubmit: { name: "review-submit", limit: 10, windowMs: 60 * 60_000 },
  /** Thread replies per user (seller or buyer side). */
  messageReply: { name: "message-reply", limit: 60, windowMs: 60 * 60_000 },
  /** Seller compliance document registrations per seller. */
  sellerDocumentUpload: { name: "seller-document-upload", limit: 30, windowMs: 60 * 60_000 },
  /** Support ticket submissions per user: each one is a row an agent has to read, so a stuck retry loop or a script must not flood the queue. */
  supportTicket: { name: "support-ticket", limit: 10, windowMs: 60 * 60_000 },
} satisfies Record<string, RateLimitRule>;

export async function checkRateLimit(rule: RateLimitRule, identifier: string): Promise<RateLimitResult> {
  const { count, resetAt } = await store.incr(`${rule.name}:${identifier}`, rule.windowMs);
  return { ok: count <= rule.limit, count, limit: rule.limit, resetAt };
}

/**
 * How many proxies between the public internet and this process APPEND to
 * X-Forwarded-For. Both supported topologies are a single hop: Vercel's edge in
 * front of the Next.js runtime, and Render's load balancer in front of
 * `next start` (render.yaml). Raise it only when another appending proxy (a CDN,
 * an ingress controller) is put in front — each extra appender moves the real
 * client one position further left.
 */
const DEFAULT_TRUSTED_PROXY_HOPS = 1;

function trustedProxyHops(): number {
  const raw = process.env.TRUSTED_PROXY_HOPS?.trim();
  if (!raw) return DEFAULT_TRUSTED_PROXY_HOPS;
  const parsed = Number(raw);
  // A malformed value must never silently widen trust (0 or NaN would walk back
  // toward the client-controlled end of the header), so fall back to the default.
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : DEFAULT_TRUSTED_PROXY_HOPS;
}

/** Rightmost non-empty entry of a comma-separated forwarding header. */
function rightmostEntry(value: string | null): string | null {
  const entries = (value ?? "").split(",").map((entry) => entry.trim()).filter(Boolean);
  return entries.length > 0 ? entries[entries.length - 1]! : null;
}

/**
 * Client IP used as the key for every per-IP limit (loginIp, register, catalogRead).
 *
 * X-Forwarded-For is an append-only trail: each proxy appends the address it
 * received the connection from, so the FIRST entry is whatever the CLIENT sent.
 * Keying on entries[0] lets an attacker rotate `X-Forwarded-For: <random>` per
 * request and dissolve every per-IP limit — password spraying across accounts
 * becomes unthrottled, and the catalogRead throttle protecting the checkout
 * connection pool from the unbounded count() in listProducts stops applying.
 * Read from the RIGHT, where our own infrastructure writes. Never entries[0].
 *
 * Resolution order, most trustworthy first:
 *   1. TRUSTED_CLIENT_IP_HEADER — a header the operator's edge OVERWRITES on
 *      every request (Cloudflare's cf-connecting-ip, say). Opt-in by name only:
 *      trusting such a header when that edge is not actually in front would
 *      re-open the identical forgery hole, since a client can send it too.
 *   2. x-vercel-forwarded-for, but only when this process is genuinely running
 *      on Vercel. VERCEL is set by the platform in the runtime environment, so
 *      unlike a header it cannot be forged by the request.
 *   3. x-forwarded-for, counting TRUSTED_PROXY_HOPS entries in from the right.
 */
export function clientIpFrom(headers: Headers): string {
  const namedHeader = process.env.TRUSTED_CLIENT_IP_HEADER?.trim().toLowerCase();
  // Headers.get() throws on an invalid name; a typo in deploy config must not
  // take down sign-in, so ignore anything that is not a valid header token.
  if (namedHeader && /^[a-z0-9!#$%&'*+.^_`|~-]+$/.test(namedHeader)) {
    const ip = rightmostEntry(headers.get(namedHeader));
    if (ip) return ip;
  }

  if (process.env.VERCEL) {
    const ip = rightmostEntry(headers.get("x-vercel-forwarded-for"));
    if (ip) return ip;
  }

  const entries = (headers.get("x-forwarded-for") ?? "").split(",").map((entry) => entry.trim()).filter(Boolean);
  if (entries.length > 0) {
    const index = entries.length - trustedProxyHops();
    // A chain shorter than the configured hop count means the header is not
    // shaped the way this deployment expects. Take the last entry — the one
    // written closest to us — rather than drifting left into client-supplied text.
    return entries[index >= 0 ? index : entries.length - 1]!;
  }

  // Only reached when nothing in front of this process set x-forwarded-for:
  // local development, or a proxy configured for x-real-ip alone. Behind either
  // supported edge that header is always present, so an internet client cannot
  // choose this branch in order to supply its own x-real-ip.
  return headers.get("x-real-ip")?.trim() || "unknown";
}
