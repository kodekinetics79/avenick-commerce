import { NextResponse } from "next/server";
import { db, placeGovernedPurchaseOrder } from "@avenick/database";
import { z } from "zod";
import { getServerB2BContext, B2B_APPROVER_ROLES } from "@/lib/b2b-server";

export const dynamic = "force-dynamic";

const TransitionSchema = z.object({
  action: z.enum(["approve", "reject", "order", "cancel"]),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const ctx = await getServerB2BContext();
  if (!ctx) {
    return NextResponse.json({ success: false, error: "Active company account required" }, { status: 401 });
  }

  const parsed = TransitionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid transition" }, { status: 400 });
  }

  const po = await db.purchaseOrder.findUnique({
    where: { id: params.id },
    include: { items: true },
  });
  if (!po || po.companyId !== ctx.companyId) {
    return NextResponse.json({ success: false, error: "Purchase order not found" }, { status: 404 });
  }

  const action = parsed.data.action;
  const isRequester = po.requesterId === ctx.userId;
  const genericApprover = B2B_APPROVER_ROLES.includes(ctx.member.role);

  const governingPolicy = await db.approvalPolicy.findFirst({
    where: {
      companyId: ctx.companyId,
      isActive: true,
      currency: po.currency,
      thresholdAmount: { lte: po.total },
    },
    orderBy: { thresholdAmount: "desc" },
  });
  const policyApprover = !governingPolicy || ctx.member.role === "COMPANY_ADMIN" || ctx.member.role === governingPolicy.approverRole;
  const isApprover = genericApprover && policyApprover;

  if (["approve", "reject"].includes(action) && !isApprover) {
    return NextResponse.json(
      { success: false, error: governingPolicy ? `Approval requires ${governingPolicy.approverRole}` : "Approver role required" },
      { status: 403 },
    );
  }
  if (["order", "cancel"].includes(action) && !genericApprover && !isRequester) {
    return NextResponse.json(
      { success: false, error: "Only an approver or the PO requester can do this" },
      { status: 403 },
    );
  }

  if (action === "approve" && isRequester) {
    const alternativeApprovers = await db.companyMember.count({
      where: {
        companyId: ctx.companyId,
        isActive: true,
        userId: { not: ctx.userId },
        role: governingPolicy
          ? { in: ["COMPANY_ADMIN", governingPolicy.approverRole] }
          : { in: ["COMPANY_ADMIN", "COMPANY_APPROVER"] },
      },
    });
    if (alternativeApprovers > 0 || ctx.member.role !== "COMPANY_ADMIN") {
      return NextResponse.json({ success: false, error: "Maker/checker control: you cannot approve your own purchase order" }, { status: 403 });
    }
  }

  const allowed: Record<typeof action, string[]> = {
    approve: ["PENDING_APPROVAL"],
    reject: ["PENDING_APPROVAL"],
    order: ["APPROVED", "ORDERED"],
    cancel: ["DRAFT", "PENDING_APPROVAL", "APPROVED"],
  };
  if (!allowed[action].includes(po.status)) {
    return NextResponse.json({ success: false, error: "Transition is not allowed" }, { status: 409 });
  }

  if (action === "order" && ctx.member.spendLimit != null && Number(po.total) > Number(ctx.member.spendLimit) && !genericApprover) {
    return NextResponse.json(
      { success: false, error: "This purchase order exceeds your spend limit and must be placed by an approver" },
      { status: 403 },
    );
  }

  if (action === "order") {
    try {
      const order = await placeGovernedPurchaseOrder({
        purchaseOrderId: po.id,
        companyId: ctx.companyId,
        actorId: ctx.userId,
      });
      return NextResponse.json({
        success: true,
        data: {
          order,
          message: "Approved PO placed through governed checkout; payment and any configured ERP validation remain authoritative states.",
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to place purchase order";
      return NextResponse.json({ success: false, error: message }, { status: 409 });
    }
  }

  const status = {
    approve: "APPROVED",
    reject: "REJECTED",
    cancel: "CANCELLED",
  }[action] as "APPROVED" | "REJECTED" | "CANCELLED";

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.purchaseOrder.update({
      where: { id: po.id },
      data: {
        status,
        ...(action === "approve" ? { approverId: ctx.userId, rejectionReason: null } : {}),
        ...(action === "reject" ? { rejectionReason: "Rejected by approver" } : {}),
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: ctx.userId,
        entityType: "PurchaseOrder",
        entityId: po.id,
        action: "STATUS_CHANGE",
        before: { status: po.status },
        after: { status, lineCount: po.items.length, approverId: action === "approve" ? ctx.userId : undefined },
      },
    });
    return result;
  });

  return NextResponse.json({ success: true, data: updated });
}
