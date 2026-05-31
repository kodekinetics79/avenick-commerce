"use server";

import { revalidatePath } from "next/cache";
import { db } from "@avenick/database";
import { getB2BContext } from "@/lib/b2b";

function poNumber() {
  const y = new Date().getFullYear();
  const t = Date.now().toString(36).slice(-4).toUpperCase();
  const r = Math.floor(100 + Math.random() * 900);
  return `PO-${y}-${t}${r}`;
}

const APPROVER_ROLES = ["COMPANY_ADMIN", "COMPANY_APPROVER"];

/**
 * Create a PO. If an active approval policy's threshold is met, it routes to
 * PENDING_APPROVAL; otherwise it's auto-approved.
 */
export async function createPO(formData: FormData) {
  const ctx = await getB2BContext();
  if (!ctx) return;

  const description = String(formData.get("description") ?? "").trim();
  const total = Number(String(formData.get("total") ?? "").trim());
  const requiredRaw = String(formData.get("requiredDate") ?? "").trim();
  if (!description || !total || total <= 0) return;

  const needsApproval = await db.approvalPolicy.findFirst({
    where: { companyId: ctx.companyId, isActive: true, thresholdAmount: { lte: total } },
  });

  await db.purchaseOrder.create({
    data: {
      poNumber: poNumber(),
      companyId: ctx.companyId,
      requesterId: ctx.userId,
      status: needsApproval ? "PENDING_APPROVAL" : "APPROVED",
      total,
      notes: description,
      requiredDate: requiredRaw ? new Date(requiredRaw) : null,
    },
  });
  revalidatePath("/b2b/purchase-orders");
}

async function transition(id: string, allowedFrom: string[], data: Record<string, unknown>, requireApprover = false) {
  const ctx = await getB2BContext();
  if (!ctx) return;
  if (requireApprover && !APPROVER_ROLES.includes(ctx.member.role)) return;
  const po = await db.purchaseOrder.findUnique({ where: { id } });
  if (!po || po.companyId !== ctx.companyId || !allowedFrom.includes(po.status)) return;
  await db.purchaseOrder.update({ where: { id }, data });
  revalidatePath("/b2b/purchase-orders");
}

export async function approvePO(id: string) {
  const ctx = await getB2BContext();
  if (!ctx) return;
  await transition(id, ["PENDING_APPROVAL"], { status: "APPROVED", approverId: ctx.userId }, true);
}

export async function rejectPO(id: string) {
  await transition(id, ["PENDING_APPROVAL"], { status: "REJECTED", rejectionReason: "Rejected by approver" }, true);
}

export async function markOrdered(id: string) {
  await transition(id, ["APPROVED"], { status: "ORDERED" });
}

export async function cancelPO(id: string) {
  await transition(id, ["DRAFT", "PENDING_APPROVAL", "APPROVED"], { status: "CANCELLED" });
}
