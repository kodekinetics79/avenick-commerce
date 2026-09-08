import { AuthRefreshRequestSchema, TokenPairSchema } from "@avenick/contracts";
import { AppSecretMissingError } from "@avenick/auth/app-secret";
import { isSessionRevoked } from "@avenick/auth/session-revocation";
import { db, RefreshTokenRevokedReason } from "@avenick/database";

import { unauthenticated, upstreamUnavailable } from "../../_lib/errors";
import { route } from "../../_lib/handler";
import { V1_RATE_LIMITS } from "../../_lib/rate-limit";
import {
  clampUserAgent,
  continueSession,
  familyOriginAt,
  PRINCIPAL_SELECT,
  refreshTokenHash,
  revokeFamily,
  type PrincipalRow,
} from "../_lib/refresh-tokens";

/** Internal signal: another request spent this token first. Never leaves the route. */
class RotationLost extends Error {
  constructor() {
    super("refresh token was already spent");
    this.name = "RotationLost";
  }
}

/**
 * POST /api/v1/auth/refresh — rotate a refresh token, and catch a replay.
 *
 * ROTATION. A refresh token is spendable exactly once. Redeeming it creates a
 * successor in the same family, stamps the presented row ROTATED and points its
 * `replacedById` at the successor. The spent row is kept rather than deleted,
 * and that is the entire mechanism: a table that deleted spent tokens would
 * answer "unknown token" to a replay and learn nothing from it.
 *
 * REUSE DETECTION. Presenting a token that has already been rotated means two
 * parties hold the same secret — the real device spent it, and somebody else
 * has a copy. There is no way to tell from the request which one is calling, so
 * the only safe response is to end the lineage: every live token sharing the
 * `familyId` is revoked as REUSE_DETECTED, both parties are signed out, and the
 * genuine user re-authenticates with a password they still know while the thief
 * cannot. Losing a session is a nuisance; leaving the thief a live one is not.
 *
 * THE RACE THAT LOOKS LIKE A REPLAY. Two legitimate requests from the same
 * device — an app that fired a refresh on resume and again on a queued API call
 * — can both present the same token. The conditional `updateMany` below lets
 * exactly one win, and the loser is treated as a replay. That is a deliberate
 * choice of a false positive (an occasional forced sign-in) over a false
 * negative (a stolen token that keeps working), and it is why the client is
 * expected to serialise its own refreshes.
 *
 * ORDER MATTERS: the family is checked and revoked BEFORE anything is minted.
 * Every rejection below answers exactly the same 401 as an unknown token, so
 * the endpoint never tells a caller whether a token it holds was real.
 */
