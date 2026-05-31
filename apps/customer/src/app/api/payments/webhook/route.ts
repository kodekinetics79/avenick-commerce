import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@avenick/database";

// Signature verification must run on the raw body in the Node runtime.
export const runtime = "nodejs";

// Checkout.com signs webhooks with HMAC-SHA256 over the raw request body using
// the webhook secret, delivered in the `Cko-Signature` header. We verify it
// (timing-safe) before trusting any payment state transition.
function isValidSignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const secret = process.env.CHECKOUT_WEBHOOK_SECRET;
  if (!secret) {
    // Fail closed: never mutate payment state when verification is impossible.
    console.error("CHECKOUT_WEBHOOK_SECRET is not configured; rejecting webhook");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("cko-signature") ?? "";
  if (!signature || !isValidSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    const { type, data } = JSON.parse(rawBody);
    const orderId = data?.metadata?.orderId as string | undefined;

    if (orderId && type === "payment_approved") {
      await db.$transaction([
        db.order.update({ where: { id: orderId }, data: { paymentStatus: "PAID", status: "CONFIRMED" } }),
        db.payment.updateMany({ where: { orderId }, data: { status: "PAID", gatewayRef: data.id, paidAt: new Date() } }),
        db.orderStatusHistory.create({ data: { orderId, status: "CONFIRMED", message: "Payment confirmed via Checkout.com" } }),
      ]);
    } else if (orderId && type === "payment_declined") {
      await db.order.update({ where: { id: orderId }, data: { paymentStatus: "FAILED" } });
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("Webhook processing error:", e);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
