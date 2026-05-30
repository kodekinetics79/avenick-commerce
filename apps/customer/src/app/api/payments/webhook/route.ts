import { NextRequest, NextResponse } from "next/server";
import { db } from "@manzil/database";

// Checkout.com webhook handler skeleton
// TODO: Verify webhook signature using CHECKOUT_WEBHOOK_SECRET
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, data } = body;

    if (type === "payment_approved" && data?.metadata?.orderId) {
      const orderId = data.metadata.orderId as string;
      await db.$transaction([
        db.order.update({ where: { id: orderId }, data: { paymentStatus: "PAID", status: "CONFIRMED" } }),
        db.payment.updateMany({ where: { orderId }, data: { status: "PAID", gatewayRef: data.id, paidAt: new Date() } }),
        db.orderStatusHistory.create({ data: { orderId, status: "CONFIRMED", message: "Payment confirmed via Checkout.com" } }),
      ]);
    }

    if (type === "payment_declined" && data?.metadata?.orderId) {
      const orderId = data.metadata.orderId as string;
      await db.order.update({ where: { id: orderId }, data: { paymentStatus: "FAILED" } });
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("Webhook error:", e);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
