import { AuthRevokeRequestSchema, RevocationSchema } from "@avenick/contracts";
import { db, RefreshTokenRevokedReason } from "@avenick/database";

import { route } from "../../_lib/handler";
import { V1_RATE_LIMITS } from "../../_lib/rate-limit";
import { refreshTokenHash, revokeAllForUser, revokeFamily } from "../_lib/refresh-tokens";

/**
 * POST /api/v1/auth/revoke — sign out, from here or from everywhere.
 *
 * The contract makes the two mutually exclusive and requires exactly one,
 * because a request naming neither is ambiguous between "do nothing" and "sign
 * me out everywhere" and that is not a question to guess at.
 *
 * ONE TOKEN revokes the whole FAMILY, not just the row presented. A family is
 * one installation's rotation lineage; the device only ever holds its newest
 * token, so leaving the older ones live would leave a session alive for anyone
 * holding a copy — which is precisely who the person signing out is worried
 * about.
 *
 * ALL SESSIONS also stamps `User.sessionsValidAfter`. Revoking refresh tokens
 * alone would sign out the phones and leave every browser session running for
 * the rest of its thirty days, which is not what "sign out of all devices"
 * means to the person tapping it. The stamp is what ends the web sessions, and
 * it ends this caller's own access token too — correctly: they asked for
 * everywhere, and everywhere includes here.
 *
 * `revokedCount` counts REFRESH TOKENS, as the contract says. On an account
 * that has only ever used the website that number is zero even though the
 * browser sessions were just ended — see the report; the contract has no field
 * for the second fact.
 */
export const POST = route({
  route: "/api/v1/auth/revoke",
  auth: "required",
  // The mobile client is the caller with a token to revoke.
  allowBearer: true,
  body: AuthRevokeRequestSchema,
  response: RevocationSchema,
  rateLimit: { rule: V1_RATE_LIMITS.authRevoke },
  handle: async (ctx) => {
    const userId = ctx.principal!.userId;
    const now = new Date();

    if (ctx.body.allSessions) {
      const revokedCount = await db.$transaction(async (tx) => {
        const count = await revokeAllForUser(
          tx,
          userId,
          RefreshTokenRevokedReason.ALL_SESSIONS_REVOKED,
          now,
        );
        await tx.user.update({ where: { id: userId }, data: { sessionsValidAfter: now } });
        return count;
      });
      ctx.log.info("v1 auth: all sessions revoked", { userId, revokedCount });
      return { data: { revokedCount } };
    }

    // The schema's refine guarantees one of the two is present; this narrows it
    // for the type checker rather than re-stating the rule.
    const presentedHash = refreshTokenHash(ctx.body.refreshToken!);
    const token = await db.refreshToken.findUnique({
      where: { tokenHash: presentedHash },
      select: { familyId: true, userId: true },
    });

    /**
     * A token that does not exist, or belongs to someone else, revokes nothing
     * and says so with the same honest zero. Answering differently would let a
     * signed-in caller test whether an arbitrary string is a live token
     * belonging to another account — a slow oracle, but an oracle.
     *
     * It is NOT treated as a replay. Sign-out is the one endpoint a confused or
     * retrying client is expected to call with a stale token, and ending an
     * unrelated family on that basis would be a denial of service anyone with a
     * session could aim at anyone else.
     */
    if (!token || token.userId !== userId) {
      ctx.log.info("v1 auth: revoke named a token this account does not hold", { userId });
      return { data: { revokedCount: 0 } };
    }

    const revokedCount = await revokeFamily(
      db,
      token.familyId,
      RefreshTokenRevokedReason.SIGNED_OUT,
      now,
    );
    ctx.log.info("v1 auth: session revoked", { userId, familyId: token.familyId, revokedCount });
    return { data: { revokedCount } };
  },
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
