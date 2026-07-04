import { NextResponse } from "next/server";
import { db } from "@avenick/database";
import { z } from "zod";
import { getServerB2BContext, B2B_APPROVER_ROLES } from "@/lib/b2b-server";

export const dynamic = "force-dynamic";

const CreatePOSchema = z.object({
  description: z.string().trim().min(2).max(500),
  total: z.number().positive().max(100_000_000),
  requiredDate: z.string().date().optional(),
});

function poNumber() {
  const year = new Date().getFullYear();
  const stamp = Date.now().toString(36).slice(-4).toUpperCase();
  return `PO-${year}-${stamp}${Math.floor(100 + Math.random() * 900)}`;
}

export async function GET() {
  const ctx = await getServerB2BContext();
  if (!ctx) {
    return NextResponse.json({ success: false, error: "Company account required" }, { status: 401 });
  }

  const [purchaseOrders, policies] = await Promise.all([
    db.purchaseOrder.findMany({
      where: { companyId: ctx.companyId },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.approvalPolicy.findMany({ where: { companyId: ctx.companyId, isActive: true } }),
  ]);
  const requesterIds = [...new Set(purchaseOrders.map((po) => po.requesterId))];
  const users = await db.user.findMany({
    where: { id: { in: requesterIds } },
    select: { id: true, firstName: true, lastName: true },
  });

  return NextResponse.json({
    success: true,
    data: {
      company: { nameEn: ctx.company.nameEn },
      memberRole: ctx.member.role,
      isApprover: B2B_APPROVER_ROLES.includes(ctx.member.role),
      purchaseOrders,
      policies,
      requesters: users,
    },
  });
}

export async function POST(request: Request) {
  const ctx = await getServerB2BContext();
  if (!ctx) {
    return NextResponse.json({ success: false, error: "Company account required" }, { status: 401 });
  }

  const parsed = CreatePOSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Invalid purchase order" },
      { status: 400 },
    );
  }

  const policy = await db.approvalPolicy.findFirst({
    where: {
      companyId: ctx.companyId,
      isActive: true,
      thresholdAmount: { lte: parsed.data.total },
    },
  });
  const purchaseOrder = await db.purchaseOrder.create({
    data: {
      poNumber: poNumber(),
      companyId: ctx.companyId,
      requesterId: ctx.userId,
      status: policy ? "PENDING_APPROVAL" : "APPROVED",
      total: parsed.data.total,
      notes: parsed.data.description,
      requiredDate: parsed.data.requiredDate ? new Date(parsed.data.requiredDate) : null,
    },
  });

  return NextResponse.json({
    success: true,
    data: {
      purchaseOrder,
      message: policy ? "PO created and routed for approval." : "PO created and auto-approved.",
    },
  }, { status: 201 });
}
