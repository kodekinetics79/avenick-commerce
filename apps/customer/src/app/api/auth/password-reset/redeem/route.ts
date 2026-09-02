import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { AuditAction, db, UserRole, UserStatus } from "@avenick/database";
import { checkRateLimit, clientIpFrom, RATE_LIMITS } from "@avenick/auth/rate-limit";
import { log } from "@avenick/observability";
import { RegisterConsumerSchema } from "@avenick/types";
import { fingerprintMatches, verifyPasswordResetToken } from "@/lib/password-reset";

// node:crypto (token verification) and bcrypt have no edge build; pin the
// runtime so a future default change cannot silently move this handler.
export const runtime = "nodejs";

const PATH = "/api/auth/password-reset/redeem";

/**
 * The password rules are RegisterConsumerSchema's own, not a copy: a reset
 * that accepted a weaker password than registration would be the easy way
 * around the registration rule.
 */
const RedeemSchema = z.object({
  token: z.string().min(1).max(4096),
  password: RegisterConsumerSchema.shape.password,
});

/** Mirrors the request route: admin accounts are outside this flow entirely. */
const ADMIN_ROLES: ReadonlySet<UserRole> = new Set([UserRole.ADMIN, UserRole.SUPER_ADMIN]);
const SELLER_ROLES: ReadonlySet<UserRole> = new Set([UserRole.SELLER_OWNER, UserRole.SELLER_STAFF]);

/**
 * One rejection for every way a token can be unusable — bad signature,
 * expired, already redeemed, account gone or not active. Telling them apart
 * would let a token holder probe an account's state; the fix is the same for
 * all of them: request a new link.
 */
function invalidToken() {
  return NextResponse.json(
    { success: false, code: "invalid-token", error: "This reset link is invalid or has expired. Please request a new one." },
    { status: 400 },
  );
}

export async function POST(req: NextRequest) {
  try {
    const rl = await checkRateLimit(RATE_LIMITS.passwordResetRedeem, clientIpFrom(req.headers));
    if (!rl.ok) {
      return NextResponse.json(
        { success: false, error: "Too many attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
      );
    }

    const body: unknown = await req.json().catch(() => null);
    const parsed = RedeemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    const { token, password } = parsed.data;

    const verification = verifyPasswordResetToken(token);
    if (!verification.ok) {
      if (verification.reason === "no-secret") {
        // Nothing could have been minted without a secret, so this is a
        // deployment losing its key between request and redeem — loud, not
        // "invalid link".
        log.error("password-reset.redeem refused: no signing secret (AUTH_SECRET or NEXTAUTH_SECRET)", undefined, { path: PATH });
        return NextResponse.json(
          { success: false, error: "Password reset is not available from this environment." },
          { status: 500 },
        );
      }
      return invalidToken();
    }
    const { uid, hf } = verification.payload;

    const user = await db.user.findUnique({
      where: { id: uid },
      select: { id: true, passwordHash: true, role: true, status: true, deletedAt: true, emailVerified: true },
    });
    // The account checks are re-done here rather than trusted from the
    // request route: status can change during the token's lifetime.
    if (!user || user.status !== UserStatus.ACTIVE || user.deletedAt || ADMIN_ROLES.has(user.role)) {
      return invalidToken();
    }
    // Single use: the fingerprint was taken from the hash at mint time, so a
    // redeemed token (or any other password change since) no longer matches.
    if (!fingerprintMatches(hf, user.passwordHash)) return invalidToken();

    const passwordHash = await bcrypt.hash(password, 12);
    const now = new Date();

    const redeemed = await db.$transaction(async (tx) => {
      // The hash is part of the WHERE, not only the check above: two
      // redemptions of the same token racing past the fingerprint check must
      // not both succeed. Prisma treats `passwordHash: null` as IS NULL.
      const updated = await tx.user.updateMany({
        where: { id: user.id, passwordHash: user.passwordHash },
        data: {
          passwordHash,
          // Following the link proves the mailbox; that is what verification
          // asks for, so an unverified address becomes verified here.
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
          after: { passwordReset: true },
          ipAddress: clientIpFrom(req.headers),
        },
      });

      // Browser sessions are NextAuth JWTs (session.strategy "jwt" in
      // @avenick/auth config): they carry no server-side row and stay valid
      // until they expire, which no schema-free change can revoke. The Session
      // table exists for database-backed sessions; clearing it costs nothing
      // and is correct the day anything writes to it.
      await tx.session.deleteMany({ where: { userId: user.id } });
      return true;
    });
    if (!redeemed) return invalidToken();

    log.info("password-reset.redeem: password updated", { path: PATH, userId: user.id });
    return NextResponse.json({ success: true, portal: SELLER_ROLES.has(user.role) ? "seller" : "customer" });
  } catch (e) {
    log.error("password-reset.redeem failed", e, { path: PATH });
    return NextResponse.json({ success: false, error: "Password reset failed" }, { status: 500 });
  }
}
