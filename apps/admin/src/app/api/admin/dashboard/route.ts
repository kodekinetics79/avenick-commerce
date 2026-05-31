import { NextResponse } from "next/server";
import { auth } from "@/lib/auth-instance";
import { getAdminDashboard } from "@avenick/database";

export async function GET() {
  try {
    const session = await auth();
    const user = session?.user as { role: string } | undefined;
    if (!user || !["ADMIN", "SUPER_ADMIN"].includes(user.role)) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    const data = await getAdminDashboard();
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}
