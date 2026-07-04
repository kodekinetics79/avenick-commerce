import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-instance";
import { db } from "@avenick/database";
import { log } from "@avenick/observability";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const order = await db.order.findFirst({
      where: { id, userId: session.user.id },
      include: {
        items: true,
        statusHistory: { orderBy: { createdAt: "asc" } },
        taxInvoice: { select: { invoiceNo: true } },
      },
    });

    if (!order) return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    log.error("orders.get failed", error, { path: "/api/orders/[id]" });
    return NextResponse.json({ success: false, error: "Failed to load order" }, { status: 500 });
  }
}
