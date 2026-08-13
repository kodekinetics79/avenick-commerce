import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { db } from "@avenick/database";
import type { SellerStatus } from "@avenick/database";

export async function GET(req: NextRequest) {
  try {
    if (!await getCurrentAdmin()) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const sellers = await db.sellerProfile.findMany({
      where: { ...(status && { status: status as SellerStatus }), deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        user: { select: { email: true, firstName: true, lastName: true } },
        documents: { select: { id: true, type: true, fileUrl: true, fileName: true, status: true } },
        _count: { select: { products: true } },
      },
    });
    return NextResponse.json({ success: true, data: sellers });
  } catch {
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}
