import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-instance";
import { db } from "@avenick/database";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    const user = session?.user as { role: string } | undefined;
    if (!user || !["ADMIN", "SUPER_ADMIN"].includes(user.role)) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

    const seller = await db.sellerProfile.findUnique({
      where: { id: params.id },
      include: {
        user: { select: { email: true, firstName: true, lastName: true } },
        documents: true,
        _count: { select: { products: true } },
      },
    });
    if (!seller) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true, data: seller });
  } catch {
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}
