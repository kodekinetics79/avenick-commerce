"use server";

import { revalidatePath } from "next/cache";
import { db } from "@avenick/database";
import { getB2BContext, type B2BActionState } from "@/lib/b2b";

const ROLES = ["COMPANY_ADMIN", "COMPANY_BUYER", "COMPANY_APPROVER"] as const;
type Role = (typeof ROLES)[number];

export async function inviteMember(_prev: B2BActionState, formData: FormData): Promise<B2BActionState> {
  const ctx = await getB2BContext();
  if (!ctx || ctx.member.role !== "COMPANY_ADMIN") return { error: "Only company admins can invite members." };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "COMPANY_BUYER") as Role;
  const department = String(formData.get("department") ?? "").trim() || null;
  const spendRaw = String(formData.get("spendLimit") ?? "").trim();
  const spendLimit = spendRaw ? Number(spendRaw) : null;

  if (!name || !email) return { error: "Name and email are required." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email address." };
  if (!ROLES.includes(role)) return { error: "Pick a valid role." };
  if (spendRaw && (Number.isNaN(spendLimit) || (spendLimit ?? 0) < 0)) return { error: "Spend limit must be a positive number." };
  if (await db.user.findUnique({ where: { email } })) return { error: "That email is already registered." };

  const [firstName, ...rest] = name.split(" ");
  try {
    await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, firstName: firstName || name, lastName: rest.join(" ") || "—", role, status: "PENDING" },
      });
      await tx.companyMember.create({
        data: { userId: user.id, companyId: ctx.companyId, role, department, spendLimit },
      });
    });
  } catch {
    return { error: "Could not invite member. Please try again." };
  }

  revalidatePath("/b2b/team");
  return { ok: true, message: `Invitation sent to ${email}. They'll appear as “Invited” until they set a password.` };
}

export async function updateMember(memberId: string, formData: FormData) {
  const ctx = await getB2BContext();
  if (!ctx || ctx.member.role !== "COMPANY_ADMIN") return;

  const target = await db.companyMember.findUnique({ where: { id: memberId } });
  if (!target || target.companyId !== ctx.companyId) return;

  const role = String(formData.get("role") ?? target.role) as Role;
  const spendRaw = String(formData.get("spendLimit") ?? "").trim();
  const spendLimit = spendRaw ? Number(spendRaw) : null;

  await db.companyMember.update({
    where: { id: memberId },
    data: { role: ROLES.includes(role) ? role : target.role, spendLimit },
  });
  revalidatePath("/b2b/team");
  
}

export async function setMemberActive(memberId: string, isActive: boolean) {
  const ctx = await getB2BContext();
  if (!ctx || ctx.member.role !== "COMPANY_ADMIN") return;

  const target = await db.companyMember.findUnique({ where: { id: memberId } });
  if (!target || target.companyId !== ctx.companyId) return;
  if (target.userId === ctx.userId) return;

  await db.companyMember.update({ where: { id: memberId }, data: { isActive } });
  revalidatePath("/b2b/team");
  
}
