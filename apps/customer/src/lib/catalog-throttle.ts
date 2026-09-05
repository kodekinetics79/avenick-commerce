import { NextResponse } from "next/server";
import { checkRateLimit, clientIpFrom, RATE_LIMITS } from "@avenick/auth/rate-limit";

/**
 * THE PER-IP THROTTLE EVERY PUBLIC CATALOGUE READ PASSES.
 *
 * `/api/products` carried this reasoning and this rule; the routes added since
 * did not. The reasoning applies to all of them, and to the recommendation
 * route most of all: it is public, it is unauthenticated, and one call runs
 * THREE services — affinity, co-purchase and trending — against the same
 * connection pool that checkout transactions hold advisory locks on. Cheap to
 * call, expensive to answer, and reachable by anyone with a product slug.
 *
 * One shared bucket rather than a rule per route, deliberately. The limit
 * protects a connection pool, and the pool does not care which route spent it.
 * A real product page costs two or three of the 120 a minute allows; a
 * catalogue scrape costs all of them.
 *
 * Returns the 429 to send back, or null to continue.
 */
export async function catalogThrottle(headers: Headers): Promise<NextResponse | null> {
  const rl = await checkRateLimit(RATE_LIMITS.catalogRead, clientIpFrom(headers));
  if (rl.ok) return null;

  return NextResponse.json(
    { success: false, error: "Too many catalog requests. Please slow down." },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))),
        "Cache-Control": "no-store",
      },
    },
  );
}
