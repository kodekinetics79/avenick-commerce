import { NextResponse } from "next/server";
import { createInvitedRFQ, getRFQsForBuyer } from "@avenick/database";
import { z } from "zod";
import { getServerB2BContext } from "@/lib/b2b-server";
import { companyCurrencyForCountry } from "@/lib/company-currency";

export const dynamic = "force-dynamic";

const CreateRFQSchema = z.object({
  notes: z.string().trim().max(2000).optional(),
  requiredBy: z.string().datetime(),
  responseDueAt: z.string().datetime(),
  awardByAt: z.string().datetime(),
  creationKey: z.string().trim().min(1).max(200),
  sellerIds: z.array(z.string().trim().min(1).max(128)).min(1).max(20),
  items: z.array(z.object({
    nameEn: z.string().trim().min(2).max(300),
    quantity: z.number().int().positive().max(1_000_000),
    notes: z.string().trim().max(500).optional(),
    productId: z.string().trim().min(1).max(128).optional(),
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

  const rfq = await createInvitedRFQ({
    buyerId: ctx.userId,
    companyId: ctx.companyId,
    currency: companyCurrencyForCountry(ctx.company.country),
    creationKey: parsed.data.creationKey,
    responseDueAt: new Date(parsed.data.responseDueAt),
    awardByAt: new Date(parsed.data.awardByAt),
    sellerIds: parsed.data.sellerIds,
    notes: parsed.data.notes,
    requiredBy: new Date(parsed.data.requiredBy),
    items: parsed.data.items,
  });
  return NextResponse.json({ success: true, data: { id: rfq.id } }, { status: 201 });
}
