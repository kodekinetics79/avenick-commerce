"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, updateGovernedCompanyMember } from "@avenick/database";
import { getB2BContext, type B2BActionState } from "@/lib/b2b";
import { actionT } from "@/components/b2b/action-i18n";
import { sendInviteEmail, sendJoinApprovedEmail } from "@/lib/email";
import { selfOrigin } from "@avenick/utils/portal-config";

const ROLES = ["COMPANY_ADMIN", "COMPANY_BUYER", "COMPANY_APPROVER"] as const;
type Role = (typeof ROLES)[number];

const TEAM = "/b2b/team";

export async function inviteMember(_prev: B2BActionState, formData: FormData): Promise<B2BActionState> {
  const t = actionT();
  const ctx = await getB2BContext();
  if (!ctx || ctx.member.role !== "COMPANY_ADMIN") return { error: t("act.team.adminOnly") };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "COMPANY_BUYER") as Role;
  const department = String(formData.get("department") ?? "").trim() || null;
  const spendRaw = String(formData.get("spendLimit") ?? "").trim();
  const spendLimit = spendRaw ? Number(spendRaw) : null;

  if (!name || !email) return { error: t("act.team.needNameEmail") };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: t("act.team.emailInvalid") };
  if (!ROLES.includes(role)) return { error: t("act.team.roleInvalid") };
  if (spendRaw && (Number.isNaN(spendLimit) || (spendLimit ?? 0) < 0)) return { error: t("act.team.spendPositive") };

  // A taken address used to be one dead end regardless of who held it, and the
  // commonest case by far is the colleague THIS admin invited last week and is
  // now trying to invite again because the first mail went unanswered. That
  // person cannot be invited twice — CompanyMember.userId is unique and the
  // User row already exists — so the answer is to point at the row that is
  // already on their own screen, and at the button that re-sends it.
  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true, status: true, companyMember: { select: { companyId: true } } },
  });
  if (existing) {
    const oursAndPending =
      existing.companyMember?.companyId === ctx.companyId && existing.status === "PENDING";
    return { error: oursAndPending ? t("act.team.alreadyInvited") : t("act.team.emailTaken") };
  }

  const [firstName, ...rest] = name.split(" ");
  try {
    await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, firstName: firstName || name, lastName: rest.join(" ") || "—", role, status: "PENDING" },
      });
      const membership = await tx.companyMember.create({
        data: { userId: user.id, companyId: ctx.companyId, role, department, spendLimit },
      });
      await tx.auditLog.create({
        data: {
          actorId: ctx.userId,
          entityType: "CompanyMember",
          entityId: membership.id,
          action: "CREATE",
          after: { companyId: ctx.companyId, userId: user.id, role, department, spendLimit },
        },
      });
    });
  } catch {
    return { error: t("act.team.failed") };
  }

  const inviter = await db.user.findUnique({ where: { id: ctx.userId }, select: { firstName: true, lastName: true } });
  const { sent } = await sendInviteEmail({
    to: email,
    companyName: ctx.company.nameEn,
    inviterName: inviter ? `${inviter.firstName} ${inviter.lastName}`.trim() : ctx.company.nameEn,
    role,
  });

  revalidatePath(TEAM);
  return {
    ok: true,
    message: sent ? t("act.team.inviteSent", { email }) : t("act.team.inviteNotSent", { email }),
  };
}

