import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { approveProduct } from "@avenick/database";

export async function PUT(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    const product = await approveProduct(params.id, admin.userId);
    return NextResponse.json({ success: true, data: product });
  } catch {
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}

// Allow GET for form action
export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  return PUT(req, ctx);
}
