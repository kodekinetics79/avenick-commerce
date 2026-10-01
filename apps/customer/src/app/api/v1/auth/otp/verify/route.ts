import { OtpVerifyRequestSchema, TokenPairSchema } from "@avenick/contracts";
import { AppSecretMissingError } from "@avenick/auth/app-secret";
import { db, OtpPurpose } from "@avenick/database";

import { unauthenticated, upstreamUnavailable } from "../../../_lib/errors";
import { route } from "../../../_lib/handler";
import { V1_RATE_LIMITS } from "../../../_lib/rate-limit";
import { otpCodeMatches, OTP_MAX_ATTEMPTS } from "../../_lib/otp";
import {
  assertUsable,
  beginSession,
  clampUserAgent,
  PRINCIPAL_SELECT,
  type PrincipalRow,
} from "../../_lib/refresh-tokens";

/**
 * POST /api/v1/auth/otp/verify — answer a challenge and sign in.
 *
 * ONE REJECTION FOR EVERY FAILURE. An unknown challenge id, an expired one, one
 * already answered, one issued to a different installation, a wrong code, a
 * number with no account behind it: all 401 with the same sentence. Telling
 * them apart would hand back exactly what the request endpoint refuses to leak,
 * and the caller's next move is identical in every case — request a new code.
 *
 * THE ATTEMPT IS SPENT BEFORE THE CODE IS COMPARED. The `updateMany` below both
 * increments `attempts` and enforces the cap in one statement, and its result is
 * checked before anything is verified. Reading the row, comparing, and then
 * writing the counter would let concurrent guesses share one increment — a
 * six-digit code is a million guesses, and an attacker who can make them in
 * parallel does not need many free ones.
 */
export const POST = route({
  route: "/api/v1/auth/otp/verify",
  auth: "none",
  body: OtpVerifyRequestSchema,
  response: TokenPairSchema,
  rateLimit: { rule: V1_RATE_LIMITS.otpVerifyIp, identify: ({ clientIp }) => `ip:${clientIp}` },
  handle: async (ctx) => {
    const { challengeId, code, deviceId } = ctx.body;
    const now = new Date();
    const refuse = () => unauthenticated("That code is not valid. Request a new one.");

    /**
     * Spend an attempt first, and let the database enforce the cap.
     *
     * Zero rows updated means the challenge does not exist, has been consumed,
     * or has run out of guesses — the same answer for all three, and no read of
     * the row was needed to establish it.
     */
    const spent = await db.otpChallenge.updateMany({
      where: { id: challengeId, consumedAt: null, attempts: { lt: OTP_MAX_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
    });
    if (spent.count !== 1) throw refuse();

    const challenge = await db.otpChallenge.findUnique({
      where: { id: challengeId },
      select: { id: true, phone: true, codeHash: true, purpose: true, expiresAt: true, deviceId: true },
    });
    if (!challenge || challenge.expiresAt <= now) throw refuse();

    /**
     * A code issued to one installation cannot be redeemed from another. The
     * contract sends `deviceId` on both halves of the flow precisely so this
     * check exists: without it, an intercepted code is redeemable from anywhere.
     * A challenge stored without a device id predates this route and is refused
     * rather than waved through.
     */
    if (!challenge.deviceId || challenge.deviceId !== deviceId) throw refuse();

    let matches: boolean;
    try {
      matches = otpCodeMatches(challenge.phone, challenge.purpose, code, challenge.codeHash);
    } catch (error) {
      if (error instanceof AppSecretMissingError) {
        ctx.log.error("v1 auth: cannot verify a one-time code without the hashing key", error);
        throw upstreamUnavailable("One-time codes cannot be verified from this environment.");
      }
      throw error;
    }
    if (!matches) throw refuse();
    if (challenge.purpose !== OtpPurpose.SIGN_IN) throw refuse();

    /**
     * Consume it. Conditional on `consumedAt: null` so two requests carrying
     * the same correct code cannot both mint a session — the same single-use
     * discipline the refresh path applies to rotation.
     */
    const consumed = await db.otpChallenge.updateMany({
      where: { id: challenge.id, consumedAt: null },
      data: { consumedAt: now },
    });
    if (consumed.count !== 1) throw refuse();

    /**
     * Only now is an account looked up. Doing it earlier — to decide whether to
     * send a code at all — is what would have made the request endpoint an
     * enumeration oracle; doing it here costs an attacker nothing they did not
     * already have, because reaching this line means they received an SMS on
     * that number.
     */
    const user = (await db.user.findUnique({
      where: { phone: challenge.phone },
      select: PRINCIPAL_SELECT,
    })) as PrincipalRow | null;

    /**
     * A verified number with no account behind it. There is no sign-up in this
     * contract — `OtpVerifyResponseSchema` returns a token pair and nothing
     * else — so this cannot silently create one, and answering with the same
     * refusal is the honest end of the road. See the report: phone-first
     * REGISTRATION is a gap between the contract and this flow, not an
     * oversight here.
     */
    if (!user) {
      ctx.log.info("v1 auth: a code was verified for a number with no account", {
        challengeId: challenge.id,
      });
      throw refuse();
    }
    // A code delivered to the number proves the number, so the account's own
    // status rules apply from here on and the failure is no longer generic.
    assertUsable(user, now);

    /**
     * Answering the code proved the number. Recording that is the point of
     * `User.phoneVerified`, and doing it here means an account created by an
     * admin or a bulk import becomes verified the first time its owner signs in
     * by SMS. Only ever set, never cleared.
     */
    await db.user.updateMany({
      where: { id: user.id, phoneVerified: null },
      data: { phoneVerified: now },
    });

    let pair;
    try {
      pair = await beginSession(
        db,
        user,
        {
          deviceId,
          ipAddress: ctx.clientIp,
          userAgent: clampUserAgent(ctx.req.headers.get("user-agent")),
        },
        now,
      );
    } catch (error) {
      if (error instanceof AppSecretMissingError) {
        ctx.log.error("v1 auth: cannot issue tokens without a signing secret", error, {
          route: "/api/v1/auth/otp/verify",
        });
        throw upstreamUnavailable("Sign-in is not available from this environment.");
      }
      throw error;
    }

    ctx.log.info("v1 auth: OTP sign-in issued a token pair", { userId: user.id, deviceId });
    return { data: pair };
  },
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
