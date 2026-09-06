/**
 * The one place that turns an invitation into a working account.
 *
 * `inviteMember` writes a User with `status: PENDING` and no passwordHash, plus
 * the CompanyMember row that IS the invitation record — who was invited, to
 * which company, in which role. Nothing in this codebase ever wrote ACTIVE back
 * to such a user or gave them a way to set a first password, so every invited
 * colleague was permanently locked out by four individually-correct refusals.
 * This module is the missing state change, and nothing else performs it.
 *
 * Both halves of the flow live here on purpose. `inviteAcceptUrl` decides
 * whether an address is an OPEN INVITATION before a link is minted, and
 * `acceptInvite` decides the same thing again, against committed state, at the
 * moment the link is used. Sharing the predicate is what keeps the two answers
 * from drifting; re-deciding at redemption is what makes a stateless token
 * revocable — an admin who deactivates the membership kills the outstanding
 * link that instant, with no stored row to revoke.
 *
 * TWO RULES THIS FILE EXISTS TO ENFORCE, both of them the expensive kind:
 *
 * 1. ACCEPTANCE IS NOT A PASSWORD RESET. It refuses any account that already
 *    has a passwordHash, and any status other than PENDING. Conflating the two
 *    would make an invitation link an account-takeover path against an existing
 *    active colleague, which is precisely what password reset exists to do
 *    safely (with its own proof and its own token). The `passwordHash: null`
 *    clause is checked before the transaction AND carried inside the CAS.
 *
 * 2. THE ROLE COMES FROM THE INVITE, NEVER FROM THE REQUEST. There is no role
 *    input anywhere in this module. `isDurableB2BMember` requires
 *    `member.user.role === member.role` — the session's authority for role is
 *    User.role while the company's governance record is CompanyMember.role, and
 *    when they disagree the predicate refuses rather than pick a winner. So
 *    activation re-asserts User.role FROM the membership row the admin issued
 *    and leaves CompanyMember untouched. In practice that is a no-op
 *    (`inviteMember` writes both from one variable, and
 *    `updateGovernedCompanyMember` keeps them in lockstep), but writing it
 *    unconditionally means acceptance cannot possibly produce the worst outcome
 *    available here: someone who passes login and then fails every B2B surface.
 *
 * Node-runtime only — bcrypt and, through lib/invite-token, node:crypto.
 */
import bcrypt from "bcryptjs";
import { AuditAction, CompanyStatus, db, UserRole, UserStatus } from "@avenick/database";
import { log } from "@avenick/observability";
import { fingerprintMatches } from "./password-reset";
import {
  INVITE_ACCEPT_PAGE_PATH,
  InviteTokenSecretMissingError,
  mintInviteToken,
  verifyInviteToken,
} from "./invite-token";

/**
 * The roles an invitation may activate. `inviteMember` only ever writes these
 * three, so anything else on a PENDING row got there another way and is not
 * this flow's business — an ADMIN or SELLER_OWNER account must never be
 * openable by a company invitation link.
 */
const INVITABLE_ROLES: ReadonlySet<UserRole> = new Set([
  UserRole.COMPANY_ADMIN,
  UserRole.COMPANY_BUYER,
  UserRole.COMPANY_APPROVER,
]);

/** One shape, so the mint side and the redeem side judge the same facts. */
const INVITEE_SELECT = {
  id: true,
  email: true,
  passwordHash: true,
  role: true,
  status: true,
  deletedAt: true,
  emailVerified: true,
  companyMember: {
    select: {
      id: true,
      role: true,
      isActive: true,
      companyId: true,
      company: { select: { id: true, status: true, deletedAt: true } },
    },
  },
} as const;

type Invitee = {
  id: string;
  email: string;
  passwordHash: string | null;
  role: UserRole;
  status: UserStatus;
  deletedAt: Date | null;
  emailVerified: Date | null;
  companyMember: {
    id: string;
    role: UserRole;
    isActive: boolean;
    companyId: string;
    company: { id: string; status: CompanyStatus; deletedAt: Date | null } | null;
  } | null;
};

/**
 * Is this row still an invitation someone may accept?
 *
 * PENDING with no password is the invitation itself; the membership must still
 * be active and its company must still be a company. A SUSPENDED company is
 * refused because suspension is a deliberate act by an operator, but
 * PENDING_VERIFICATION is NOT: a company can slip out of ACTIVE between the
 * invite and the acceptance, and refusing there would re-create the exact
 * defect this module fixes, in a new costume. Letting them in leaves them
 * facing /b2b/register's honest "your company is still being verified" page —
 * `isDurableB2BMember` still holds the B2B surfaces shut — which is a far
 * better place to stand than a dead link with nobody to ask.
 */
function openInvitation(user: Invitee | null): NonNullable<Invitee["companyMember"]> | null {
  if (!user || user.deletedAt) return null;
  if (user.status !== UserStatus.PENDING) return null;
  // The credential test, not just the status test: an account that already has
  // a password is somebody's working account, whatever its status says.
  if (user.passwordHash !== null) return null;
  if (!INVITABLE_ROLES.has(user.role)) return null;

  const member = user.companyMember;
  if (!member || !member.isActive) return null;
  const company = member.company;
  if (!company || company.deletedAt || company.status === CompanyStatus.SUSPENDED) return null;

  return member;
}

