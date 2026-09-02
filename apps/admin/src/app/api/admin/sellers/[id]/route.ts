import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { computeSellerPerformanceScore, db } from "@avenick/database";
import { isRecordId } from "@avenick/utils";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!await getCurrentAdmin()) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    if (!isRecordId(params.id)) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    const seller = await db.sellerProfile.findUnique({
      where: { id: params.id },
      include: {
        user: { select: { email: true, firstName: true, lastName: true } },
        // fileUrl is a private object key, never a link the browser can open;
        // the page links to /documents/<id>/view, which signs it per request.
        documents: {
          select: {
            id: true, type: true, fileName: true, fileSize: true, mimeType: true, status: true,
            expiryDate: true, rejectionReason: true, uploadedAt: true, reviewedAt: true,
          },
        },
        _count: { select: { products: true } },
      },
    });
    if (!seller) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    // SellerProfile.accountHealth is a stored default that nothing recomputes,
    // so it is not a measurement. Attach the score derived from the seller's
    // own recent activity instead; null means there is too little to state one.
    const performance = await computeSellerPerformanceScore(seller.id);
    // Likewise SellerProfile.rating / reviewCount are never written by the
    // application (nor, any longer, by the seed), so the stored columns are replaced with
    // the aggregate of the reviews buyers actually left on this seller's products.
    const reviews = await db.productReview.aggregate({
      where: { product: { sellerId: seller.id } },
      _avg: { rating: true },
      _count: { _all: true },
    });
    const reviewCount = reviews._count._all;
    const rating = reviewCount > 0 && reviews._avg.rating !== null ? Math.round(reviews._avg.rating * 10) / 10 : null;
    return NextResponse.json({ success: true, data: { ...seller, rating, reviewCount, performance } });
  } catch {
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}