/**
 * Send the invitation again to a colleague who has not accepted it.
 *
 * WHY THIS EXISTS. `inviteMember` writes the User and the CompanyMember row and
 * mails a link, and then there was no second attempt available to anybody: the
 * address is taken from that moment on, so re-inviting is refused, and nothing
 * else on the screen would ever produce another mail. Acceptance links expire
 * after seven days (INVITE_TTL_SECONDS in lib/invite-token.ts), so without this
 * a colleague who deleted the message — or simply took a fortnight's leave —
 * was locked out permanently and their administrator had no lever at all.
 *
 * WHY IT RE-READS EVERYTHING. The row on the admin's screen was rendered at
 * some earlier moment: since then the invitee may have accepted, been revoked,
 * or been soft-deleted. The membership is re-loaded and re-judged here, against
 * the company in the CURRENT session's context, so a stale page cannot mail an
 * invitation to somebody who is no longer entitled to one.
 *
 * WHY IT REPORTS THROUGH THE QUERY STRING. This is bound to a plain <form> in a
 * table row and has no return channel, so it follows the governed
 * purchase-order transitions (app/b2b/purchase-orders/actions.ts): the outcome
 * travels as a CODE and the page states it in the reader's language. A server
 * action runs before the page and has no locale, so any sentence written here
 * could only ever be English.
 */
export async function resendInvite(memberId: string) {
  const ctx = await getB2BContext();
  if (!ctx || ctx.member.role !== "COMPANY_ADMIN") redirect(`${TEAM}?invite=adminOnly`);

  const member = await db.companyMember.findUnique({
    where: { id: memberId },
    include: {
      user: { select: { email: true, status: true, passwordHash: true, deletedAt: true } },
    },
  });
  if (!member || member.companyId !== ctx.companyId) redirect(`${TEAM}?invite=notFound`);
  // Revoked or erased: the invitation is not live, so neither is the resend.
  // Reactivating the membership is the admin's lever for that, not this one.
  if (!member.isActive || member.user.deletedAt) redirect(`${TEAM}?invite=notPending`);
  // Already in. `status` alone would do, but a set passwordHash is the fact
  // that actually decides it — an account with a credential has accepted,
  // whatever else has been written to its status since.
  if (member.user.status !== "PENDING" || member.user.passwordHash) {
    redirect(`${TEAM}?invite=accepted`);
  }

  const inviter = await db.user.findUnique({
    where: { id: ctx.userId },
    select: { firstName: true, lastName: true },
  });
  // A FRESH token every time: sendInviteEmail mints the acceptance link at send
  // time through lib/invite-acceptance (email.ts:250), against committed state,
  // so this posts a new credential rather than repeating an old one.
  //
  // What it does NOT do is revoke the previous link. The token's fingerprint is
  // taken over `passwordHash ?? "none"` (lib/invite-token.ts), so for an
  // invitee who still has no password every mint produces the same `hf` and
  // only a later `exp`: both links stay live until each expires on its own.
  // Nothing here can change that — it is a property of what is signed — and the
  // fix belongs in the payload, not in a second copy of the minting logic.
  const delivery = await sendInviteEmail({
    to: member.user.email,
    companyName: ctx.company.nameEn,
    inviterName: inviter ? `${inviter.firstName} ${inviter.lastName}`.trim() : ctx.company.nameEn,
    role: member.role,
  });

  // The reason is reported, not flattened. "No mail provider on this
  // deployment" and "there is no open invitation for that address any more" are
  // different facts about different problems, and telling an administrator the
  // first when the second is true sends them to check an environment variable
  // over a colleague who has already accepted.
  const code = delivery.sent ? "sent" : delivery.reason === "invite-not-open" ? "notOpen" : "notSent";

  // No row changes, so this AuditLog entry is the ONLY record that a second
  // invitation was posted, by whom, and whether the provider took it. The enum
  // has no send/notify member (packages/database/prisma/schema.prisma
  // AuditAction), so UPDATE is the least wrong of the eleven and the payload
  // names the event outright rather than leaving a reader to infer it from a
  // before/after pair that would be identical.
  await db.auditLog.create({
    data: {
      actorId: ctx.userId,
      entityType: "CompanyMember",
      entityId: member.id,
      action: "UPDATE",
      after: {
        event: "invite-resent",
        companyId: ctx.companyId,
        userId: member.userId,
        sent: delivery.sent,
        reason: delivery.sent ? null : delivery.reason,
      },
    },
  });

  revalidatePath(TEAM);
  // redirect() throws by design and must not sit inside a try block above it.
  redirect(`${TEAM}?invite=${code}`);
}


