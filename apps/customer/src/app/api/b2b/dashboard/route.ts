import { NextResponse } from "next/server";
import { db } from "@avenick/database";
import { getServerB2BContext } from "@/lib/b2b-server";
import { companyCurrencyForCountry } from "@/lib/company-currency";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getServerB2BContext();
  if (!ctx) {
    return NextResponse.json({ success: false, error: "Company account required" }, { status: 401 });
  }
  const companyCurrency = companyCurrencyForCountry(ctx.company.country);

  const [company, spendAgg, pendingApprovals, openRFQs, recentOrders, reorderItems] = await Promise.all([
    db.company.findUnique({
      where: { id: ctx.companyId },
      include: { _count: { select: { members: true, orders: true, purchaseOrders: true } } },
    }),
    db.order.aggregate({
      where: { companyId: ctx.companyId, paymentStatus: "PAID", currency: companyCurrency },
      _sum: { total: true },
    }),
    db.purchaseOrder.count({ where: { companyId: ctx.companyId, status: "PENDING_APPROVAL" } }),
    db.rFQRequest.count({
      where: {
        companyId: ctx.companyId,
        status: { in: ["SUBMITTED", "UNDER_REVIEW", "QUOTED", "NEGOTIATING"] },
      },
    }),
    db.order.findMany({
      where: { companyId: ctx.companyId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, orderNumber: true, status: true, total: true, currency: true, createdAt: true },
    }),
    db.orderItem.findMany({
      where: { order: { companyId: ctx.companyId, paymentStatus: "PAID" } },
      orderBy: { id: "desc" },
      take: 4,
      distinct: ["productId"],
      include: {
        product: {
          select: {
            id: true,
            slug: true,
            nameEn: true,
            status: true,
            images: { where: { isPrimary: true }, take: 1 },
          },
        },
      },
    }),
  ]);

  if (!company) {
    return NextResponse.json({ success: false, error: "Company not found" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    data: {
      company,
      companyCurrency,
      lifetimeSpend: Number(spendAgg._sum.total ?? 0),
      pendingApprovals,
      openRFQs,
      recentOrders,
      reorderItems,
    },
  });
}
