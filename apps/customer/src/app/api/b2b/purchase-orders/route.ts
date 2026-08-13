import { NextResponse } from "next/server";
import { createGovernedPurchaseOrder, db, type Currency } from "@avenick/database";
import { z } from "zod";
import { getServerB2BContext, B2B_APPROVER_ROLES } from "@/lib/b2b-server";

export const dynamic = "force-dynamic";

const CurrencySchema = z.enum(["AED", "SAR", "QAR", "KWD", "OMR", "BHD", "USD"]);
const CreatePOSchema = z.object({
  items: z.array(z.object({
    productId: z.string().min(1).max(128),
    variantId: z.string().min(1).max(128).optional(),
    quantity: z.number().int().positive().max(100000),
  })).min(1).max(500),
  currency: CurrencySchema,
  notes: z.string().trim().max(2000).optional(),
  requiredDate: z.string().date().optional(),
});

export async function GET() {
  const ctx = await getServerB2BContext();
  if (!ctx) {
    return NextResponse.json({ success: false, error: "Active company account required" }, { status: 401 });
  }

  const [purchaseOrders, policies] = await Promise.all([
    db.purchaseOrder.findMany({
      where: { companyId: ctx.companyId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { items: true },
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
      company: { nameEn: ctx.company.nameEn, country: ctx.company.country },
      memberRole: ctx.member.role,
      spendLimit: ctx.member.spendLimit,
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
    return NextResponse.json({ success: false, error: "Active company account required" }, { status: 401 });
  }

  const parsed = CreatePOSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Invalid purchase order" },
      { status: 400 },
    );
  }

  try {
    const purchaseOrder = await createGovernedPurchaseOrder({
      companyId: ctx.companyId,
      requesterId: ctx.userId,
      requesterSpendLimit: ctx.member.spendLimit == null ? null : Number(ctx.member.spendLimit),
      currency: parsed.data.currency as Currency,
      items: parsed.data.items,
      notes: parsed.data.notes,
      requiredDate: parsed.data.requiredDate ? new Date(parsed.data.requiredDate) : undefined,
    });

    return NextResponse.json({
      success: true,
      data: {
        purchaseOrder,
        message: purchaseOrder.status === "PENDING_APPROVAL"
          ? "Purchase order created with authoritative product lines and routed for approval."
          : "Purchase order created with authoritative product lines and auto-approved.",
      },
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create purchase order";
    return NextResponse.json({ success: false, error: message }, { status: 409 });
  }
}
