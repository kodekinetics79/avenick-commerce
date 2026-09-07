import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { AuditAction, db, UserRole, UserStatus } from "@avenick/database";
import { checkRateLimit, clientIpFrom, RATE_LIMITS } from "@avenick/auth/rate-limit";
import { log } from "@avenick/observability";
import { RegisterConsumerSchema } from "@avenick/types";
import { fingerprintMatches, verifyInvitationToken } from "@/lib/invitation";

// node:crypto (token verification) and bcrypt have no edge build; pin the
// runtime so a future default change cannot silently move this handler.
export const runtime = "nodejs";

const PATH = "/api/auth/invitation/accept";

/**
 * The password rules are the registration schema's own, not a copy: an
 * invitation that accepted a weaker password than registration would be the
 * easy way around the registration rule.
 */
const AcceptSchema = z.object({
  token: z.string().min(1).max(4096),
  password: RegisterConsumerSchema.shape.password,
});

/** Admin accounts are outside every public credential flow on this portal. */
const ADMIN_ROLES: ReadonlySet<UserRole> = new Set([UserRole.ADMIN, UserRole.SUPER_ADMIN]);

/**
 * One rejection for every way an invitation can be unusable — bad signature,
 * expired, already accepted, account withdrawn, membership revoked. Telling
 * them apart would let a token holder probe an account's state, and the fix is
 * the same for all of them: ask the person who invited you to send it again.
 */
function invalidToken() {
  return NextResponse.json(
    {
      success: false,
      code: "invalid-token",
      error: "This invitation link is invalid, has expired, or has already been used. Ask your company administrator to send a new one.",
    },
    { status: 400 },
  );
}

export async function POST(req: NextRequest) {
  try {
    const rl = await checkRateLimit(RATE_LIMITS.invitationAccept, clientIpFrom(req.headers));
    if (!rl.ok) {
      return NextResponse.json(
        { success: false, error: "Too many attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
      );
    }

    const body: unknown = await req.json().catch(() => null);
    const parsed = AcceptSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    const { token, password } = parsed.data;

    const verification = verifyInvitationToken(token);
    if (!verification.ok) {
      if (verification.reason === "no-secret") {
        // Nothing could have been minted without a secret, so this is a
        // deployment losing its key between invite and acceptance — loud,
        // not "invalid link".
        log.error("invitation.accept refused: no signing secret (AUTH_SECRET or NEXTAUTH_SECRET)", undefined, { path: PATH });
        return NextResponse.json(
          { success: false, error: "Invitations cannot be accepted from this environment." },
          { status: 500 },
        );
      }
      return invalidToken();
    }
    const { uid, hf } = verification.payload;

    const user = await db.user.findUnique({
      where: { id: uid },
      select: {
        id: true,
        passwordHash: true,
        role: true,
        status: true,
        deletedAt: true,
        emailVerified: true,
        // The membership is what an invitation IS. Requiring it here means a
        // token can only ever activate the kind of account this flow creates,
        // and that an admin who removed the member before they accepted has
        // actually withdrawn the invitation rather than merely hidden it.
        companyMember: { select: { id: true, companyId: true, isActive: true } },
      },
    });

    // Re-checked here rather than trusted from the invite: seven days is long
    // enough for any of these to have changed since the link was sent.
    //
    // status must be PENDING, not "not SUSPENDED". This route grants standing —
    // it is the only place a PENDING account becomes ACTIVE — so it accepts
    // exactly the state it was designed to move out of. A SUSPENDED or BANNED
    // account must never be resurrected by an old invitation sitting in a
    // mailbox, and an already-ACTIVE account has nothing here to gain.
    if (
      !user ||
      user.deletedAt ||
      user.status !== UserStatus.PENDING ||
      ADMIN_ROLES.has(user.role) ||
      !user.companyMember ||
      !user.companyMember.isActive
    ) {
      return invalidToken();
    }

    // Single use: the fingerprint was taken from the hash at mint time (the
    // literal "none" for an account that has never had one), so an accepted
    // invitation — or a password set by any other route since — no longer
    // matches. A token carrying no fingerprint at all is not an invitation this
    // route ever issued, whatever its signature says.
    if (!hf || !fingerprintMatches(hf, user.passwordHash)) return invalidToken();

    const passwordHash = await bcrypt.hash(password, 12);
    const now = new Date();

    const accepted = await db.$transaction(async (tx) => {
      // The hash AND the status are part of the WHERE, not only the checks
      // above: two acceptances of the same link racing past them must not both
      // succeed. Prisma treats `passwordHash: null` as IS NULL.
      const updated = await tx.user.updateMany({
        where: { id: user.id, passwordHash: user.passwordHash, status: UserStatus.PENDING },
        data: {
          passwordHash,
          status: UserStatus.ACTIVE,
          // Following the link proves the mailbox, which is what verification
          // asks for. The address was chosen by the inviting admin rather than
          // typed by its owner, so this is the first moment anyone has proved
          // it receives mail at all.
          emailVerified: user.emailVerified ?? now,
        },
      });
      if (updated.count !== 1) return false;

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          entityType: "User",
          entityId: user.id,
          action: AuditAction.UPDATE,
          after: { invitationAccepted: true, companyId: user.companyMember?.companyId ?? null },
          ipAddress: clientIpFrom(req.headers),
        },
      });
      return true;
    });
    if (!accepted) return invalidToken();

    log.info("invitation.accept: account activated", { path: PATH, userId: user.id });
    return NextResponse.json({ success: true });
  } catch (e) {
    log.error("invitation.accept failed", e, { path: PATH });
    return NextResponse.json({ success: false, error: "Could not accept the invitation" }, { status: 500 });
  }
}
