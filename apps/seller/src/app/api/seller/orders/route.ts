import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-instance";
import { db, getOrdersForSeller, updateOrderStatus } from "@avenick/database";
import type { OrderStatus } from "@avenick/database";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const seller = await db.sellerProfile.findUnique({ where: { userId: session.user.id as string } });
    if (!seller) return NextResponse.json({ success: false, error: "Not a seller" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status") as OrderStatus | null;
    const result = await getOrdersForSeller(seller.id, {
      page: parseInt(searchParams.get("page") ?? "1"),
      limit: parseInt(searchParams.get("limit") ?? "20"),
      ...(statusParam !== null ? { status: statusParam } : {}),
    });
    return NextResponse.json({ success: true, ...result });
  } catch {
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}
