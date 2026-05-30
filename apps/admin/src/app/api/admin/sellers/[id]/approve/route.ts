import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-instance";
import { approveSeller } from "@manzil/database";

export async function PUT(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    const user = session?.user as { id: string; role: string } | undefined;
    if (!user || !["ADMIN", "SUPER_ADMIN"].includes(user.role)) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    const seller = await approveSeller(params.id, user.id);
    return NextResponse.json({ success: true, data: seller });
  } catch {
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}
