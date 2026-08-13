import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-instance";
import {
  assertGenericCheckoutHasNoPurchaseOrder,
  secureCreateOrder,
  finalizeInternalOrderPayment,
  db,
} from "@avenick/database";
import { checkRateLimit, RATE_LIMITS } from "@avenick/auth";
import { log } from "@avenick/observability";
import { z } from "zod";
import type { PaymentMethod, Currency, OrderStatus } from "@avenick/database";

const CurrencySchema = z.enum(["AED", "SAR", "QAR", "KWD", "OMR", "BHD", "USD"]);
const PaymentMethodSchema = z.enum(["MADA", "APPLE_PAY", "CREDIT_CARD", "BANK_TRANSFER", "STC_PAY", "MOCK"]);
const CountrySchema = z.enum(["AE", "SA", "QA", "KW", "OM", "BH"]);
const OrderStatusSchema = z.enum([
  "PENDING_PAYMENT",
  "PAYMENT_CONFIRMED",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
  "RETURNED",
]);

const CreateOrderSchema = z.object({
  // The client supplies identity + quantity only. Seller ownership, prices,
  // discounts and VAT are resolved from authoritative server-side rules.
  items: z.array(z.object({
    productId: z.string().min(1).max(128),
    variantId: z.string().min(1).max(128).optional(),
    quantity: z.number().int().positive().max(100000),
  })).min(1).max(500),
  shippingAddress: z.object({
    label: z.string().trim().min(1).max(80),
    line1: z.string().trim().min(3).max(240),
    city: z.string().trim().min(1).max(120),
    country: CountrySchema,
  }),
  paymentMethod: PaymentMethodSchema,
  currency: CurrencySchema.default("AED"),
  type: z.enum(["B2C", "B2B"]).default("B2C"),
  purchaseOrderId: z.string().min(1).max(128).optional(),
  couponCode: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/).optional(),
  notes: z.string().trim().max(2000).optional(),
});

function pilotMockPaymentsEnabled(): boolean {
  return process.env.PILOT_MODE === "true" && process.env.ALLOW_MOCK_PAYMENTS === "true";
}

function orderResponse(order: {
  id: string;
  orderNumber: string;
  total: { toString(): string } | number;
  discountAmount: { toString(): string } | number;
  vatAmount: { toString(): string } | number;
  currency: Currency;
}) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    total: Number(order.total),
    discountAmount: Number(order.discountAmount),
    vatAmount: Number(order.vatAmount),
    currency: order.currency,
  };
}

async function repairInternalPaymentIfNeeded(order: {
  id: string;
  paymentMethod: PaymentMethod | null;
}, actorId: string) {
  if (order.paymentMethod === "BANK_TRANSFER") {
    await finalizeInternalOrderPayment({ orderId: order.id, method: "BANK_TRANSFER", actorId });
  } else if (order.paymentMethod === "MOCK" && pilotMockPaymentsEnabled()) {
    await finalizeInternalOrderPayment({ orderId: order.id, method: "MOCK", pilotMockAllowed: true, actorId });
  }
}

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

    const idempotencyKey = req.headers.get("idempotency-key")?.trim() || undefined;
    if (idempotencyKey && idempotencyKey.length > 128) {
      return NextResponse.json({ success: false, error: "Idempotency-Key is too long" }, { status: 400 });
    }
    if (idempotencyKey) {
      const existing = await db.order.findUnique({
        where: { userId_idempotencyKey: { userId: session.user.id, idempotencyKey } },
        select: {
          id: true,
          orderNumber: true,
          total: true,
          discountAmount: true,
          vatAmount: true,
          currency: true,
          paymentMethod: true,
        },
      });
      if (existing) {
        await repairInternalPaymentIfNeeded(existing, session.user.id);
        return NextResponse.json({ success: true, data: orderResponse(existing), idempotent: true });
      }
    }

    const body = await req.json();
    const parsed = CreateOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? "Invalid order" },
        { status: 400 },
      );
    }

    // Approved POs carry immutable governed lines and can only be converted by
    // the purchase-order transition endpoint. Never attach one to a free-form
    // generic cart checkout.
    assertGenericCheckoutHasNoPurchaseOrder(parsed.data.purchaseOrderId);

    const paymentMethod = parsed.data.paymentMethod;
    if (paymentMethod === "MOCK" && !pilotMockPaymentsEnabled()) {
      return NextResponse.json(
        { success: false, error: "Test payments are disabled for this environment" },
        { status: 409 },
      );
    }

    // A signed Checkout.com webhook already exists, but this repository does
    // not yet contain a live payment-session creation flow. Fail closed rather
    // than accepting a card-looking order that can never be charged.
    if (["MADA", "APPLE_PAY", "CREDIT_CARD", "STC_PAY"].includes(paymentMethod)) {
      return NextResponse.json(
        { success: false, error: "Online payment initiation is not enabled for this deployment" },
        { status: 503 },
      );
    }

    const order = await secureCreateOrder({
      userId: session.user.id,
      type: parsed.data.type,
      currency: parsed.data.currency as Currency,
      items: parsed.data.items,
      shippingAddress: parsed.data.shippingAddress,
      paymentMethod: paymentMethod as PaymentMethod,
      notes: parsed.data.notes,
      couponCode: parsed.data.couponCode,
      idempotencyKey,
    });

    if (paymentMethod === "MOCK") {
      await finalizeInternalOrderPayment({
        orderId: order.id,
        method: "MOCK",
        pilotMockAllowed: true,
        actorId: session.user.id,
      });
    } else if (paymentMethod === "BANK_TRANSFER") {
      await finalizeInternalOrderPayment({
        orderId: order.id,
        method: "BANK_TRANSFER",
        actorId: session.user.id,
      });
    }

    return NextResponse.json({ success: true, data: orderResponse(order) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create order";
    const isBusinessError = /price|stock|unavailable|at least one item|account|company|purchase order|B2B|B2C|permitted|coupon|promotion|quantity|payment/i.test(message);
    if (!isBusinessError) log.error("orders.create failed", e, { path: "/api/orders" });
    return NextResponse.json({ success: false, error: message }, { status: isBusinessError ? 409 : 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const rawStatus = req.nextUrl.searchParams.get("status")?.trim();
    const parsedStatus = rawStatus ? OrderStatusSchema.safeParse(rawStatus) : null;
    if (parsedStatus && !parsedStatus.success) {
      return NextResponse.json({ success: false, error: "Invalid order status filter" }, { status: 400 });
    }
    const status = parsedStatus?.success ? parsedStatus.data as OrderStatus : undefined;

    const orders = await db.order.findMany({
      where: {
        userId: session.user.id,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: { items: true, statusHistory: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    return NextResponse.json({ success: true, data: orders });
  } catch {
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}
