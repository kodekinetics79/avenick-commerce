import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CompanyJoinRequestStatus, db, UserRole } from "@avenick/database";
import { checkRateLimit, clientIpFrom, RATE_LIMITS } from "@avenick/auth/rate-limit";
import { log } from "@avenick/observability";
import { selfOrigin } from "@avenick/utils/portal-config";
import { sendJoinRequestPendingEmail } from "@/lib/email";
import { verifyEmailVerificationToken } from "@/lib/email-verification";

// node:crypto (token verification) has no edge build; pin the runtime so a
// future default change cannot silently move this handler.
export const runtime = "nodejs";

const PATH = "/api/auth/register/join/verify";

/** Where a notified administrator is sent to act on the request. */
const TEAM_PAGE_PATH = "/b2b/team";

const VerifySchema = z.object({ token: z.string().min(1).max(4096) });

/**
 * One rejection for every way a confirmation link can be unusable — bad
 * signature, expired, application withdrawn, already confirmed. Telling them
 * apart would let a link holder probe whether an application exists, and the
 * remedy is the same for all of them: apply again.
 */
function invalidToken() {
  return NextResponse.json(
    {
      success: false,
      code: "invalid-token",
      error: "This confirmation link is invalid or has expired. Please submit your request again.",
    },
    { status: 400 },
  );
}

export async function POST(req: NextRequest) {
  try {
    const rl = await checkRateLimit(RATE_LIMITS.emailVerification, clientIpFrom(req.headers));
    if (!rl.ok) {
      return NextResponse.json(
        { success: false, error: "Too many attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
      );
    }

    const body: unknown = await req.json().catch(() => null);
    const parsed = VerifySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ success: false, error: "Invalid input" }, { status: 400 });

    const verification = verifyEmailVerificationToken(parsed.data.token);
    if (!verification.ok) {
      if (verification.reason === "no-secret") {
        log.error("register.join.verify refused: no signing secret (AUTH_SECRET or NEXTAUTH_SECRET)", undefined, { path: PATH });
        return NextResponse.json(
          { success: false, error: "Email confirmation is not available from this environment." },
          { status: 500 },
        );
      }
      return invalidToken();
    }
    const { uid } = verification.payload;

    const request = await db.companyJoinRequest.findUnique({
      where: { userId: uid },
      select: {
        id: true,
        status: true,
        company: { select: { id: true, nameEn: true } },
        user: { select: { id: true, firstName: true, lastName: true, email: true, deletedAt: true } },
      },
    });

    // Re-checked here rather than trusted from the token: the application can
    // have been withdrawn, decided or confirmed already in the day the link
    // lives. Only PENDING_EMAIL_VERIFICATION is acceptable — this route's whole
    // job is to move a request out of that state, so any other state means the
    // link has nothing left to do.
    if (!request || request.user.deletedAt || request.status !== CompanyJoinRequestStatus.PENDING_EMAIL_VERIFICATION) {
      return invalidToken();
    }

    const now = new Date();

    // The company's administrators, resolved before the write so the
    // notification rows can be created inside the same transaction as the
    // status change: an approval queue that advanced without telling anybody
    // is the failure mode this whole step exists to avoid.
    const admins = await db.companyMember.findMany({
      where: { companyId: request.company.id, role: UserRole.COMPANY_ADMIN, isActive: true },
      select: { user: { select: { id: true, email: true, status: true, deletedAt: true } } },
    });
    const notifiable = admins
      .map((a) => a.user)
      .filter((u) => !u.deletedAt && u.status === "ACTIVE");

    const applicantName = `${request.user.firstName} ${request.user.lastName}`.trim();

    const confirmed = await db.$transaction(async (tx) => {
      // The status is in the WHERE, not only in the check above: two clicks of
      // the same link racing past it must not both notify the administrators.
      const updated = await tx.companyJoinRequest.updateMany({
        where: { id: request.id, status: CompanyJoinRequestStatus.PENDING_EMAIL_VERIFICATION },
        data: { status: CompanyJoinRequestStatus.PENDING_ADMIN_APPROVAL, emailVerifiedAt: now },
      });
      if (updated.count !== 1) return false;

      // The address is now proven. This is the only claim confirming a link
      // establishes: it says nothing about whether the person may join.
      await tx.user.update({ where: { id: request.user.id }, data: { emailVerified: now } });

      if (notifiable.length > 0) {
        await tx.notification.createMany({
          data: notifiable.map((admin) => ({
            userId: admin.id,
            type: "SYSTEM" as const,
            titleEn: "A colleague has asked to join your company",
            bodyEn: `${applicantName} (${request.user.email}) has confirmed their email address and is waiting for your approval.`,
            data: { joinRequestId: request.id, companyId: request.company.id },
          })),
        });
      }
      return true;
    });
    if (!confirmed) return invalidToken();

    // Mail is sent AFTER the transaction commits: a provider that hangs must
    // not hold a write transaction open, and a mail sent for a write that then
    // rolled back is worse than a mail that was never sent.
    const origin = selfOrigin("customer");
    if (origin && notifiable.length > 0) {
      const teamUrl = `${origin}${TEAM_PAGE_PATH}`;
      await Promise.all(
        notifiable.map((admin) =>
          sendJoinRequestPendingEmail({
            to: admin.email,
            companyName: request.company.nameEn,
            applicantName,
            applicantEmail: request.user.email,
            teamUrl,
          }),
        ),
      );
    } else if (!origin) {
      // The in-app notification rows were still written, so the request is not
      // lost — but nobody has been told, and that is worth an error line.
      log.error("register.join.verify: administrators not emailed, portal origin is not configured", undefined, { path: PATH });
    }

    log.info("register.join.verify: address confirmed, awaiting company approval", {
      path: PATH,
      userId: request.user.id,
      administratorsNotified: notifiable.length,
    });
    return NextResponse.json({
      success: true,
      data: { companyName: request.company.nameEn, administratorsNotified: notifiable.length },
    });
  } catch (e) {
    log.error("register.join.verify failed", e, { path: PATH });
    return NextResponse.json({ success: false, error: "Could not confirm the email address" }, { status: 500 });
  }
}
