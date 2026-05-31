import { NextResponse } from "next/server";
import { auth } from "@/lib/auth-instance";
import { db, getSellerDashboard } from "@avenick/database";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const user = session.user as { id: string; role: string };
    if (!["SELLER_OWNER", "SELLER_STAFF"].includes(user.role)) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

    const seller = await db.sellerProfile.findUnique({ where: { userId: user.id } });
    if (!seller) return NextResponse.json({ success: false, error: "Seller profile not found" }, { status: 404 });

    const data = await getSellerDashboard(seller.id);
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}
