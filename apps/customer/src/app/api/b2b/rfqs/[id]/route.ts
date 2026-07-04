import { NextResponse } from "next/server";
import { decideRFQ, getRFQForBuyer } from "@avenick/database";
import { z } from "zod";
import { getServerB2BContext } from "@/lib/b2b-server";

export const dynamic = "force-dynamic";

const DecisionSchema = z.object({ decision: z.enum(["ACCEPTED", "REJECTED"]) });

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const ctx = await getServerB2BContext();
  if (!ctx) {
    return NextResponse.json({ success: false, error: "Company account required" }, { status: 401 });
  }

  const rfq = await getRFQForBuyer({
    rfqId: params.id,
    buyerId: ctx.userId,
    companyId: ctx.companyId,
  });
  if (!rfq) return NextResponse.json({ success: false, error: "RFQ not found" }, { status: 404 });
  return NextResponse.json({ success: true, data: rfq });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const ctx = await getServerB2BContext();
  if (!ctx) {
    return NextResponse.json({ success: false, error: "Company account required" }, { status: 401 });
  }

  const parsed = DecisionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid RFQ decision" }, { status: 400 });
  }

  try {
    const rfq = await decideRFQ({
      rfqId: params.id,
      buyerId: ctx.userId,
      companyId: ctx.companyId,
      decision: parsed.data.decision,
    });
    return NextResponse.json({ success: true, data: rfq });
  } catch {
    return NextResponse.json({ success: false, error: "RFQ cannot be updated" }, { status: 409 });
  }
}
