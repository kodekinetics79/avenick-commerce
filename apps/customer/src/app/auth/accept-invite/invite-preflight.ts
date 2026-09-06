/**
 * What the acceptance page is allowed to SAY before anyone types a password.
 *
 * The screen has to name the company a person is joining and the role they are
 * joining in, or "set a password" is a request to hand a credential to an
 * unnamed party. Both are read from the database. The invitation email is the
 * one artefact an attacker can compose freely, so nothing displayed here comes
 * out of the query string — the previous flow's entire defect was a link that
 * carried `?email=<address>` and expected a page to trust it.
 *
 * SERVER ONLY. This imports Prisma and, through lib/invite-token, node:crypto.
 * Reaching it from a "use client" module or from middleware breaks the bundle;
 * the acceptance form talks to the redeem endpoint instead and shares only
 * ./contract with this file.
 *
 * THIS IS NOT THE GATE, AND IT MUST NEVER BE STRICTER THAN ONE.
 *
 * `acceptInvite` in lib/invite-acceptance.ts re-reads the account and re-decides
 * everything below at submit time, against committed state — that re-read is
 * what makes a stateless token revocable. A preflight the endpoint trusted would
 * be an authorisation bug; a preflight that refuses what the endpoint would
 * accept is worse in a subtler way, because it is a FIFTH closed door in front
 * of a person who is already locked out by four correct ones. So the predicate
 * below mirrors `openInvitation` there exactly, including the deliberate
 * decision to admit a company that has slipped to PENDING_VERIFICATION. If the
 * two ever drift, the endpoint is right and this file is wrong.
 *
 * The cross-track fix is for lib/invite-acceptance.ts to export its predicate
 * (or a `previewInvitation(token)`) and for this file to call it, so there is
 * one copy rather than two that agree today.
 */
import { CompanyStatus, db, UserRole, UserStatus } from "@avenick/database";
import { fingerprintMatches } from "@/lib/password-reset";
import { verifyInviteToken } from "@/lib/invite-token";
import type { IdentityLocale } from "../identity-copy";

/**
 * The roles an invitation may activate — the three `inviteMember` writes. A
 * PENDING ADMIN or SELLER_OWNER row got there some other way, and no company
 * invitation link may open one. Mirrors INVITABLE_ROLES in lib/invite-acceptance.ts.
 */
const INVITABLE_ROLES: ReadonlySet<string> = new Set([
  UserRole.COMPANY_ADMIN,
  UserRole.COMPANY_BUYER,
  UserRole.COMPANY_APPROVER,
]);

export type InvitePreview =
  | { ok: true; companyName: string; role: string; expiresAt: Date }
  | { ok: false; reason: "missing" | "no-secret" | "dead" };

/**
 * Verify an invitation link far enough to render an honest page.
 *
 * ONE REJECTION FOR EVERY DEAD END. Expired, forged, already used, membership
 * deactivated, company suspended and "no such user" all return `"dead"`. They
 * are genuinely different conditions, and telling them apart is exactly what
 * would turn this page — reachable by anyone holding a URL — into the membership
 * oracle that /register, /login and /auth/forgot-password each go out of their
 * way not to be. `"no-secret"` is separate because it is a fault in THIS
 * deployment rather than a statement about any account, and an operator has to
 * be able to tell the difference.
 *
 * `verifyInviteToken`, never `verifyPasswordResetToken`: the invite key is
 * HMAC(appSecret, "avenick:invite-token:v1") rather than the app secret itself,
 * so the two token families fail each other's SIGNATURE check before anything
 * inside them is parsed. That domain separation is the whole reason a password
 * reset link cannot be walked in here to activate a pending account.
 */
export async function previewInvite(
  token: string | null | undefined,
  locale: IdentityLocale,
): Promise<InvitePreview> {
  if (!token) return { ok: false, reason: "missing" };

  const verified = verifyInviteToken(token);
  if (!verified.ok) {
    return { ok: false, reason: verified.reason === "no-secret" ? "no-secret" : "dead" };
  }

  const user = await db.user.findUnique({
    where: { id: verified.payload.uid },
    select: {
      role: true,
      status: true,
      deletedAt: true,
      passwordHash: true,
      // CompanyMember.userId is @unique, so this is THE membership, not one of
      // several. The row `inviteMember` wrote IS the invitation record — there
      // is no Invite table, and a second one would be a second source of truth
      // about a person's role.
      companyMember: {
        select: {
          role: true,
          isActive: true,
          company: { select: { nameEn: true, nameAr: true, status: true, deletedAt: true } },
        },
      },
    },
  });

  const member = user?.companyMember;
  const company = member?.company;

  const usable = Boolean(
    user &&
      !user.deletedAt &&
      user.status === UserStatus.PENDING &&
      // The credential test, not just the status test: an account that already
      // has a password is somebody's working account, whatever its status says.
      user.passwordHash === null &&
      INVITABLE_ROLES.has(user.role) &&
      // Single use, from the fingerprint rather than a "redeemed" column: the
      // token was minted against a null hash, and writing the first real one
      // kills it. Someone who has already accepted lands here.
      fingerprintMatches(verified.payload.hf, user.passwordHash) &&
      member &&
      // Revocation without a stored row: the administrator deactivates the
      // membership and the outstanding link dies that instant.
      member.isActive &&
      company &&
      !company.deletedAt &&
      // SUSPENDED only. A company sitting at PENDING_VERIFICATION is admitted
      // on purpose — see the note on openInvitation in lib/invite-acceptance.ts.
      // They land on /b2b/register's application-status page, which is a far
      // better place to stand than a dead link with nobody to ask.
      company.status !== CompanyStatus.SUSPENDED,
  );
  if (!usable || !member || !company) return { ok: false, reason: "dead" };

  return {
    ok: true,
    // The filed Arabic name where there is one, the filed English name
    // otherwise. A blank heading would not be kinder than a name in the other
    // script, and neither name is a translation of the other — both are as filed.
    companyName: (locale === "ar" ? company.nameAr : null) || company.nameEn,
    role: member.role,
    // From the signed `exp` rather than from INVITE_TTL_SECONDS, so the instant
    // this page promises is the instant the verifier will actually enforce for
    // THIS token — a link minted before the constant last changed included.
    expiresAt: new Date(verified.payload.exp * 1000),
  };
}
