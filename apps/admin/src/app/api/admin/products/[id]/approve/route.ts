import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-instance";
import { approveProduct } from "@manzil/database";

export async function PUT(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    const user = session?.user as { id: string; role: string } | undefined;
    if (!user || !["ADMIN", "SUPER_ADMIN"].includes(user.role)) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    const product = await approveProduct(params.id, user.id);
    return NextResponse.json({ success: true, data: product });
  } catch {
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}

// Allow GET for form action
export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  return PUT(req, ctx);
}
