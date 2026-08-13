import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-instance";
import { db, Prisma } from "@avenick/database";
import { log } from "@avenick/observability";

function returnNumber() {
  const y = new Date().getFullYear();
  const t = Date.now().toString(36).slice(-5).toUpperCase();
  const r = Math.floor(1000 + Math.random() * 9000);
  return `RET-${y}-${t}${r}`;
}

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
          items: { select: { nameEn: true, quantity: true, sellerId: true } },
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

    if (!orderId) return NextResponse.json({ success: false, error: "Order is required." }, { status: 400 });
    if (reason.length < 3) return NextResponse.json({ success: false, error: "Add a reason." }, { status: 400 });

    const finalReason = notes ? `${reason} — ${notes}` : reason;
    const returnRequests = await db.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`buyer-return:${orderId}`}))`,
      );
      const order = await tx.order.findFirst({
        where: { id: orderId, userId },
        include: {
          items: { select: { sellerId: true } },
          returnRequests: { where: { status: { not: "REJECTED" } }, select: { sellerId: true } },
        },
      });
      if (!order) throw new Error("RETURN_ORDER_NOT_FOUND");
      if (order.status !== "DELIVERED") throw new Error("RETURN_ORDER_NOT_DELIVERED");

      const existing = new Set(order.returnRequests.map((request) => request.sellerId));
      const sellerIds = [...new Set(order.items.map((item) => item.sellerId))]
        .filter((sellerId) => !existing.has(sellerId));
      if (sellerIds.length === 0) throw new Error("RETURN_ALREADY_OPEN");

      const created = [];
      for (const sellerId of sellerIds) {
        created.push(await tx.returnRequest.create({
          data: {
            returnNumber: returnNumber(),
            orderId: order.id,
            sellerId,
            reason: finalReason,
            status: "REQUESTED",
          },
        }));
      }
      return created;
    });

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
      return NextResponse.json({ success: false, error: "A return request is already open for every seller in this order." }, { status: 409 });
    }
    log.error("returns request failed", error, { path: "/api/returns" });
    return NextResponse.json({ success: false, error: "Failed to submit return request" }, { status: 500 });
  }
}
