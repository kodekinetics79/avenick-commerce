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

  const [company, spendAgg, pendingApprovals, openRFQs, recentOrders, reorderItems] = await Promise.all([
    db.company.findUnique({
      where: { id: ctx.companyId },
      include: { _count: { select: { members: true, orders: true, purchaseOrders: true } } },
    }),
    // Grouped by currency: orders are stored in the currency they were placed
    // in, and a single figure across currencies is not a sum of anything.
    db.order.groupBy({
      by: ["currency"],
      where: { companyId: ctx.companyId, paymentStatus: "PAID" },
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
      // Company.creditLimit has no currency column; it is read in the
      // company's jurisdiction currency, as the billing page does.
      companyCurrency: companyCurrencyForCountry(company.country),
      lifetimeSpendByCurrency: spendAgg
        .map((row) => ({ currency: row.currency, total: Number(row._sum.total ?? 0) }))
        .filter((row) => row.total > 0)
        .sort((a, b) => a.currency.localeCompare(b.currency)),
      pendingApprovals,
      openRFQs,
      recentOrders,
      reorderItems,
    },
  });
}
