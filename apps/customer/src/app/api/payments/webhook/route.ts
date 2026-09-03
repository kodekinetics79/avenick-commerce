import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { applyCheckoutPaymentEvent, type CheckoutPaymentEvent } from "@avenick/database";
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

function checkoutEvent(value: unknown): CheckoutPaymentEvent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid webhook envelope");
  const body = value as Record<string, unknown>;
  if (body.type !== "payment_approved" && body.type !== "payment_declined") return null;
  if (!body.data || typeof body.data !== "object" || Array.isArray(body.data)) throw new Error("Invalid payment event data");
  const data = body.data as Record<string, unknown>;
  const metadata = data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)
    ? data.metadata as Record<string, unknown>
    : {};
  if (
    typeof body.id !== "string" ||
    typeof data.id !== "string" ||
    typeof metadata.orderId !== "string" ||
    typeof metadata.paymentAttemptId !== "string" ||
    typeof data.amount !== "number" ||
    typeof data.currency !== "string"
  ) {
    throw new Error("Payment event is missing required identity or commercial fields");
  }
  return {
    eventId: body.id,
    type: body.type,
    paymentId: data.id,
    orderId: metadata.orderId,
    paymentAttemptId: metadata.paymentAttemptId,
    amount: data.amount,
    currency: data.currency,
  };
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
      const event = checkoutEvent(JSON.parse(rawBody));
      if (!event) return NextResponse.json({ received: true, ignored: true });
      span.setAttribute("payment.event_type", event.type);
      span.setAttribute("order.id", event.orderId);
      span.setAttribute("payment.attempt_id", event.paymentAttemptId);

      const result = await applyCheckoutPaymentEvent(event);
      if (event.type === "payment_approved") {
        log.info("payment captured", { orderId: event.orderId, eventType: event.type, replay: result.replay });
        if (!result.replay) recordEvent("payment.captured");
      } else {
        log.warn("payment declined", { orderId: event.orderId, eventType: event.type, replay: result.replay });
        if (!result.replay) recordEvent("payment.declined");
      }

      return NextResponse.json({ received: true, replay: result.replay });
    } catch (e) {
      // Recorded on the span by withSpan; also log with correlation.
      log.error("payments.webhook processing error", e);
      recordEvent("payment.webhook.error");
      return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
    }
  });
}
