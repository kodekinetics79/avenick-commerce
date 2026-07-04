import { NextResponse } from "next/server";
import { createRFQ, getRFQsForBuyer } from "@avenick/database";
import { z } from "zod";
import { getServerB2BContext } from "@/lib/b2b-server";

export const dynamic = "force-dynamic";

const CreateRFQSchema = z.object({
  notes: z.string().trim().max(2000).optional(),
  requiredBy: z.string().datetime().optional(),
  items: z.array(z.object({
    nameEn: z.string().trim().min(2).max(300),
    quantity: z.number().int().positive().max(1_000_000),
    notes: z.string().trim().max(500).optional(),
  })).min(1).max(50),
});

export async function GET() {
  const ctx = await getServerB2BContext();
  if (!ctx) {
    return NextResponse.json({ success: false, error: "Company account required" }, { status: 401 });
  }

  const rfqs = await getRFQsForBuyer({ buyerId: ctx.userId, companyId: ctx.companyId });
  return NextResponse.json({ success: true, data: rfqs });
}

export async function POST(request: Request) {
  const ctx = await getServerB2BContext();
  if (!ctx) {
    return NextResponse.json({ success: false, error: "Company account required" }, { status: 401 });
  }

  const parsed = CreateRFQSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Invalid RFQ" },
      { status: 400 },
    );
  }

  const rfq = await createRFQ({
    buyerId: ctx.userId,
    companyId: ctx.companyId,
    notes: parsed.data.notes,
    requiredBy: parsed.data.requiredBy ? new Date(parsed.data.requiredBy) : undefined,
    items: parsed.data.items,
  });
  return NextResponse.json({ success: true, data: { id: rfq.id } }, { status: 201 });
}
