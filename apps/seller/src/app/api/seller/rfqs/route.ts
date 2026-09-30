import { NextResponse } from "next/server";
import { listSellerQuoteRevisions, listSellerRfqInvitations } from "@avenick/database";
import { getServerSellerContext, sellerHasPermission } from "@/lib/seller-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getServerSellerContext();
  if (!ctx) return NextResponse.json({ success: false, error: "Seller account required" }, { status: 401 });
  if (!sellerHasPermission(ctx, "rfqs.view")) {
    return NextResponse.json({ success: false, error: "RFQ-view permission required" }, { status: 403 });
  }

  const [inbox, history] = await Promise.all([
    listSellerRfqInvitations(ctx.seller.id),
    listSellerQuoteRevisions(ctx.seller.id),
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
