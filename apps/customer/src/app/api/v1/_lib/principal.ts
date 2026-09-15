import { bearerTokenFrom, sessionFromAccessToken, verifyAccessToken } from "@avenick/auth/access-token";
import { isSessionRevoked, sessionIssuedAtSeconds } from "@avenick/auth/session-revocation";
import { db, type UserRole } from "@avenick/database";
import type { Session } from "next-auth";

import { auth } from "@/lib/auth-instance";

import { forbidden, unauthenticated } from "./errors";

/**
 * Who is calling, re-read from Postgres on every request.
 *
 * This is the reason the v1 surface lives inside `apps/customer` and shares
 * `@avenick/database` in-process rather than sitting behind an HTTP hop.
 * `guarded()` in `packages/auth/src/api.ts` re-reads `role`, `status` and
 * `deletedAt` per request because that live read IS the revocation mechanism:
 * a suspended seller, a deleted account or a demoted admin stops being able to
 * act on the very next request, not when some token happens to expire. A cached
 * claim in a JWT cannot do that, so v1 does the same read.
 *
 * TWO CREDENTIALS, ONE PATH. The portal cookie and the mobile bearer token are
 * both turned into a `Session` before the read below, so neither can skip a
 * check the other makes. Which one a route accepts is the route's decision —
 * see `allowBearer` — and never inferred from a header being present.
 */
export interface Principal {
  userId: string;
  role: UserRole;
  /** The caller's ACTIVE company membership, or null. B2B pricing needs one. */
  companyId: string | null;
  /** Which credential named the caller; "bearer" only on an opted-in route. */
  credential: "cookie" | "bearer";
}

/** Buyer roles. Mirrors the check `createOrder` performs inside its transaction. */
export const BUYER_ROLES: readonly UserRole[] = [
  "CONSUMER",
  "COMPANY_ADMIN",
  "COMPANY_BUYER",
  "COMPANY_APPROVER",
];

export interface ResolvePrincipalOptions {
  /** Request headers, needed to read an `Authorization: Bearer` credential. */
  headers: Headers;
  /**
   * Accept a mobile access token as well as the portal cookie. Defaults to
   * false: a route that has never considered a phone-held credential must not
   * start accepting one because a header showed up.
   */
  allowBearer?: boolean;
}

/**
 * Resolve the caller, or null when there is no credential at all.
 *
 * A credential that names a user who is no longer permitted does NOT come back
 * as null. Degrading a suspended account to "guest" would quietly re-admit it
 * everywhere the endpoint is willing to serve a guest, which is the opposite of
 * a revocation. It throws instead — `forbidden` when the ACCOUNT is not allowed
 * to act, `unauthenticated` when the account is fine but THIS session has been
 * revoked and the app's correct move is to sign in again.
 */
export async function resolvePrincipal(options: ResolvePrincipalOptions): Promise<Principal | null> {
  let credential: "cookie" | "bearer" = "cookie";
  let session: Session | null = await auth();

  // Cookie first: a browser that also carries an Authorization header keeps the
  // credential its user actually established.
  if (!session?.user?.id && options.allowBearer) {
    const presented = bearerTokenFrom(options.headers);
    if (presented) {
      const verified = verifyAccessToken(presented);
      if (verified.ok) {
        session = sessionFromAccessToken(verified.claims);
        credential = "bearer";
      }
    }
  }

  const userId = session?.user?.id;
  if (!userId) return null;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      status: true,
      deletedAt: true,
      // One more column on a query that was already being made. This is the
      // session-level half of revocation: the three fields above can refuse an
      // ACCOUNT, and until this column existed nothing could refuse a single
      // stolen SESSION on an otherwise healthy account.
      sessionsValidAfter: true,
      companyMember: {
        select: {
          companyId: true,
          isActive: true,
          company: { select: { status: true, deletedAt: true } },
        },
      },
    },
  });
  if (!user || user.status !== "ACTIVE" || user.deletedAt) {
    throw forbidden("This account is not permitted to use this API.");
  }

  /**
   * Issued before the account's cutoff — a password reset, or a "sign out
   * everywhere". 401 rather than 403 because the account is healthy and the
   * client should re-authenticate; a 403 tells an app to give up.
   */
  if (isSessionRevoked(sessionIssuedAtSeconds(session), user.sessionsValidAfter)) {
    throw unauthenticated("Your session has ended. Please sign in again.");
  }

  const member = user.companyMember;
  const companyActive =
    !!member && member.isActive && member.company.status === "ACTIVE" && !member.company.deletedAt;

  return {
    userId,
    role: user.role,
    companyId: companyActive ? member.companyId : null,
    credential,
  };
}
