import { NextResponse } from "next/server";
import { db, getSellerDashboard } from "@avenick/database";
import { getServerSellerContext } from "@/lib/seller-server";

export async function GET() {
  try {
    const ctx = await getServerSellerContext();
    if (!ctx) return NextResponse.json({ success: false, error: "Seller account required" }, { status: 401 });

    const [dashboard, expiringDocs, pendingRfqCount] = await Promise.all([
      getSellerDashboard(ctx.seller.id),
      db.sellerDocument.count({
        where: {
          sellerId: ctx.seller.id,
          expiryDate: { gte: new Date(), lte: new Date(Date.now() + 30 * 86400000) },
        },
      }),
      db.rFQRequest.count({
        where: { sellerId: ctx.seller.id, status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
      }),
    ]);
    return NextResponse.json({
      success: true,
      data: { seller: ctx.seller, dashboard, expiringDocs, pendingRfqCount },
    });
  } catch {
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}
