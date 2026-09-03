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
        // fileUrl is a private object key, never a link the browser can open;
        // the page links to /documents/<id>/view, which signs it per request.
        documents: { select: { id: true, type: true, fileName: true, status: true } },
        _count: { select: { products: true } },
      },
    });
    return NextResponse.json({ success: true, data: sellers });
  } catch {
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}
