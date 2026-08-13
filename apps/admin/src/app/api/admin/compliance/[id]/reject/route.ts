import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { reviewDocument } from "@avenick/database";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    const { reason } = await req.json();
    const doc = await reviewDocument(params.id, "REJECTED", admin.userId, reason);
    return NextResponse.json({ success: true, data: doc });
  } catch {
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}
