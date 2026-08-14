import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { db } from "@avenick/database";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!await getCurrentAdmin()) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

    const seller = await db.sellerProfile.findUnique({
      where: { id: params.id },
      include: {
        user: { select: { email: true, firstName: true, lastName: true } },
        documents: true,
        _count: { select: { products: true } },
      },
    });
    if (!seller) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true, data: seller });
  } catch {
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}
