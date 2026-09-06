import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, clientIpFrom, RATE_LIMITS } from "@avenick/auth/rate-limit";
import { log } from "@avenick/observability";
import { RegisterBusinessSchema } from "@avenick/types";
import { acceptInvite } from "@/lib/invite-acceptance";

// node:crypto (token verification) and bcrypt have no edge build; pin the
// runtime so a future default change cannot silently move this handler.
export const runtime = "nodejs";

/**
 * Kept in step with `INVITE_REDEEM_ENDPOINT` in
 * app/auth/accept-invite/contract.ts — the acceptance form POSTs to that
 * constant, and this route's folder IS that path. Not imported: a Next.js
 * route's URL comes from its directory, so the literal here is only what the
 * log lines say.
 */
const PATH = "/api/auth/invite/redeem";

/**
 * The password rules are the registration schema's own, not a copy — the same
 * reuse the password-reset redeem route makes, for the same reason: a door that
 * accepted a weaker password than registration would be the easy way around the
 * registration rule. RegisterBusinessSchema rather than the consumer one
 * because an invitee is joining a company, and because the acceptance page
 * states THAT rule in full before anyone types; the two are the same
 * constraints (8-128, an uppercase, a digit) but the business schema spells its
 * messages out, and a rejection should read like the promise it broke.
 *
 * There is no role, company or email field here, and there must never be one.
 * Everything about WHO this person becomes is read from the invitation the
 * administrator issued; the request supplies a token and a password, nothing
 * more.
 */
const AcceptSchema = z.object({
  token: z.string().min(1).max(4096),
  password: RegisterBusinessSchema.shape.password,
});

/**
 * One rejection for every way an invitation can be unusable — bad signature,
 * expired, already accepted, membership revoked, account no longer pending, or
 * simply never existed. Telling them apart would let anyone holding (or
 * guessing) a token probe account state; the remedy is the same for all of
 * them, so the sentence names it.
 */
function invalidToken() {
  return NextResponse.json(
    {
      success: false,
      code: "invalid-token",
      error: "This invitation link is invalid or has expired. Please ask your company administrator to send a new one.",
    },
    { status: 400 },
  );
}

export async function POST(req: NextRequest) {
  try {
    // Keyed per client IP, exactly as the reset redeem route is: the token is
    // HMAC-signed, so this only narrows the window for brute force rather than
    // being the thing that stops it. Deliberately NOT keyed on the address or
    // the uid — both live inside the token, and reading them before throttling
    // would make the throttle itself an oracle.
    const rl = await checkRateLimit(RATE_LIMITS.inviteAccept, clientIpFrom(req.headers));
    if (!rl.ok) {
      return NextResponse.json(
        { success: false, error: "Too many attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
      );
    }

    const body: unknown = await req.json().catch(() => null);
    const parsed = AcceptSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const result = await acceptInvite({
      token: parsed.data.token,
      password: parsed.data.password,
      ipAddress: clientIpFrom(req.headers),
    });

    if (!result.ok) {
      if (result.reason === "no-secret") {
        // Nothing could have been minted without a secret, so this is a
        // deployment losing its key between the invitation and the click —
        // loud, not "invalid link".
        log.error("invite.redeem refused: no signing secret (AUTH_SECRET or NEXTAUTH_SECRET)", undefined, { path: PATH });
        return NextResponse.json(
          { success: false, error: "Invitations cannot be accepted from this environment." },
          { status: 500 },
        );
      }
      return invalidToken();
    }

    // No token, address or password is logged: the first is a credential and
    // the second is the recipient. The user id is already an internal handle.
    log.info("invite.redeem: invitation accepted", { path: PATH, userId: result.userId, role: result.role });
    // Company members are customer-portal accounts; the seller portal is a
    // separate deployment and no invitation can reach it (see INVITABLE_ROLES).
    return NextResponse.json({ success: true, portal: "customer" });
  } catch (e) {
    log.error("invite.redeem failed", e, { path: PATH });
    return NextResponse.json({ success: false, error: "Accepting the invitation failed" }, { status: 500 });
  }
}
