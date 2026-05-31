"use server";

import { revalidatePath } from "next/cache";
import { db } from "@avenick/database";
import { getB2BContext } from "@/lib/b2b";

const APPROVER_ROLES = ["COMPANY_ADMIN", "COMPANY_APPROVER"] as const;

export async function createPolicy(formData: FormData) {
  const ctx = await getB2BContext();
  if (!ctx || ctx.member.role !== "COMPANY_ADMIN") return;

  const name = String(formData.get("name") ?? "").trim();
  const threshold = Number(String(formData.get("threshold") ?? "").trim());
  const approverRole = String(formData.get("approverRole") ?? "COMPANY_APPROVER") as (typeof APPROVER_ROLES)[number];

  if (!name || !threshold || threshold <= 0) return;

  await db.approvalPolicy.create({
    data: {
      companyId: ctx.companyId,
      name,
      thresholdAmount: threshold,
      approverRole: APPROVER_ROLES.includes(approverRole) ? approverRole : "COMPANY_APPROVER",
    },
  });
  revalidatePath("/b2b/approval-policies");
  
}

export async function togglePolicy(id: string, isActive: boolean) {
  const ctx = await getB2BContext();
  if (!ctx || ctx.member.role !== "COMPANY_ADMIN") return;
  const p = await db.approvalPolicy.findUnique({ where: { id } });
  if (!p || p.companyId !== ctx.companyId) return;
  await db.approvalPolicy.update({ where: { id }, data: { isActive } });
  revalidatePath("/b2b/approval-policies");
  
}
