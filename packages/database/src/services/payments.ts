import { Prisma, type PaymentMethod } from "@prisma/client";
import { db } from "../index";
import { accrueCommissions } from "./orders";

const CLOSED_ORDER_STATUSES = new Set(["CANCELLED", "REFUNDED", "RETURNED"]);

/**
 * Replay-safe payment finalization for payment methods that are resolved inside
 * Avenick itself. The per-order PostgreSQL advisory lock closes the classic
 * "find then create" race without pretending that an order can only ever have
 * one payment attempt in its lifetime.
 *
 * BANK_TRANSFER ensures the unpaid transfer instruction exists.
 * MOCK is pilot-only and atomically confirms payment, status history and seller
 * commissions. Callers must explicitly pass pilotMockAllowed after enforcing
 * the environment gate at the HTTP boundary.
 */
export async function finalizeInternalOrderPayment(input: {
  orderId: string;
  method: Extract<PaymentMethod, "BANK_TRANSFER" | "MOCK">;
  pilotMockAllowed?: boolean;
  actorId?: string;
}) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`order-payment:${input.orderId}`}))`,
    );

    const order = await tx.order.findUnique({ where: { id: input.orderId } });
    if (!order) throw new Error("Order not found while finalizing payment");

    if (input.method === "BANK_TRANSFER") {
      const existing = await tx.payment.findFirst({
        where: { orderId: order.id, method: "BANK_TRANSFER" },
        orderBy: { createdAt: "asc" },
      });
      if (existing) return { order, payment: existing, replay: true };

      const payment = await tx.payment.create({
        data: {
          orderId: order.id,
          method: "BANK_TRANSFER",
          status: "UNPAID",
          amount: order.total,
          currency: order.currency,
          gatewayData: { paymentRail: "BANK_TRANSFER", source: "AVENICK" },
        },
      });
      return { order, payment, replay: false };
    }

    if (!input.pilotMockAllowed) {
      throw new Error("Pilot mock payment finalization is disabled");
    }
    if (CLOSED_ORDER_STATUSES.has(order.status)) {
      throw new Error(`Cannot confirm a mock payment for a ${order.status.toLowerCase()} order`);
    }

    let payment = await tx.payment.findFirst({
      where: { orderId: order.id, method: "MOCK" },
      orderBy: { createdAt: "asc" },
    });
    const replay = Boolean(payment && order.paymentStatus === "PAID");

    if (!payment) {
      payment = await tx.payment.create({
        data: {
          orderId: order.id,
          method: "MOCK",
          status: "PAID",
          amount: order.total,
          currency: order.currency,
          gatewayRef: `PILOT-${order.orderNumber}`,
          gatewayData: { pilotMode: true, source: "AVENICK" },
          paidAt: new Date(),
        },
      });
    } else if (payment.status !== "PAID") {
      payment = await tx.payment.update({
        where: { id: payment.id },
        data: { status: "PAID", paidAt: payment.paidAt ?? new Date() },
      });
    }

    const shouldConfirmStatus = ["PENDING_PAYMENT", "PAYMENT_CONFIRMED"].includes(order.status);
    const needsOrderUpdate = order.paymentStatus !== "PAID" || shouldConfirmStatus;
    const updatedOrder = needsOrderUpdate
      ? await tx.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: "PAID",
            ...(shouldConfirmStatus ? { status: "CONFIRMED" } : {}),
          },
        })
      : order;

    if (shouldConfirmStatus) {
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: "CONFIRMED",
          message: "Pilot test payment confirmed",
          actorId: input.actorId,
        },
      });
    }

    await accrueCommissions(tx, order.id);
    return { order: updatedOrder, payment, replay };
  });
}
