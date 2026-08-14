import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { db, getExecutiveDashboardData } from "@avenick/database";

export async function GET() {
  try {
    if (!await getCurrentAdmin()) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    const [{ exec, topCustomers }, pendingCount] = await Promise.all([
      getExecutiveDashboardData(),
      db.sellerProfile.count({ where: { status: "PENDING_REVIEW" } }),
    ]);
    return NextResponse.json({ success: true, data: { exec, topCustomers, pendingCount } });
  } catch {
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}
