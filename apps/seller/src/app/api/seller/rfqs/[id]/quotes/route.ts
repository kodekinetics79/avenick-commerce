import { NextResponse } from "next/server";
import { getSellerRfqQuoteWorkspace, submitSupplierQuote } from "@avenick/database";
import { getServerSellerContext, sellerHasPermission } from "@/lib/seller-server";
import { SellerQuotePayloadSchema } from "@/lib/seller-quote-contract";

export const dynamic = "force-dynamic";

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const ctx = await getServerSellerContext();
  if (!ctx)
    return NextResponse.json({ success: false, error: "Seller account required" }, { status: 401 });
  if (!sellerHasPermission(ctx, "quotes.submit")) {
    return NextResponse.json(
      { success: false, error: "Quote-submission permission required" },
      { status: 403 },
    );
  }

  const parsed = SellerQuotePayloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.rfqId !== params.id) {
    return NextResponse.json(
      {
        success: false,
        error: parsed.success
          ? "RFQ does not match the quote route"
          : (parsed.error.issues[0]?.message ?? "Invalid quote"),
      },
      { status: 400 },
    );
  }

  // Perform the invitation-scoped read first so an uninvited RFQ and a missing
  // RFQ return the same 404. submitSupplierQuote repeats the authorization and
  // invitation check inside its transaction.
  const workspace = await getSellerRfqQuoteWorkspace({ rfqId: params.id, sellerId: ctx.seller.id });
  if (!workspace)
    return NextResponse.json({ success: false, error: "RFQ not found" }, { status: 404 });

  try {
    const quote = await submitSupplierQuote({
      ...parsed.data,
      validUntil: new Date(parsed.data.validUntil),
      sellerId: ctx.seller.id,
      actorId: ctx.userId,
    });
    return NextResponse.json({ success: true, data: quote }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Quote failed" },
      { status: 409 },
    );
  }
}
