import { AuthTokenRequestSchema, TokenPairSchema } from "@avenick/contracts";
import { AppSecretMissingError } from "@avenick/auth/app-secret";
import { verifyCredentials } from "@avenick/auth/credentials";
import { checkRateLimit, RATE_LIMITS } from "@avenick/auth/rate-limit";
import { db } from "@avenick/database";

import { rateLimited, unauthenticated, upstreamUnavailable } from "../../_lib/errors";
import { route } from "../../_lib/handler";
import { beginSession, clampUserAgent, type PrincipalRow } from "../_lib/refresh-tokens";

/**
 * POST /api/v1/auth/token — the password grant.
 *
 * The mobile equivalent of the web sign-in form, and deliberately not more than
 * that: the password is checked by `verifyCredentials`, the same function the
 * NextAuth Credentials provider calls, so the two doors cannot drift into
 * disagreeing about lowercasing, about a null `passwordHash`, or about whether
 * a deleted account may sign in.
 *
 * IT SHARES THE WEB SIGN-IN'S THROTTLE BUDGET, on purpose and with the same
 * keys. `RATE_LIMITS.login` is keyed on the lowercased address and
 * `RATE_LIMITS.loginIp` on the client IP, exactly as `config.ts` keys them, so
 * ten attempts here and ten attempts on the login form are ten attempts total.
 * A separate budget for this route would have been a second, unspent allowance
 * for anyone brute-forcing the same passwords against the same accounts — which
 * is what "the mobile API let you keep going after the website locked you out"
 * looks like in an incident report.
 *
 * The per-IP half runs in the wrapper, before the body is read; the per-address
 * half runs here, because the address arrives in the body.
 */
export const POST = route({
  route: "/api/v1/auth/token",
  // No credential is required to present a credential.
  auth: "none",
  body: AuthTokenRequestSchema,
  response: TokenPairSchema,
  rateLimit: {
    rule: RATE_LIMITS.loginIp,
    // The bare IP, not `ip:<addr>`: `config.ts` keys this rule that way and the
    // budget is only shared if the key is identical.
    identify: ({ clientIp }) => clientIp,
  },
  handle: async (ctx) => {
    const { email, password, deviceId } = ctx.body;

    const byEmail = await checkRateLimit(RATE_LIMITS.login, email.trim().toLowerCase());
    if (!byEmail.ok) {
      throw rateLimited(
        Math.max(1, Math.ceil((byEmail.resetAt - Date.now()) / 1000)),
        "Too many sign-in attempts. Try again shortly.",
      );
    }

    const user = await verifyCredentials({ email, password });
    // One answer for every failure. "No such account" and "wrong password" are
    // different answers to someone testing a leaked credential list, and the
    // difference is worth more to them than to whoever mistyped.
    if (!user) throw unauthenticated("Those credentials are not valid.");

    const principal: PrincipalRow = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      language: user.language,
      status: user.status,
      deletedAt: user.deletedAt,
      sessionsValidAfter: user.sessionsValidAfter,
    };

    try {
      const pair = await beginSession(db, principal, {
        deviceId,
        ipAddress: ctx.clientIp,
        userAgent: clampUserAgent(ctx.req.headers.get("user-agent")),
      });
      // The device id, never the token. Nothing in this surface logs a
      // credential — a refresh token in a log aggregator is a sixty-day session
      // handed to everyone who can read it.
      ctx.log.info("v1 auth: password grant issued a token pair", {
        userId: user.id,
        deviceId,
      });
      return { data: pair };
    } catch (error) {
      if (error instanceof AppSecretMissingError) {
        // A deployment with no AUTH_SECRET cannot sign an access token, and
        // signing with an empty key would hand out forgeable ones. Loud, and
        // distinguishable from a wrong password.
        ctx.log.error("v1 auth: cannot issue tokens without a signing secret", error, {
          route: "/api/v1/auth/token",
        });
        throw upstreamUnavailable("Sign-in is not available from this environment.");
      }
      throw error;
    }
  },
});

// node:crypto and bcrypt have no edge build, and Prisma cannot run there.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