/**
 * The link that goes in the invitation mail, or null if this address is not an
 * open invitation.
 *
 * Minting is gated on the same predicate as redemption so that a token cannot
 * exist for an account that could never use it — in particular, an invitation
 * mail can never carry a working link to an ACTIVE colleague's account, no
 * matter who calls this or with what address.
 */
export async function inviteAcceptUrl(input: { email: string; origin: string }): Promise<string | null> {
  const email = input.email.trim().toLowerCase();
  const user = (await db.user.findUnique({ where: { email }, select: INVITEE_SELECT })) as Invitee | null;
  if (!openInvitation(user) || !user) return null;

  try {
    const token = mintInviteToken({ uid: user.id, passwordHash: user.passwordHash });
    return `${input.origin}${INVITE_ACCEPT_PAGE_PATH}?token=${encodeURIComponent(token)}`;
  } catch (e) {
    if (e instanceof InviteTokenSecretMissingError) {
      // Loud: a deployment with no AUTH_SECRET cannot invite anyone, and a
      // silently link-less invitation mail would be worse than none at all.
      log.error("invite link not minted: no signing secret (AUTH_SECRET or NEXTAUTH_SECRET)", undefined, {
        path: "lib/invite-acceptance",
      });
      return null;
    }
    throw e;
  }
}

export type InviteAcceptResult =
  | { ok: true; userId: string; role: UserRole; companyId: string }
  /** The deployment lost its signing key; nobody's token can be judged. */
  | { ok: false; reason: "no-secret" }
  /** Every other failure, deliberately indistinguishable. */
  | { ok: false; reason: "invalid" };

/**
 * Redeem an acceptance token: set the first password, PENDING → ACTIVE.
 *
 * Every refusal collapses to "invalid". A bad signature, an expired link, a
 * link already used, an account that is no longer PENDING, a membership an
 * admin has since deactivated and an address that never existed all answer the
 * same way, because telling them apart hands a token holder — or anyone
 * guessing — an oracle over account state. The fix is the same for all of them:
 * ask your administrator for a new invitation.
 */
export async function acceptInvite(input: {
  token: string;
  password: string;
  ipAddress?: string | null;
  nowMs?: number;
}): Promise<InviteAcceptResult> {
  const verification = verifyInviteToken(input.token, input.nowMs ?? Date.now());
  if (!verification.ok) {
    if (verification.reason === "no-secret") return { ok: false, reason: "no-secret" };
    return { ok: false, reason: "invalid" };
  }
  const { uid, hf } = verification.payload;

  // Hashed here, before the account is loaded, rather than after the checks
  // pass: bcrypt at cost 12 is by far the most expensive thing this function
  // does, so spending it on every signature-valid request keeps the response
  // time from saying which of the checks below refused. The happy path pays
  // nothing extra — it needed the hash anyway.
  const passwordHash = await bcrypt.hash(input.password, 12);

  const user = (await db.user.findUnique({ where: { id: uid }, select: INVITEE_SELECT })) as Invitee | null;
  // Re-read and re-decide: the token states what was true when it was minted,
  // and status, membership and company can all change during its seven days.
  const member = openInvitation(user);
  if (!user || !member) return { ok: false, reason: "invalid" };

  // Single use, without a "redeemed" column: the fingerprint was taken from the
  // hash at mint time — the literal "none" for an invitee — so once acceptance
  // writes a real hash, this token and every copy of it stop matching.
  if (!fingerprintMatches(hf, user.passwordHash)) return { ok: false, reason: "invalid" };

  const now = new Date();
  const accepted = await db.$transaction(async (tx) => {
    // `passwordHash: null` and `status: PENDING` are in the WHERE, not only in
    // the checks above: two redemptions of the same link racing past them must
    // not both win, and neither may land on an account that acquired a password
    // in between. Prisma renders `passwordHash: null` as IS NULL.
    const updated = await tx.user.updateMany({
      where: { id: user.id, passwordHash: null, status: UserStatus.PENDING },
      data: {
        passwordHash,
        status: UserStatus.ACTIVE,
        // Inherited from the invitation the admin issued, never from the
        // request — and re-asserted so User.role and CompanyMember.role cannot
        // be unequal at the moment this person first becomes able to sign in.
        // See rule 2 in the file header.
        role: member.role,
        // Following the link proves the mailbox, which is what verification asks
        // for; an invitee has never had the chance to prove it before now.
        emailVerified: user.emailVerified ?? now,
      },
    });
    if (updated.count !== 1) return false;

    await tx.auditLog.create({
      data: {
        // The invitee is the actor: this is the one thing in the flow they do
        // themselves. The admin's half is already recorded against the
        // CompanyMember row by inviteMember.
        actorId: user.id,
        entityType: "User",
        entityId: user.id,
        action: AuditAction.UPDATE,
        after: {
          inviteAccepted: true,
          companyId: member.companyId,
          companyMemberId: member.id,
          role: member.role,
          status: UserStatus.ACTIVE,
        },
        ipAddress: input.ipAddress ?? null,
      },
    });
    return true;
  });
  if (!accepted) return { ok: false, reason: "invalid" };

  return { ok: true, userId: user.id, role: member.role, companyId: member.companyId };
}
