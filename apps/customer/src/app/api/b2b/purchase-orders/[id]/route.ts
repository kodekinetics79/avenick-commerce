import { NextResponse } from "next/server";
import { db } from "@avenick/database";
import { z } from "zod";
import { getServerB2BContext, B2B_APPROVER_ROLES } from "@/lib/b2b-server";

export const dynamic = "force-dynamic";

const TransitionSchema = z.object({
  action: z.enum(["approve", "reject", "order", "cancel"]),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const ctx = await getServerB2BContext();
  if (!ctx) {
    return NextResponse.json({ success: false, error: "Company account required" }, { status: 401 });
  }

  const parsed = TransitionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid transition" }, { status: 400 });
  }

  const po = await db.purchaseOrder.findUnique({ where: { id: params.id } });
  if (!po || po.companyId !== ctx.companyId) {
    return NextResponse.json({ success: false, error: "Purchase order not found" }, { status: 404 });
  }

  const isApprover = B2B_APPROVER_ROLES.includes(ctx.member.role);
  const isRequester = po.requesterId === ctx.userId;

  // Approve/reject require an approver. Placing the order and cancelling are
  // company-committing actions too, so restrict them to an approver or the
  // person who raised the PO — a plain buyer can't convert someone else's
  // approved PO into a real order or cancel a PO pending another's approval.
  const action = parsed.data.action;
  if (["approve", "reject"].includes(action) && !isApprover) {
    return NextResponse.json({ success: false, error: "Approver role required" }, { status: 403 });
  }
  if (["order", "cancel"].includes(action) && !isApprover && !isRequester) {
    return NextResponse.json(
      { success: false, error: "Only an approver or the PO requester can do this" },
      { status: 403 },
    );
  }
  // An approver may not approve their own PO (segregation of duties).
  if (action === "approve" && isRequester && !ctx.member.role.includes("ADMIN")) {
    return NextResponse.json(
      { success: false, error: "You can't approve your own purchase order" },
      { status: 403 },
    );
  }

  const allowed: Record<typeof parsed.data.action, string[]> = {
    approve: ["PENDING_APPROVAL"],
    reject: ["PENDING_APPROVAL"],
    order: ["APPROVED"],
    cancel: ["DRAFT", "PENDING_APPROVAL", "APPROVED"],
  };
  if (!allowed[parsed.data.action].includes(po.status)) {
    return NextResponse.json({ success: false, error: "Transition is not allowed" }, { status: 409 });
  }

  // Enforce the placing member's spend limit at order time. A member with a
  // ceiling can't commit the company beyond it; over-limit POs must go back
  // through approval rather than being placed directly.
  if (action === "order" && ctx.member.spendLimit != null && Number(po.total) > Number(ctx.member.spendLimit)) {
    return NextResponse.json(
      {
        success: false,
        error: `This purchase order (${Number(po.total)}) exceeds your spend limit (${Number(ctx.member.spendLimit)}). It needs approver placement.`,
      },
      { status: 403 },
    );
  }

  if (parsed.data.action !== "order") {
    const status = {
      approve: "APPROVED",
      reject: "REJECTED",
      cancel: "CANCELLED",
    }[parsed.data.action] as "APPROVED" | "REJECTED" | "CANCELLED";
    const updated = await db.purchaseOrder.update({
      where: { id: po.id },
      data: {
        status,
        ...(parsed.data.action === "approve" ? { approverId: ctx.userId } : {}),
        ...(parsed.data.action === "reject" ? { rejectionReason: "Rejected by approver" } : {}),
      },
    });
    return NextResponse.json({ success: true, data: updated });
  }

  const subtotal = Number(po.total);
  const vatRate = po.currency === "SAR" ? 0.15 : 0.05;
  const vatAmount = Math.round(subtotal * vatRate * 100) / 100;
  const total = Math.round((subtotal + vatAmount) * 100) / 100;
  const stamp = Date.now().toString(36).slice(-4).toUpperCase();
  const random = Math.floor(100 + Math.random() * 900);
  const year = new Date().getFullYear();

  const order = await db.$transaction(async (tx) => {
    // Claim the PO atomically: flip APPROVED → ORDERED and proceed only if THIS
    // call won the flip. A concurrent double-click matches 0 rows here and bails,
    // so we never create two orders / two tax invoices for one PO.
    const claim = await tx.purchaseOrder.updateMany({
      where: { id: po.id, status: "APPROVED" },
      data: { status: "ORDERED" },
    });
    if (claim.count !== 1) {
      throw new Error("ALREADY_ORDERED");
    }
    const created = await tx.order.create({
      data: {
        orderNumber: `AVN-${year}-${stamp}${random}`,
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
        shippingAddress: {
          label: ctx.company.nameEn,
          city: ctx.company.city,
          country: ctx.company.country,
        },
        notes: po.notes,
      },
    });
    await tx.taxInvoice.create({
      data: {
        orderId: created.id,
        invoiceNo: `INV-${year}-${stamp}${random}`,
        totalAmount: total,
        vatAmount,
        currency: po.currency,
      },
    });
    return created;
  }).catch((e: unknown) => {
    if (e instanceof Error && e.message === "ALREADY_ORDERED") return null;
    throw e;
  });

  if (!order) {
    return NextResponse.json(
      { success: false, error: "This purchase order has already been placed as an order." },
      { status: 409 },
    );
  }
  return NextResponse.json({ success: true, data: order });
}