/**
 * Admit an applicant who has confirmed their address.
 *
 * This is the ONLY place a CompanyJoinRequest becomes authority. Everything
 * before it — the CR match, the domain match, the confirmed mailbox — narrows
 * who may ask; none of it admits anybody. A person becomes a member here,
 * because a human at the company said so.
 *
 * REJECTED is accepted alongside PENDING_ADMIN_APPROVAL on purpose. An
 * applicant cannot re-apply (one request per person, by construction), so if
 * rejection were final a mis-click would lock a colleague out permanently and
 * even an invitation would then fail on "that address is already registered".
 * The admin who rejected keeps the lever to undo it.
 */
export async function approveJoinRequest(
  requestId: string,
  _prev: B2BActionState,
  formData: FormData,
): Promise<B2BActionState> {
  const t = actionT();
  const ctx = await getB2BContext();
  if (!ctx || ctx.member.role !== "COMPANY_ADMIN") return { error: t("act.join.adminOnly") };

  // The role the ADMIN chooses, not the one the applicant asked for. The
  // request's requestedRole is a hint shown in the queue and is never trusted
  // as an instruction — that is what stops an applicant admitting themselves as
  // an administrator by picking it on a public form.
  const role = String(formData.get("role") ?? "COMPANY_BUYER") as Role;
  if (!ROLES.includes(role)) return { error: t("act.join.roleInvalid") };

  const request = await db.companyJoinRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      companyId: true,
      userId: true,
      status: true,
      department: true,
      user: { select: { email: true, firstName: true } },
    },
  });
  // Company scope first: a request id from another company must be as invisible
  // as one that does not exist.
  if (!request || request.companyId !== ctx.companyId) return { error: t("act.join.notFound") };
  if (request.status === "PENDING_EMAIL_VERIFICATION") return { error: t("act.join.notConfirmed") };
  if (request.status === "APPROVED") return { error: t("act.join.alreadyDecided") };

  try {
    const admitted = await db.$transaction(async (tx) => {
      // The status is in the WHERE, not only in the check above: two
      // administrators clicking approve at once must produce one membership.
      const decided = await tx.companyJoinRequest.updateMany({
        where: { id: request.id, status: { in: ["PENDING_ADMIN_APPROVAL", "REJECTED"] } },
        data: { status: "APPROVED", decidedById: ctx.userId, decidedAt: new Date(), rejectionReason: null },
      });
      if (decided.count !== 1) return false;

      const membership = await tx.companyMember.create({
        data: { userId: request.userId, companyId: ctx.companyId, role, department: request.department },
      });

      // The account has been PENDING since the application was filed, which is
      // what has kept sign-in refusing it. Activating it here — and only here —
      // is what the approval actually grants.
      await tx.user.update({
        where: { id: request.userId },
        data: { status: "ACTIVE", role },
      });

      await tx.auditLog.create({
        data: {
          actorId: ctx.userId,
          entityType: "CompanyMember",
          entityId: membership.id,
          action: "CREATE",
          after: {
            companyId: ctx.companyId,
            userId: request.userId,
            role,
            admittedVia: "join-request",
            joinRequestId: request.id,
          },
        },
      });
      return true;
    });
    if (!admitted) return { error: t("act.join.alreadyDecided") };
  } catch {
    // The likeliest cause is the unique on CompanyMember.userId: the applicant
    // was admitted by another route between the read and the write.
    return { error: t("act.join.failed") };
  }

  // Told AFTER the transaction commits, and never inside it: a provider that
  // hangs must not hold a write open, and a "you are in" for a write that then
  // rolled back is worse than no mail at all.
  //
  // The applicant cannot discover this any other way. Sign-in refused them
  // yesterday and answers identically for "rejected" and "not looked at yet",
  // so without this mail the only way to learn they were admitted is to keep
  // trying the login form. A failure to send is therefore worth a line in the
  // administrator's own confirmation, not a silent shrug.
  const origin = selfOrigin("customer");
  const notified = origin
    ? (
        await sendJoinApprovedEmail({
          to: request.user.email,
          companyName: ctx.company.nameEn,
          firstName: request.user.firstName,
          signInUrl: `${origin}/login`,
        })
      ).sent
    : false;

  revalidatePath("/b2b/team");
  return {
    ok: true,
    message: notified
      ? t("act.join.approved")
      : t("act.join.approvedNotNotified", { email: request.user.email }),
  };
}

