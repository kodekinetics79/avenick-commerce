import { NextResponse } from "next/server";
import { acceptSupplierQuote } from "@avenick/database";
import { RECORD_ID } from "@avenick/utils";
import { z } from "zod";
import { getServerB2BContext } from "@/lib/b2b-server";

export const dynamic = "force-dynamic";

const AwardSchema = z.object({
  quoteId: z.string().regex(RECORD_ID),
  expectedFingerprint: z.string().regex(/^[a-f0-9]{64}$/i),
});

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const ctx = await getServerB2BContext();
  if (!ctx) {
    return NextResponse.json(
      { success: false, error: "Active company account required" },
      { status: 401 },
    );
  }
  if (!RECORD_ID.test(params.id)) {
    return NextResponse.json(
      { success: false, error: "Supplier quote not found" },
      { status: 404 },
    );
  }
  const parsed = AwardSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid quote award request" },
      { status: 400 },
    );
  }

  try {
    const result = await acceptSupplierQuote({
      rfqId: params.id,
      quoteId: parsed.data.quoteId,
      companyId: ctx.companyId,
      actorId: ctx.userId,
      expectedFingerprint: parsed.data.expectedFingerprint,
    });
    return NextResponse.json({
      success: true,
      data: {
        quoteId: result.quote.id,
        purchaseOrder: {
          id: result.purchaseOrder.id,
          poNumber: result.purchaseOrder.poNumber,
          status: result.purchaseOrder.status,
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Supplier quote could not be awarded";
    const status = /not found/i.test(message)
      ? 404
      : /only a company admin|authority|required/i.test(message)
        ? 403
        : 409;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
