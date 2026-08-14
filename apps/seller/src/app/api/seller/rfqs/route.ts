import { NextResponse } from "next/server";
import { db, getRFQsForSeller } from "@avenick/database";
import { getServerSellerContext, sellerHasPermission } from "@/lib/seller-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getServerSellerContext();
  if (!ctx) return NextResponse.json({ success: false, error: "Seller account required" }, { status: 401 });
  if (!sellerHasPermission(ctx, "rfqs.view")) {
    return NextResponse.json({ success: false, error: "RFQ-view permission required" }, { status: 403 });
  }

  const [inbox, history] = await Promise.all([
    getRFQsForSeller(ctx.seller.id),
    db.rFQRequest.findMany({
      where: { sellerId: ctx.seller.id },
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: {
        company: { select: { nameEn: true } },
        items: true,
        _count: { select: { items: true } },
      },
    }),
  ]);
  return NextResponse.json({
    success: true,
    data: {
      seller: { businessNameEn: ctx.seller.businessNameEn, tier: ctx.seller.tier },
      inbox,
      history,
    },
  });
}
