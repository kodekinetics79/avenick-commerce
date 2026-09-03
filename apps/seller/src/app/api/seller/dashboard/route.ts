import { NextResponse } from "next/server";
import { db, getSellerDashboard } from "@avenick/database";
import { getServerSellerContext, sellerHasPermission } from "@/lib/seller-server";

export async function GET() {
  try {
    const ctx = await getServerSellerContext();
    if (!ctx) return NextResponse.json({ success: false, error: "Seller account required" }, { status: 401 });
    if (!sellerHasPermission(ctx, "dashboard.view")) {
      return NextResponse.json({ success: false, error: "Dashboard permission required" }, { status: 403 });
    }

    // The RFQ figure is `dashboard.rfqCount`: getSellerDashboard counts with
    // the rfq service's inbox predicate, the one getRFQsForSeller lists with.
    // This route used to add a second `pendingRfqCount` ("assigned to me AND
    // still SUBMITTED"), which is empty by construction — submitQuote is the
    // only writer of RFQRequest.sellerId and it sets QUOTED in the same
    // update — so two RFQ numbers that could never agree left the payload.
    const [dashboard, expiringDocs] = await Promise.all([
      getSellerDashboard(ctx.seller.id),
      db.sellerDocument.count({
        where: {
          sellerId: ctx.seller.id,
          expiryDate: { gte: new Date(), lte: new Date(Date.now() + 30 * 86400000) },
        },
      }),
    ]);
    return NextResponse.json({
      success: true,
      data: { seller: ctx.seller, dashboard, expiringDocs },
    });
  } catch {
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}
