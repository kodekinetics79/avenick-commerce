import { NextResponse } from "next/server";
import { db, submitQuote } from "@avenick/database";
import { z } from "zod";
import { getServerSellerContext, sellerHasPermission } from "@/lib/seller-server";

export const dynamic = "force-dynamic";

const SubmitQuoteSchema = z.object({
  notes: z.string().trim().max(1000).optional(),
  items: z.array(z.object({
    itemId: z.string().min(1),
    unitQuoted: z.number().positive(),
  })).min(1),
});

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const ctx = await getServerSellerContext();
  if (!ctx) return NextResponse.json({ success: false, error: "Seller account required" }, { status: 401 });
  if (!sellerHasPermission(ctx, "rfqs.view")) {
    return NextResponse.json({ success: false, error: "RFQ-view permission required" }, { status: 403 });
  }

  const rfq = await db.rFQRequest.findFirst({
    where: {
      id: params.id,
      OR: [
        { status: { in: ["SUBMITTED", "UNDER_REVIEW"] }, sellerId: null },
        { sellerId: ctx.seller.id },
      ],
    },
    include: { items: true, company: { select: { nameEn: true } } },
  });
  if (!rfq) return NextResponse.json({ success: false, error: "RFQ not found" }, { status: 404 });
  return NextResponse.json({
    success: true,
    data: {
      seller: { businessNameEn: ctx.seller.businessNameEn, tier: ctx.seller.tier },
      rfq,
    },
  });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const ctx = await getServerSellerContext();
  if (!ctx) return NextResponse.json({ success: false, error: "Seller account required" }, { status: 401 });
  if (!sellerHasPermission(ctx, "quotes.submit")) {
    return NextResponse.json({ success: false, error: "Quote-submission permission required" }, { status: 403 });
  }

  const parsed = SubmitQuoteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Invalid quote" },
      { status: 400 },
    );
  }
  try {
    const quote = await submitQuote({
      rfqId: params.id,
      sellerId: ctx.seller.id,
      actorId: ctx.userId,
      items: parsed.data.items,
      notes: parsed.data.notes,
    });
    return NextResponse.json({ success: true, data: quote });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Quote failed" },
      { status: 409 },
    );
  }
}