export const POST = route({
  route: "/api/v1/auth/refresh",
  // The refresh token IS the credential; requiring another would be circular.
  auth: "none",
  body: AuthRefreshRequestSchema,
  response: TokenPairSchema,
  rateLimit: { rule: V1_RATE_LIMITS.authRefresh, identify: ({ clientIp }) => `ip:${clientIp}` },
  handle: async (ctx) => {
    const { refreshToken, deviceId } = ctx.body;
    const now = new Date();

    const presented = await db.refreshToken.findUnique({
      where: { tokenHash: refreshTokenHash(refreshToken) },
      select: {
        id: true,
        userId: true,
        familyId: true,
        deviceId: true,
        expiresAt: true,
        revokedAt: true,
        revokedReason: true,
      },
    });

    // A token that was never issued, or was issued under a different secret.
    // Nothing to revoke and nothing to learn.
    if (!presented) throw unauthenticated("That session is no longer valid. Please sign in again.");

    const endFamily = async (reason: RefreshTokenRevokedReason, why: string) => {
      const revoked = await revokeFamily(db, presented.familyId, reason, now);
      ctx.log.warn(`v1 auth: refresh family ended (${why})`, {
        userId: presented.userId,
        familyId: presented.familyId,
        reason,
        revoked,
      });
    };

    /**
     * THE REPLAY. Already revoked, for any reason: either it was rotated (a
     * copy is in circulation) or a sign-out already ended it (and something is
     * still trying). Both answer the same way, and re-revoking is safe —
     * `revokeFamily` only touches rows that are still live, so an existing
     * REUSE_DETECTED stamp is never overwritten with a milder reason.
     */
    if (presented.revokedAt) {
      await endFamily(RefreshTokenRevokedReason.REUSE_DETECTED, "a revoked token was presented");
      throw unauthenticated("That session is no longer valid. Please sign in again.");
    }

    // Expiry is routine, not an attack: the family dies with it either way, so
    // there is nothing to revoke and no warning worth raising.
    if (presented.expiresAt <= now) {
      throw unauthenticated("That session has expired. Please sign in again.");
    }

    /**
     * A token presented from an installation it was not issued to. The device
     * id is chosen by the client, so this is not proof of theft on its own —
     * but a genuine device has no reason to change it mid-session, and the
     * benign explanation (a reinstall) is one the user recovers from by signing
     * in. Treated as a replay.
     */
    if (presented.deviceId !== deviceId) {
      await endFamily(RefreshTokenRevokedReason.REUSE_DETECTED, "device id does not match");
      throw unauthenticated("That session is no longer valid. Please sign in again.");
    }

    /**
     * When this family actually authenticated. Every access token it mints
     * carries this instant, so a password reset that moved `sessionsValidAfter`
     * past it kills the tokens as well as the rotation. See `familyOriginAt`:
     * a missing root means the lineage is older than the retention window, and
     * inventing a later origin would be inventing a credential that outlives a
     * revocation.
     */
    const familyOrigin = await familyOriginAt(db, presented.familyId);
    if (!familyOrigin) {
      await endFamily(RefreshTokenRevokedReason.ADMIN_REVOKED, "the family's first token is gone");
      throw unauthenticated("That session is no longer valid. Please sign in again.");
    }

    const user = (await db.user.findUnique({
      where: { id: presented.userId },
      select: PRINCIPAL_SELECT,
    })) as PrincipalRow | null;

    if (!user || user.status !== "ACTIVE" || user.deletedAt) {
      await endFamily(RefreshTokenRevokedReason.USER_DEACTIVATED, "the account is not active");
      throw unauthenticated("That session is no longer valid. Please sign in again.");
    }

    /**
     * The session-level revocation, on the path that could otherwise outrun it.
     * `sessionsValidAfter` stops an access token being ACCEPTED; this stops a
     * new one being MINTED, which matters because a refresh token lives sixty
     * days and a password reset is supposed to end it today.
     */
    if (isSessionRevoked(Math.floor(familyOrigin.getTime() / 1000), user.sessionsValidAfter)) {
      await endFamily(RefreshTokenRevokedReason.ALL_SESSIONS_REVOKED, "issued before the account's cutoff");
      throw unauthenticated("Your session has ended. Please sign in again.");
    }

    const userAgent = clampUserAgent(ctx.req.headers.get("user-agent"));

    let pair;
    try {
      pair = await db.$transaction(async (tx) => {
        const issued = await continueSession(
          tx,
          user,
          presented.familyId,
          familyOrigin,
          { deviceId, ipAddress: ctx.clientIp, userAgent },
          now,
        );

        /**
         * SPEND THE PRESENTED TOKEN — conditionally.
         *
         * `revokedAt: null` in the WHERE is what makes a refresh token
         * single-use under concurrency. Without it, two requests arriving
         * together would each mint a successor and each believe it had won,
         * leaving two live tokens in one family and no record that anything
         * unusual happened. With it, the database decides, the loser sees
         * count 0, and its successor is rolled back with this transaction.
         */
        const spent = await tx.refreshToken.updateMany({
          where: { id: presented.id, revokedAt: null },
          data: {
            revokedAt: now,
            revokedReason: RefreshTokenRevokedReason.ROTATED,
            replacedById: issued.successorId,
          },
        });
        if (spent.count !== 1) throw new RotationLost();
        return issued.pair;
      });
    } catch (error) {
      if (error instanceof RotationLost) {
        await endFamily(RefreshTokenRevokedReason.REUSE_DETECTED, "the token was spent concurrently");
        throw unauthenticated("That session is no longer valid. Please sign in again.");
      }
      if (error instanceof AppSecretMissingError) {
        ctx.log.error("v1 auth: cannot mint an access token without a signing secret", error, {
          route: "/api/v1/auth/refresh",
        });
        throw upstreamUnavailable("Sign-in is not available from this environment.");
      }
      throw error;
    }

    ctx.log.info("v1 auth: refresh token rotated", {
      userId: user.id,
      familyId: presented.familyId,
      deviceId,
    });
    return { data: pair };
  },
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
