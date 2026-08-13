import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-instance";
import { createCustomerReturnRequests, db } from "@avenick/database";
import { log } from "@avenick/observability";

export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const [deliveredOrders, myReturns] = await Promise.all([
      db.order.findMany({
        where: {
          userId,
          status: "DELIVERED",
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          items: { select: { id: true, nameEn: true, quantity: true, sellerId: true, total: true } },
          returnRequests: { where: { status: { not: "REJECTED" } }, select: { sellerId: true } },
        },
      }),
      db.returnRequest.findMany({
        where: { order: { userId } },
        orderBy: { createdAt: "desc" },
        include: { order: { select: { orderNumber: true, total: true, currency: true } } },
      }),
    ]);

    // A marketplace order remains returnable while at least one seller's lines
    // do not already have an active return.
    const eligibleOrders = deliveredOrders.filter((order) => {
      const returnedSellers = new Set(order.returnRequests.map((request) => request.sellerId));
      return order.items.some((item) => !returnedSellers.has(item.sellerId));
    });

    return NextResponse.json({ success: true, data: { eligibleOrders, myReturns } });
  } catch (error) {
    log.error("returns request failed", error, { path: "/api/returns" });
    return NextResponse.json({ success: false, error: "Failed to load returns" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ success: false, error: "Sign in to request a return." }, { status: 401 });

    const body = await req.json();
    const orderId = String(body.orderId ?? "").trim();
    const reason = String(body.reason ?? "").trim();
    const notes = String(body.notes ?? "").trim();
    const selections = Array.isArray(body.items)
      ? body.items.map((item: unknown) => {
          const value = item as { orderItemId?: unknown; quantity?: unknown };
          return { orderItemId: String(value.orderItemId ?? ""), quantity: Number(value.quantity) };
        })
      : [];

    if (!orderId) return NextResponse.json({ success: false, error: "Order is required." }, { status: 400 });
    if (reason.length < 3) return NextResponse.json({ success: false, error: "Add a reason." }, { status: 400 });
    if (selections.length === 0) return NextResponse.json({ success: false, error: "Select at least one item." }, { status: 400 });

    const finalReason = notes ? `${reason} — ${notes}` : reason;
    const returnRequests = await createCustomerReturnRequests({ userId, orderId, reason: finalReason, selections });

    return NextResponse.json({
      success: true,
      data: returnRequests,
      message: "Return request submitted — our team will review it within 1–2 business days.",
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "RETURN_ORDER_NOT_FOUND") {
      return NextResponse.json({ success: false, error: "Order not found." }, { status: 404 });
    }
    if (code === "RETURN_ORDER_NOT_DELIVERED") {
      return NextResponse.json({ success: false, error: "Only delivered orders can be returned." }, { status: 400 });
    }
    if (code === "RETURN_ALREADY_OPEN") {
      return NextResponse.json({ success: false, error: "A return request is already open for one of the selected seller lines." }, { status: 409 });
    }
    if (["RETURN_ITEMS_REQUIRED", "RETURN_ITEMS_DUPLICATE", "RETURN_ITEM_NOT_FOUND", "RETURN_QUANTITY_INVALID", "RETURN_QUANTITY_EXCEEDS_PURCHASED"].includes(code)) {
      return NextResponse.json({ success: false, error: "Select valid purchased items and quantities." }, { status: 400 });
    }
    log.error("returns request failed", error, { path: "/api/returns" });
    return NextResponse.json({ success: false, error: "Failed to submit return request" }, { status: 500 });
  }
}
