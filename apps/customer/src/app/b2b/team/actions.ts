"use server";

import { revalidatePath } from "next/cache";
import { db, updateGovernedCompanyMember } from "@avenick/database";
import { getB2BContext, type B2BActionState } from "@/lib/b2b";
import { actionT } from "@/components/b2b/action-i18n";
import { sendInviteEmail, sendJoinApprovedEmail } from "@/lib/email";
import { selfOrigin } from "@avenick/utils/portal-config";
import { InvitationSecretMissingError, mintInvitationToken } from "@/lib/invitation";

const ROLES = ["COMPANY_ADMIN", "COMPANY_BUYER", "COMPANY_APPROVER"] as const;
type Role = (typeof ROLES)[number];

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
  if (await db.user.findUnique({ where: { email } })) return { error: t("act.team.emailTaken") };

  const [firstName, ...rest] = name.split(" ");
  // The new user's id is needed OUTSIDE the transaction: the invitation token
  // is signed over it, and minting inside would tie a credential's existence to
  // a transaction that can still roll back.
  let invitedUserId = "";
  try {
    await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, firstName: firstName || name, lastName: rest.join(" ") || "—", role, status: "PENDING" },
      });
      invitedUserId = user.id;
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

  // The account is created PENDING with no password, and sign-in refuses
  // anything that is not ACTIVE. This token is the only route from one to the
  // other, so a deployment that cannot mint one has just created a member who
  // can never sign in. Say that, rather than reporting a sent invitation.
  let token: string;
  try {
    token = mintInvitationToken({ uid: invitedUserId, passwordHash: null });
  } catch (e) {
    if (e instanceof InvitationSecretMissingError) {
      revalidatePath("/b2b/team");
      return { ok: true, message: t("act.team.inviteNoSecret", { email }) };
    }
    throw e;
  }

  const inviter = await db.user.findUnique({ where: { id: ctx.userId }, select: { firstName: true, lastName: true } });
  const { sent } = await sendInviteEmail({
    to: email,
    companyName: ctx.company.nameEn,
    inviterName: inviter ? `${inviter.firstName} ${inviter.lastName}`.trim() : ctx.company.nameEn,
    role,
    token,
  });

  revalidatePath("/b2b/team");
  return {
    ok: true,
    message: sent ? t("act.team.inviteSent", { email }) : t("act.team.inviteNotSent", { email }),
  };
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
