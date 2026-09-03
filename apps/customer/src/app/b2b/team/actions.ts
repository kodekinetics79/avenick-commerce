"use server";

import { revalidatePath } from "next/cache";
import { db, updateGovernedCompanyMember } from "@avenick/database";
import { getB2BContext, type B2BActionState } from "@/lib/b2b";
import { actionT } from "@/components/b2b/action-i18n";
import { sendInviteEmail } from "@/lib/email";

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

  revalidatePath("/b2b/team");
  return {
    ok: true,
    message: sent ? t("act.team.inviteSent", { email }) : t("act.team.inviteNotSent", { email }),
  };
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
