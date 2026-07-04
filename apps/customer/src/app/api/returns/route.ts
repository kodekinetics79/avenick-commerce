import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-instance";
import { db, ReturnStatus } from "@avenick/database";
import { log } from "@avenick/observability";

function returnNumber() {
  const y = new Date().getFullYear();
  const t = Date.now().toString(36).slice(-5).toUpperCase();
  return `RET-${y}-${t}`;
}

export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const [eligibleOrders, myReturns] = await Promise.all([
      db.order.findMany({
        where: {
          userId,
          status: "DELIVERED",
          returnRequests: { none: { status: { notIn: ["REJECTED"] } } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { items: { select: { nameEn: true, quantity: true } } },
      }),
      db.returnRequest.findMany({
        where: { order: { userId } },
        orderBy: { createdAt: "desc" },
        include: { order: { select: { orderNumber: true, total: true, currency: true } } },
      }),
    ]);

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

    if (!orderId) return NextResponse.json({ success: false, error: "Order is required." }, { status: 400 });
    if (reason.length < 3) return NextResponse.json({ success: false, error: "Add a reason." }, { status: 400 });

    const order = await db.order.findFirst({
      where: { id: orderId, userId },
      include: { items: { select: { sellerId: true } }, returnRequests: { select: { id: true, status: true } } },
    });
    if (!order) return NextResponse.json({ success: false, error: "Order not found." }, { status: 404 });
    if (order.status !== "DELIVERED") return NextResponse.json({ success: false, error: "Only delivered orders can be returned." }, { status: 400 });
    if (order.returnRequests.some((r) => !["REJECTED"].includes(r.status as ReturnStatus))) {
      return NextResponse.json({ success: false, error: "A return request is already open for this order." }, { status: 409 });
    }

    const sellerId = order.items[0]?.sellerId;
    if (!sellerId) return NextResponse.json({ success: false, error: "This order has no returnable items." }, { status: 400 });

    const finalReason = notes ? `${reason} — ${notes}` : reason;

    const returnRequest = await db.returnRequest.create({
      data: {
        returnNumber: returnNumber(),
        orderId: order.id,
        sellerId,
        reason: finalReason,
        status: "REQUESTED",
      },
    });

    return NextResponse.json({
      success: true,
      data: returnRequest,
      message: "Return request submitted — our team will review it within 1–2 business days.",
    });
  } catch (error) {
    log.error("returns request failed", error, { path: "/api/returns" });
    return NextResponse.json({ success: false, error: "Failed to submit return request" }, { status: 500 });
  }
}