/**
 * Refuse an applicant.
 *
 * Nothing is deleted. The account stays PENDING with no membership, which is
 * exactly the state it has been in since it was created — sign-in refuses it
 * and getB2BContext returns null for it — and the row remains so the next
 * administrator to read this queue can see that the decision was taken, by
 * whom, and why.
 */
export async function rejectJoinRequest(
  requestId: string,
  _prev: B2BActionState,
  formData: FormData,
): Promise<B2BActionState> {
  const t = actionT();
  const ctx = await getB2BContext();
  if (!ctx || ctx.member.role !== "COMPANY_ADMIN") return { error: t("act.join.adminOnly") };

  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500) || null;

  const request = await db.companyJoinRequest.findUnique({
    where: { id: requestId },
    select: { id: true, companyId: true, userId: true, status: true },
  });
  if (!request || request.companyId !== ctx.companyId) return { error: t("act.join.notFound") };

  const decided = await db.companyJoinRequest.updateMany({
    where: { id: request.id, status: { in: ["PENDING_EMAIL_VERIFICATION", "PENDING_ADMIN_APPROVAL"] } },
    data: { status: "REJECTED", decidedById: ctx.userId, decidedAt: new Date(), rejectionReason: reason },
  });
  if (decided.count !== 1) return { error: t("act.join.alreadyDecided") };

  await db.auditLog.create({
    data: {
      actorId: ctx.userId,
      entityType: "CompanyJoinRequest",
      entityId: request.id,
      action: "UPDATE",
      after: { status: "REJECTED", companyId: ctx.companyId, userId: request.userId, rejectionReason: reason },
    },
  });

  revalidatePath("/b2b/team");
  return { ok: true, message: t("act.join.rejected") };
}

export async function updateMember(memberId: string, formData: FormData) {
  const ctx = await getB2BContext();
  if (!ctx || ctx.member.role !== "COMPANY_ADMIN") return;

  const target = await db.companyMember.findUnique({ where: { id: memberId } });
  if (!target || target.companyId !== ctx.companyId) return;

  const role = String(formData.get("role") ?? target.role) as Role;
  const spendRaw = String(formData.get("spendLimit") ?? "").trim();
  const spendLimit = spendRaw ? Number(spendRaw) : null;

  if (!ROLES.includes(role)) return;
  const nextRole = role;
  if (spendRaw && (!Number.isFinite(spendLimit) || (spendLimit ?? 0) < 0)) return;
  await updateGovernedCompanyMember({
    memberId,
    companyId: ctx.companyId,
    actorId: ctx.userId,
    role: nextRole,
    spendLimit,
  });
  revalidatePath("/b2b/team");
  
}

export async function setMemberActive(memberId: string, isActive: boolean) {
  const ctx = await getB2BContext();
  if (!ctx || ctx.member.role !== "COMPANY_ADMIN") return;

  const target = await db.companyMember.findUnique({ where: { id: memberId } });
  if (!target || target.companyId !== ctx.companyId) return;
  if (target.userId === ctx.userId) return;

  await updateGovernedCompanyMember({
    memberId,
    companyId: ctx.companyId,
    actorId: ctx.userId,
    role: target.role as Role,
    spendLimit: target.spendLimit == null ? null : Number(target.spendLimit),
    isActive,
  });
  revalidatePath("/b2b/team");
  
}
