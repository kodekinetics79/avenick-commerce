import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { rejectSeller } from "@avenick/database";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    const { reason } = await req.json();
    if (!reason) return NextResponse.json({ success: false, error: "Reason required" }, { status: 400 });
    const seller = await rejectSeller(params.id, admin.userId, reason);
    return NextResponse.json({ success: true, data: seller });
  } catch {
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}
