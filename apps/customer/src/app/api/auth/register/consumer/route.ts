import { NextRequest, NextResponse } from "next/server";
import { db } from "@avenick/database";
import bcrypt from "bcryptjs";
import { RegisterConsumerSchema } from "@avenick/types";
import { checkRateLimit, clientIpFrom, RATE_LIMITS } from "@avenick/auth";
import { log } from "@avenick/observability";
import { sendAlreadyRegisteredNotice } from "@/lib/email";

/**
 * One answer, whichever branch ran.
 *
 * This endpoint used to reply 409 "Email already registered", which turned it
 * into a free membership oracle: anyone could ask "is this person an Avenick
 * customer?" one address at a time. The per-IP throttle is not a containment
 * for that — it is spoofable and only slows a list down.
 *
 * The sentence has to be true in BOTH branches, so it promises nothing about
 * which one ran and no email the product cannot actually send. A new account
 * signs in with the password just chosen; an existing one signs in with the
 * password it already has. Either way the next step is the same: /login.
 */
const NEUTRAL_OUTCOME = {
  success: true,
  message:
    "Registration received. Continue to sign in with this email address — if it was already registered, use your existing password.",
} as const;

export async function POST(req: NextRequest) {
  try {
    const rl = await checkRateLimit(RATE_LIMITS.register, clientIpFrom(req.headers));
    if (!rl.ok) {
      return NextResponse.json(
        { success: false, error: "Too many registration attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
      );
    }

    const body = await req.json();
    const parsed = RegisterConsumerSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message }, { status: 400 });

    const { email, password, firstName, lastName, phone, language } = parsed.data;
    const normalisedEmail = email.toLowerCase();

    // Hash before the existence check, not after. bcrypt at cost 12 is by far
    // the most expensive thing this handler does, so hashing only in the
    // create branch would leave the response time itself as the oracle the
    // status code no longer is.
    const passwordHash = await bcrypt.hash(password, 12);

    const existing = await db.user.findUnique({ where: { email: normalisedEmail } });
    if (existing) {
      log.info("register.consumer: address already registered", { path: "/api/auth/register/consumer" });
      await sendAlreadyRegisteredNotice({ to: normalisedEmail, source: "consumer" });
      return NextResponse.json(NEUTRAL_OUTCOME);
    }

    try {
      await db.user.create({
        data: {
          email: normalisedEmail,
          passwordHash,
          firstName,
          lastName,
          phone: phone ?? null,
          role: "CONSUMER",
          status: "ACTIVE",
          language: language === "AR" ? "AR" : "EN",
        },
      });
    } catch (e) {
      // Two requests for the same new address can both pass the check above.
      // The loser must not answer differently from the winner, or the race is
      // itself the oracle.
      if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") {
        await sendAlreadyRegisteredNotice({ to: normalisedEmail, source: "consumer" });
        return NextResponse.json(NEUTRAL_OUTCOME);
      }
      throw e;
    }

    return NextResponse.json(NEUTRAL_OUTCOME);
  } catch (e) {
    log.error("register.consumer failed", e, { path: "/api/auth/register/consumer" });
    return NextResponse.json({ success: false, error: "Registration failed" }, { status: 500 });
  }
}
