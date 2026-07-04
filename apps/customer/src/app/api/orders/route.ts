import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-instance";
import { createOrder, accrueCommissions, db } from "@avenick/database";
import { checkRateLimit, RATE_LIMITS } from "@avenick/auth";
import { log } from "@avenick/observability";
import { z } from "zod";
import type { PaymentMethod, Currency } from "@avenick/database";

const CreateOrderSchema = z.object({
  // No unitPrice — the server resolves authoritative prices from the catalog.
  items: z.array(z.object({
    productId: z.string(),
    variantId: z.string().optional(),
    quantity: z.number().int().positive(),
    sellerId: z.string(),
  })).min(1),
  shippingAddress: z.object({ label: z.string(), line1: z.string(), city: z.string(), country: z.string() }),
  paymentMethod: z.string().optional(),
  currency: z.string().default("AED"),
  type: z.enum(["B2C", "B2B"]).default("B2C"),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const rl = await checkRateLimit(RATE_LIMITS.orderCreate, session.user.id);
    if (!rl.ok) {
      return NextResponse.json(
        { success: false, error: "Too many order attempts. Please wait a moment and retry." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
      );
    }

    // Idempotency: a retry carrying the same Idempotency-Key returns the
    // original order instead of creating a duplicate.
    const idempotencyKey = req.headers.get("idempotency-key")?.trim() || undefined;
    if (idempotencyKey) {
      const existing = await db.order.findUnique({
        where: { userId_idempotencyKey: { userId: session.user.id, idempotencyKey } },
        select: { id: true, orderNumber: true },
      });
      if (existing) {
        return NextResponse.json({ success: true, data: existing, idempotent: true });
      }
    }

    const body = await req.json();
    const parsed = CreateOrderSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message }, { status: 400 });

    const order = await createOrder({
      userId: session.user.id,
      type: parsed.data.type,
      currency: parsed.data.currency as Currency,
      items: parsed.data.items,
      shippingAddress: parsed.data.shippingAddress,
      paymentMethod: (parsed.data.paymentMethod ?? "MOCK") as PaymentMethod,
      notes: parsed.data.notes,
      idempotencyKey,
    });

    // For MOCK payment method, immediately mark as paid
    if (!parsed.data.paymentMethod || parsed.data.paymentMethod === "MOCK") {
      await db.$transaction(async (tx) => {
        await tx.order.update({ where: { id: order.id }, data: { paymentStatus: "PAID", status: "CONFIRMED" } });
        await tx.payment.create({ data: { orderId: order.id, method: "MOCK", status: "PAID", amount: order.total, currency: order.currency, gatewayRef: `MOCK-${Date.now()}`, paidAt: new Date() } });
        await tx.orderStatusHistory.create({ data: { orderId: order.id, status: "CONFIRMED", message: "Payment confirmed (mock)" } });
        // Accrue platform commission for each seller in the same transaction.
        await accrueCommissions(tx, order.id);
      });
    }

    return NextResponse.json({ success: true, data: { id: order.id, orderNumber: order.orderNumber } });
  } catch (e) {
    // Business-rule violations (no price, insufficient stock, unavailable
    // product) are surfaced to the client as 409; everything else is a 500.
    const message = e instanceof Error ? e.message : "Failed to create order";
    const isBusinessError = /price|stock|unavailable|at least one item/i.test(message);
    if (!isBusinessError) log.error("orders.create failed", e, { path: "/api/orders" });
    return NextResponse.json({ success: false, error: message }, { status: isBusinessError ? 409 : 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const status = req.nextUrl.searchParams.get("status")?.trim() || undefined;

    const orders = await db.order.findMany({
      where: {
        userId: session.user.id,
        ...(status ? { status: status as never } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: { items: true, statusHistory: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    return NextResponse.json({ success: true, data: orders });
  } catch {
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}
