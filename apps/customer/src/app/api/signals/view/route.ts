import { NextRequest, NextResponse } from "next/server";
import { recordProductView } from "@avenick/database";
import { log } from "@avenick/observability";
// Narrow subpath on purpose: the package barrel pulls in next-auth, which is
// unnecessary here and breaks tests that never touch authentication.
import { checkRateLimit, clientIpFrom, type RateLimitRule } from "@avenick/auth/rate-limit";
import { z } from "zod";

/**
 * POST /api/signals/view — "someone looked at this product".
 *
 * The only writer of the view signal that the storefront's Trending rail reads.
 * It is public and unauthenticated because the storefront is: requiring a
 * session would restrict the measurement to signed-in buyers and then present
 * the result as what everybody is looking at.
 *
 * Three properties this route is built around, in priority order:
 *
 *  1. IT NEVER FAILS THE PAGE. Every path returns a small JSON body quickly, and
 *     no path returns 5xx. A rail that may not even be on screen must not be
 *     able to turn a product page into an error, and a lost view is a rounding
 *     error where an incident is not.
 *  2. IT STORES NOTHING ABOUT THE VIEWER. No user id, no IP, no user-agent and
 *     no session identifier reaches the database — ProductViewSignal has nowhere
 *     to put one. See the fence below for what the de-duplication key is and why
 *     it is not personal data.
 *  3. ONE REFRESH IS ONE VIEW. Forty reloads of a product page contribute one
 *     unit, not forty.
 */

export const dynamic = "force-dynamic";

/**
 * Per-IP ingest cap, matched to RATE_LIMITS.catalogRead (120/min).
 *
 * A view signal should never outrun the catalog reads that produce it, and a
 * real browser cannot sustain two product views a second. Defined here rather
 * than added to the shared RATE_LIMITS table because it is this route's own
 * policy; if a second ingest route ever appears, it belongs in the shared table.
 */
const SIGNAL_INGEST_LIMIT: RateLimitRule = { name: "signal-view", limit: 120, windowMs: 60_000 };

/**
 * THE DE-DUPLICATION FENCE, and the only reason a discriminator exists at all.
 *
 * One count per discriminator per product per UTC day. `limit: 1` makes the
 * rate limiter a fence rather than a throttle: the first request through in the
 * window is counted and every later one is answered "duplicate". The day is part
 * of the key (below), so the window rolls at the same UTC midnight the storage
 * bucket does instead of drifting from whenever the first request happened.
 *
 * This is what lets ProductViewSignal.views mean roughly "distinct people who
 * looked" rather than "times a page was loaded" — without which one person with
 * a stuck refresh, or one product page in a background tab, would be the whole
 * ranking.
 *
 * WHY THE STORE, NOT A TABLE. The fence lives in the shared rate-limit store
 * (Redis in production via installRedisRateLimitStore, an in-process map
 * otherwise), which expires its own keys and is never backed up. Persisting the
 * fence would mean a table with one row per viewer per product per day: bigger
 * than the signal it protects, and a genuine per-person record where the design
 * requires none.
 *
 * HONEST LIMITS. Without Redis the store is per-instance, so on a multi-instance
 * deployment the same viewer can be counted once per instance — damping, not
 * elimination. And the fence cannot stop a determined adversary who rotates
 * addresses; nothing that is both public and login-free can. Trending is a
 * measure of attention, not an audited figure, and nothing financial reads it.
 */
const SIGNAL_DEDUP_FENCE: RateLimitRule = { name: "signal-view-dedup", limit: 1, windowMs: 24 * 60 * 60_000 };

/**
 * Salt for the fence key.
 *
 * A bare SHA-256 of an IPv4 address is reversible by exhausting four billion
 * candidates, so an unsalted digest in a shared Redis would be an IP list with
 * extra steps. With SIGNAL_FENCE_SALT set, the digest is unreversible AND stable
 * across instances, which is what makes cross-instance de-duplication work. With
 * it unset the salt is random per process: still unreversible, and the fence
 * degrades to per-instance — the same degradation the in-memory store already
 * has, so an unset variable costs nothing that was not already lost.
 */
const FENCE_SALT = process.env.SIGNAL_FENCE_SALT?.trim() || crypto.randomUUID();

const ViewSignalSchema = z.object({
  // A cuid. Shape-checked so nothing arbitrary reaches a query or a fence key;
  // whether the id names a real product is the foreign key's business, not this
  // route's, and an unknown id is answered "ignored" rather than looked up.
  productId: z.string().trim().regex(/^[A-Za-z0-9_-]{1,64}$/),
});

/** Biggest body this route will read. A view signal is one short id. */
const MAX_BODY_BYTES = 512;

/**
 * The de-duplication key: a salted digest of (client address, product, UTC day).
 *
 * NOT PERSONAL DATA, and specifically:
 *  · it is one-way — the address cannot be recovered from the digest without
 *    the per-deployment salt, and with a random per-process salt not even then;
 *  · it is scoped to one product and one day, so two digests cannot be joined
 *    into a browsing history even by whoever holds the store;
 *  · it expires with the rate-limit window and is never written to Postgres,
 *    never logged, and never returned to the caller.
 * It exists solely to answer "have I already counted this one today".
 */
async function fenceKey(clientIp: string, productId: string, day: string): Promise<string> {
  const material = new TextEncoder().encode(`${FENCE_SALT}|${clientIp}|${productId}|${day}`);
  const digest = await crypto.subtle.digest("SHA-256", material);
  return Array.from(new Uint8Array(digest).slice(0, 16))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function accepted(outcome: "counted" | "duplicate" | "ignored" | "unavailable") {
  // 202, not 200: the caller is told the request was accepted and what became
  // of it, and there is nothing for it to do in any case. `outcome` is reported
  // truthfully — "counted" and "unavailable" are different facts, and a client
  // that logs them as one loses the ability to notice the signal has stopped.
  return NextResponse.json({ success: true, outcome }, { status: 202, headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  try {
    const clientIp = clientIpFrom(req.headers);

    // Checked before the body is read, so a rejected request costs nothing
    // beyond the counter.
    const rl = await checkRateLimit(SIGNAL_INGEST_LIMIT, clientIp);
    if (!rl.ok) {
      return NextResponse.json(
        { success: false, error: "Too many signals." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))),
            "Cache-Control": "no-store",
          },
        },
      );
    }

    // Read as text and parse by hand: navigator.sendBeacon — the right way for a
    // page to emit this — sends a Blob whose content type the browser chooses,
    // and req.json() rejects anything that is not application/json. The length
    // cap is applied before parsing so an oversized body is refused rather than
    // deserialised.
    const raw = await req.text().catch(() => "");
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json({ success: false, error: "Body too large." }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    let body: unknown = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      body = null;
    }

    const parsed = ViewSignalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid signal." }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    const { productId } = parsed.data;

    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    const fence = await checkRateLimit(SIGNAL_DEDUP_FENCE, await fenceKey(clientIp, productId, day));
    if (!fence.ok) return accepted("duplicate");

    // recordProductView does not throw: it returns what happened.
    const outcome = await recordProductView(productId, { now });
    return accepted(outcome);
  } catch (error) {
    // Belt and braces. Nothing above is expected to throw, and if something does
    // the answer is still not a 500 — this endpoint exists to observe the
    // storefront, never to break it.
    log.error("view signal ingest failed", error, { path: "/api/signals/view" });
    return accepted("unavailable");
  }
}
