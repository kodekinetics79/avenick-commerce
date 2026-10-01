import { NextResponse } from "next/server";
import { getSellerRfqQuoteWorkspace } from "@avenick/database";
import { getServerSellerContext, sellerHasPermission } from "@/lib/seller-server";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const ctx = await getServerSellerContext();
  if (!ctx)
    return NextResponse.json({ success: false, error: "Seller account required" }, { status: 401 });
  if (!sellerHasPermission(ctx, "rfqs.view")) {
    return NextResponse.json(
      { success: false, error: "RFQ-view permission required" },
      { status: 403 },
    );
  }

  const workspace = await getSellerRfqQuoteWorkspace({ rfqId: params.id, sellerId: ctx.seller.id });
  // Missing and cross-seller/uninvited RFQs are deliberately indistinguishable.
  if (!workspace)
    return NextResponse.json({ success: false, error: "RFQ not found" }, { status: 404 });
  return NextResponse.json({
    success: true,
    data: {
      seller: { businessNameEn: ctx.seller.businessNameEn, tier: ctx.seller.tier },
      ...workspace,
    },
  });
}
