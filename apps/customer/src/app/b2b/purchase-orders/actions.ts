"use server";

import { revalidatePath } from "next/cache";
import { db } from "@avenick/database";
import { getB2BContext, type B2BActionState } from "@/lib/b2b";

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
export async function createPO(_prev: B2BActionState, formData: FormData): Promise<B2BActionState> {
  const ctx = await getB2BContext();
  if (!ctx) return { error: "Sign in with a company account to raise a PO." };

  const description = String(formData.get("description") ?? "").trim();
  const total = Number(String(formData.get("total") ?? "").trim());
  const requiredRaw = String(formData.get("requiredDate") ?? "").trim();
  if (!description) return { error: "Add a description." };
  if (!total || Number.isNaN(total) || total <= 0) return { error: "Enter a positive total amount." };

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
  return { ok: true, message: needsApproval ? "PO created and routed for approval." : "PO created and auto-approved." };
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

/** Placing an approved PO creates a B2B order + tax invoice, then marks it ORDERED. */
export async function markOrdered(id: string) {
  const ctx = await getB2BContext();
  if (!ctx) return;
  const po = await db.purchaseOrder.findUnique({ where: { id } });
  if (!po || po.companyId !== ctx.companyId || po.status !== "APPROVED") return;

  const subtotal = Number(po.total);
  const vatRate = po.currency === "SAR" ? 0.15 : 0.05;
  const vatAmount = Math.round(subtotal * vatRate * 100) / 100;
  const total = Math.round((subtotal + vatAmount) * 100) / 100;
  const stamp = Date.now().toString(36).slice(-4).toUpperCase();
  const rand = Math.floor(100 + Math.random() * 900);
  const year = new Date().getFullYear();

  await db.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        orderNumber: `AVN-${year}-${stamp}${rand}`,
        userId: po.requesterId,
        companyId: ctx.companyId,
        purchaseOrderId: po.id,
        type: "B2B",
        status: "CONFIRMED",
        currency: po.currency,
        subtotal,
        vatAmount,
        total,
        paymentMethod: "BANK_TRANSFER",
        paymentStatus: "UNPAID",
        shippingAddress: { label: ctx.company.nameEn, city: ctx.company.city, country: ctx.company.country },
        notes: po.notes,
      },
    });
    await tx.taxInvoice.create({
      data: {
        orderId: order.id,
        invoiceNo: `INV-${year}-${stamp}${rand}`,
        totalAmount: total,
        vatAmount,
        currency: po.currency,
      },
    });
    await tx.purchaseOrder.update({ where: { id }, data: { status: "ORDERED" } });
  });
  revalidatePath("/b2b/purchase-orders");
  revalidatePath("/b2b/billing");
}

export async function cancelPO(id: string) {
  await transition(id, ["DRAFT", "PENDING_APPROVAL", "APPROVED"], { status: "CANCELLED" });
}
