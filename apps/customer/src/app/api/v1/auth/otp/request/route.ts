import { OtpChallengeSchema, OtpRequestSchema } from "@avenick/contracts";
import { AppSecretMissingError } from "@avenick/auth/app-secret";
import { checkRateLimit } from "@avenick/auth/rate-limit";
import { db, OtpPurpose } from "@avenick/database";

import { toTimestamp } from "../../../_lib/dto";
import { rateLimited, upstreamUnavailable } from "../../../_lib/errors";
import { route } from "../../../_lib/handler";
import { V1_RATE_LIMITS } from "../../../_lib/rate-limit";
import {
  generateOtpCode,
  hashOtpCode,
  otpMessageBody,
  OTP_CODE_LENGTH,
  OTP_RESEND_INTERVAL_SECONDS,
  OTP_TTL_SECONDS,
} from "../../_lib/otp";
import { devEchoEnabled, resolveSmsSender } from "../../_lib/sms";

/**
 * POST /api/v1/auth/otp/request — send a one-time code.
 *
 * NO ACCOUNT LOOKUP HAPPENS HERE, and that is the design. The endpoint answers
 * identically for a registered and an unregistered number, because an endpoint
 * that answers differently is an account-enumeration oracle — feed it a
 * national numbering plan and it hands back a customer list. The challenge row
 * has no `userId` and no relation to `User` for the same reason: storage that
 * recorded which one it was would make the table the oracle instead.
 *
 * NOTHING IS ACTUALLY DELIVERED. No SMS provider is wired to this platform, so
 * the sender resolved below reports `configured: false` and this route answers
 * 503 `upstream_unavailable` — a status the published contract already lists
 * for this endpoint. It would have been easy to mint a challenge and answer 200
 * regardless; that reads as a working flow to a client, a tester and a demo
 * audience, and the first person to find out otherwise is the one waiting for a
 * code. Set `OTP_DEV_ECHO=1` outside production to write the code to the log and
 * exercise the flow locally.
 *
 * THREE INDEPENDENT LIMITS, because each covers what the others cannot: per
 * client IP (one address walking many numbers), per phone (one number being
 * pumped for SMS cost or harassment), and a sixty-second resend interval, which
 * is also what stops the attempt cap on a single challenge being sidestepped by
 * requesting a fresh challenge for every guess.
 */
export const POST = route({
  route: "/api/v1/auth/otp/request",
  auth: "none",
  body: OtpRequestSchema,
  response: OtpChallengeSchema,
  rateLimit: { rule: V1_RATE_LIMITS.otpRequestIp, identify: ({ clientIp }) => `ip:${clientIp}` },
  handle: async (ctx) => {
    const { phone, deviceId, language } = ctx.body;
    const sender = resolveSmsSender(ctx.log);

    /**
     * Checked before anything is minted or any budget beyond the wrapper's is
     * spent: a deployment that cannot send has no business filling the
     * challenge table with codes nobody will ever receive.
     */
    if (!sender.configured && !devEchoEnabled()) {
      ctx.log.error("v1 auth: OTP requested but no SMS provider is configured", undefined, {
        sender: sender.name,
      });
      throw upstreamUnavailable(
        "One-time codes cannot be sent from this environment: no SMS provider is configured.",
      );
    }

    const byPhone = await checkRateLimit(V1_RATE_LIMITS.otpRequestPhone, phone);
    if (!byPhone.ok) {
      throw rateLimited(
        Math.max(1, Math.ceil((byPhone.resetAt - Date.now()) / 1000)),
        "Too many codes requested for this number. Try again later.",
      );
    }

    const now = new Date();

    /**
     * The resend countdown, enforced rather than merely advertised. The
     * contract returns `resendAfter` so the app can grey out its button; a
     * client that ignores it, or one that is not our client at all, is stopped
     * here. Keyed on the phone and read from `@@index([phone, createdAt])`.
     */
    const recent = await db.otpChallenge.findFirst({
      where: { phone, createdAt: { gt: new Date(now.getTime() - OTP_RESEND_INTERVAL_SECONDS * 1000) } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (recent) {
      const waitMs = recent.createdAt.getTime() + OTP_RESEND_INTERVAL_SECONDS * 1000 - now.getTime();
      throw rateLimited(
        Math.max(1, Math.ceil(waitMs / 1000)),
        "A code was just sent to this number. Wait for it before asking for another.",
      );
    }

    const code = generateOtpCode();
    let codeHash: string;
    try {
      codeHash = hashOtpCode(phone, OtpPurpose.SIGN_IN, code);
    } catch (error) {
      if (error instanceof AppSecretMissingError) {
        // Without a key the "hash" would be a bare digest of a six-digit code,
        // which is the exact storage the schema forbids. Refuse rather than
        // store something recoverable in milliseconds by anyone who can read
        // the table.
        ctx.log.error("v1 auth: refusing to store a one-time code without a keyed hash", error);
        throw upstreamUnavailable("One-time codes cannot be sent from this environment.");
      }
      throw error;
    }

    const challenge = await db.otpChallenge.create({
      data: {
        phone,
        codeHash,
        purpose: OtpPurpose.SIGN_IN,
        expiresAt: new Date(now.getTime() + OTP_TTL_SECONDS * 1000),
        ipAddress: ctx.clientIp,
        deviceId,
      },
      select: { id: true, createdAt: true, expiresAt: true },
    });

    await sender.send({ to: phone, body: otpMessageBody(code) });
    if (!sender.configured) {
      // Only reachable with OTP_DEV_ECHO=1 outside production; `devEchoEnabled`
      // requires both. This is the one place a live code is written anywhere,
      // and it is gated so a production log can never contain one.
      ctx.log.warn("v1 auth: OTP DEV ECHO — this code was NOT delivered by SMS", {
        challengeId: challenge.id,
        code,
      });
    }

    // Recorded rather than silently dropped: the contract accepts a language
    // and there is nothing to send in it yet, so at least say so once.
    ctx.log.info("v1 auth: OTP challenge created", {
      challengeId: challenge.id,
      deviceId,
      requestedLanguage: language ?? null,
      delivered: sender.configured,
    });

    return {
      data: {
        challengeId: challenge.id,
        codeLength: OTP_CODE_LENGTH,
        expiresAt: toTimestamp(challenge.expiresAt),
        resendAfter: toTimestamp(
          new Date(challenge.createdAt.getTime() + OTP_RESEND_INTERVAL_SECONDS * 1000),
        ),
      },
    };
  },
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
