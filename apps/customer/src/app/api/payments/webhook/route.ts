import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db, accrueCommissions } from "@avenick/database";
import { log, recordEvent, withSpan } from "@avenick/observability";

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
    log.error("payments.webhook misconfigured", undefined, {
      reason: "CHECKOUT_WEBHOOK_SECRET is not configured; rejecting webhook",
    });
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("cko-signature") ?? "";
  if (!signature || !isValidSignature(rawBody, signature, secret)) {
    log.warn("payments.webhook rejected", { reason: "invalid signature" });
    recordEvent("payment.webhook.rejected");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Process inside a span so a payment state transition is one traceable unit
  // of work — the money path is the one you most need to trace in 60 seconds.
  return withSpan("payment.webhook", async (span) => {
    try {
      const { type, data } = JSON.parse(rawBody);
      const orderId = data?.metadata?.orderId as string | undefined;
      span.setAttribute("payment.event_type", String(type));
      if (orderId) span.setAttribute("order.id", orderId);

      if (orderId && type === "payment_approved") {
        await db.$transaction(async (tx) => {
          await tx.order.update({ where: { id: orderId }, data: { paymentStatus: "PAID", status: "CONFIRMED" } });
          await tx.payment.updateMany({ where: { orderId }, data: { status: "PAID", gatewayRef: data.id, paidAt: new Date() } });
          await tx.orderStatusHistory.create({ data: { orderId, status: "CONFIRMED", message: "Payment confirmed via Checkout.com" } });
          // Accrue platform commission for each seller (idempotent on webhook replay).
          await accrueCommissions(tx, orderId);
        });
        log.info("payment captured", { orderId, eventType: type });
        recordEvent("payment.captured");
      } else if (orderId && type === "payment_declined") {
        await db.order.update({ where: { id: orderId }, data: { paymentStatus: "FAILED" } });
        log.warn("payment declined", { orderId, eventType: type });
        recordEvent("payment.declined");
      }

      return NextResponse.json({ received: true });
    } catch (e) {
      // Recorded on the span by withSpan; also log with correlation.
      log.error("payments.webhook processing error", e);
      recordEvent("payment.webhook.error");
      return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
    }
  });
}
