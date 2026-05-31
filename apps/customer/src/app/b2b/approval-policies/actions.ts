"use server";

import { revalidatePath } from "next/cache";
import { db } from "@avenick/database";
import { getB2BContext, type B2BActionState } from "@/lib/b2b";

const APPROVER_ROLES = ["COMPANY_ADMIN", "COMPANY_APPROVER"] as const;

export async function createPolicy(_prev: B2BActionState, formData: FormData): Promise<B2BActionState> {
  const ctx = await getB2BContext();
  if (!ctx || ctx.member.role !== "COMPANY_ADMIN") return { error: "Only company admins can manage policies." };

  const name = String(formData.get("name") ?? "").trim();
  const threshold = Number(String(formData.get("threshold") ?? "").trim());
  const approverRole = String(formData.get("approverRole") ?? "COMPANY_APPROVER") as (typeof APPROVER_ROLES)[number];

  if (!name) return { error: "Give the policy a name." };
  if (!threshold || Number.isNaN(threshold) || threshold <= 0) return { error: "Enter a positive threshold amount." };

  await db.approvalPolicy.create({
    data: {
      companyId: ctx.companyId,
      name,
      thresholdAmount: threshold,
      approverRole: APPROVER_ROLES.includes(approverRole) ? approverRole : "COMPANY_APPROVER",
    },
  });
  revalidatePath("/b2b/approval-policies");
  return { ok: true, message: `Policy “${name}” added.` };
}

export async function togglePolicy(id: string, isActive: boolean) {
  const ctx = await getB2BContext();
  if (!ctx || ctx.member.role !== "COMPANY_ADMIN") return;
  const p = await db.approvalPolicy.findUnique({ where: { id } });
  if (!p || p.companyId !== ctx.companyId) return;
  await db.approvalPolicy.update({ where: { id }, data: { isActive } });
  revalidatePath("/b2b/approval-policies");
  
}
