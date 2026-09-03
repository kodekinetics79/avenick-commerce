import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db, UserRole, UserStatus } from "@avenick/database";
import { checkRateLimit, clientIpFrom, RATE_LIMITS } from "@avenick/auth/rate-limit";
import { log } from "@avenick/observability";
import { selfOrigin } from "@avenick/utils/portal-config";
import { mintPasswordResetToken, resolvePasswordResetSecret } from "@/lib/password-reset";
import { mailDeliveryConfigured, recipientRef, sendPasswordResetEmail } from "@/lib/email";

// node:crypto (token signing) and bcrypt have no edge build; pin the runtime
// so a future default change cannot silently move this handler.
export const runtime = "nodejs";

const PATH = "/api/auth/password-reset/request";

const RequestSchema = z.object({ email: z.string().trim().email().max(254) });

/** The path of the reset page on this portal; the origin is resolved per deployment. */
const RESET_PAGE_PATH = "/auth/reset-password";

/**
 * Admin accounts never get a reset link from a public form. The admin login
 * page says so; here the request is logged (pseudonymously) and answered like
 * any other, so the form is not an oracle for "is this an admin address".
 * Every role in the UserRole enum is either here or eligible — keep this set
 * in step with schema.prisma when a role is added.
 */
const ADMIN_ROLES: ReadonlySet<UserRole> = new Set([UserRole.ADMIN, UserRole.SUPER_ADMIN]);

/**
 * One answer, whichever branch ran. The form prints the sentence ("If an
 * account exists for that address…"); the route promises nothing about which
 * branch it took.
 */
const NEUTRAL_OUTCOME = { success: true } as const;

/**
 * Something for the "no mail goes out" branches to spend, so the response
 * time is not the oracle the status code refuses to be. bcrypt at cost 12 is
 * roughly what the outbound provider call costs the other branch; the input is
 * irrelevant, only the work matters.
 */
async function spendAsIfSending(): Promise<void> {
  await bcrypt.hash("password-reset-timing-equaliser", 12);
}

/** The one answer for every address-independent precondition that failed. */
function unavailable() {
  return NextResponse.json(
    { success: false, error: "Password reset is not available from this environment." },
    { status: 500 },
  );
}

export async function POST(req: NextRequest) {
  try {
    // Misconfiguration is checked before anything depends on the address, so a
    // 500 here is the same for every caller and says nothing about accounts.
    // All three are loud on purpose: a reset flow that silently sends nothing
    // is a locked door with a sign that says "open" — and the neutral sentence
    // the form prints ("we have sent a reset link") would be a lie for every
    // account that exists.
    if (!resolvePasswordResetSecret()) {
      log.error("password-reset.request refused: no signing secret (AUTH_SECRET or NEXTAUTH_SECRET)", undefined, { path: PATH });
      return unavailable();
    }
    // This app addressing itself: the same resolver the invitation and
    // already-registered mails use, so one deployment has one answer to "what
    // is our origin" (NEXT_PUBLIC_CUSTOMER_PORTAL_URL, else what the host
    // platform knows — see DEPLOYMENT.md).
    const origin = selfOrigin("customer");
    if (!origin) {
      log.error("password-reset.request refused: customer portal origin is not configured", undefined, { path: PATH });
      return unavailable();
    }
    const resetPage = `${origin}${RESET_PAGE_PATH}`;
    const mail = mailDeliveryConfigured();
    if (!mail.ok) {
      log.error("password-reset.request refused: this deployment cannot send mail", undefined, { path: PATH, reason: mail.reason });
      return unavailable();
    }

    const byIp = await checkRateLimit(RATE_LIMITS.passwordResetRequestIp, clientIpFrom(req.headers));
    if (!byIp.ok) {
      return NextResponse.json(
        { success: false, error: "Too many reset requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((byIp.resetAt - Date.now()) / 1000)) } },
      );
    }

    const body: unknown = await req.json().catch(() => null);
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Enter a valid email address." }, { status: 400 });
    }
    const email = parsed.data.email.toLowerCase();

    // Per-address cap, counted whether or not the address exists — so a 429
    // reveals only that someone has been asking for this address, which the
    // person asking already knows.
    const byAddress = await checkRateLimit(RATE_LIMITS.passwordResetRequest, email);
    if (!byAddress.ok) {
      return NextResponse.json(
        { success: false, error: "Too many reset requests for this address. Please wait before trying again." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((byAddress.resetAt - Date.now()) / 1000)) } },
      );
    }

    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, firstName: true, passwordHash: true, role: true, status: true, deletedAt: true },
    });

    if (user && ADMIN_ROLES.has(user.role)) {
      log.warn("password-reset.request: admin address refused a public reset", { path: PATH, recipientRef: recipientRef(email) });
      await spendAsIfSending();
      return NextResponse.json(NEUTRAL_OUTCOME);
    }

    // Suspended, banned, pending (invited, never activated) and erased
    // accounts get no link: a mailbox proves ownership, not standing.
    const eligible = Boolean(user && user.status === UserStatus.ACTIVE && !user.deletedAt);
    if (!user || !eligible) {
      await spendAsIfSending();
      return NextResponse.json(NEUTRAL_OUTCOME);
    }

    const token = mintPasswordResetToken({ uid: user.id, passwordHash: user.passwordHash });
    const resetUrl = `${resetPage}?token=${encodeURIComponent(token)}`;
    const outcome = await sendPasswordResetEmail({ to: email, resetUrl, firstName: user.firstName });
    // Configuration was proven above, so a miss here is the provider refusing
    // or the request failing, and the mail layer has already logged which. The
    // answer stays neutral regardless: a different status for "exists but
    // could not be mailed" would reopen the existence oracle. What is
    // equalised is the cost — a failed send can return fast, so the branch
    // spends the hash instead.
    if (!outcome.sent) await spendAsIfSending();

    return NextResponse.json(NEUTRAL_OUTCOME);
  } catch (e) {
    log.error("password-reset.request failed", e, { path: PATH });
    return NextResponse.json({ success: false, error: "Password reset request failed" }, { status: 500 });
  }
}
