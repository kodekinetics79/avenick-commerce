import { Prisma, type Currency, type PaymentMethod, type PaymentStatus } from "@prisma/client";
import { db } from "../index";
import { accrueCommissions } from "./orders";

const CLOSED_ORDER_STATUSES = new Set(["CANCELLED", "REFUNDED", "RETURNED"]);
const CHECKOUT_METHODS = new Set<PaymentMethod>(["MADA", "APPLE_PAY", "CREDIT_CARD", "STC_PAY"]);

export function assertInternalPaymentMethodMatches(
  stored: PaymentMethod | null,
  requested: Extract<PaymentMethod, "BANK_TRANSFER" | "MOCK">,
) {
  if (stored !== requested) {
    throw new Error(`Internal payment finalizer ${requested} does not match stored order payment method ${stored ?? "NONE"}`);
  }
}

export type CheckoutPaymentEvent = {
  eventId: string;
  type: "payment_approved" | "payment_declined";
  paymentId: string;
  orderId: string;
  paymentAttemptId: string;
  amount: number;
  currency: string;
};

type StoredWebhookEvidence = {
  checkoutPaymentId?: string;
  processedWebhookEventIds?: string[];
  lastWebhookEventId?: string;
  lastWebhookType?: string;
};

function asEvidence(value: Prisma.JsonValue | null): StoredWebhookEvidence {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as StoredWebhookEvidence;
}

export function expectedCheckoutMinorAmount(amount: Prisma.Decimal | number | string): number {
  const decimal = new Prisma.Decimal(amount);
  const minor = decimal.mul(100);
  if (!minor.isInteger() || minor.isNegative() || minor.greaterThan(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Payment attempt amount cannot be represented in minor currency units");
  }
  return minor.toNumber();
}

export function validateCheckoutEventAgainstAttempt(input: {
  event: CheckoutPaymentEvent;
  payment: {
    id: string;
    orderId: string;
    method: PaymentMethod;
    amount: Prisma.Decimal | number | string;
    currency: Currency;
    gatewayRef: string | null;
    gatewayData: Prisma.JsonValue | null;
  };
}) {
  const { event, payment } = input;
  if (!event.eventId || !event.paymentId || !event.orderId || !event.paymentAttemptId) {
    throw new Error("Payment webhook is missing immutable event or attempt identity");
  }
  if (event.paymentAttemptId !== payment.id || event.orderId !== payment.orderId) {
    throw new Error("Payment webhook does not match the referenced payment attempt");
  }
  if (!CHECKOUT_METHODS.has(payment.method)) {
    throw new Error("Payment webhook cannot finalize a non-Checkout.com payment attempt");
  }
  if (!Number.isSafeInteger(event.amount) || event.amount < 0 || event.amount !== expectedCheckoutMinorAmount(payment.amount)) {
    throw new Error("Payment webhook amount does not match the payment attempt");
  }
  if (event.currency.trim().toUpperCase() !== payment.currency) {
    throw new Error("Payment webhook currency does not match the payment attempt");
  }
  const evidence = asEvidence(payment.gatewayData);
  const boundGatewayId = evidence.checkoutPaymentId ?? payment.gatewayRef;
  if (boundGatewayId && boundGatewayId !== event.paymentId) {
    throw new Error("Payment webhook gateway identity does not match the payment attempt");
  }
  return evidence;
}

export function checkoutPaymentTransition(current: PaymentStatus, eventType: CheckoutPaymentEvent["type"]): {
  next: PaymentStatus;
  replay: boolean;
} {
  const desired: PaymentStatus = eventType === "payment_approved" ? "PAID" : "FAILED";
  if (current === desired) return { next: current, replay: true };
  if (current !== "UNPAID") {
    throw new Error(`Payment webhook cannot move an attempt from ${current} to ${desired}`);
  }
  return { next: desired, replay: false };
}

/**
 * Applies a signed Checkout.com outcome to exactly one pre-created payment
 * attempt. The order lock serializes competing provider deliveries; immutable
 * event ids and gateway ids make replays harmless, while terminal payment
 * states never move backwards.
 */
export async function applyCheckoutPaymentEvent(event: CheckoutPaymentEvent) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`order-payment:${event.orderId}`}))`,
    );

    const payment = await tx.payment.findUnique({ where: { id: event.paymentAttemptId } });
    if (!payment) throw new Error("Referenced payment attempt was not found");
    const evidence = validateCheckoutEventAgainstAttempt({ event, payment });
    const processed = Array.isArray(evidence.processedWebhookEventIds)
      ? evidence.processedWebhookEventIds.filter((value): value is string => typeof value === "string")
      : [];
    if (processed.includes(event.eventId)) return { payment, replay: true, orderChanged: false };

    const transition = checkoutPaymentTransition(payment.status, event.type);
    if (transition.replay) {
      // Same terminal outcome with a new provider delivery id is still recorded
      // as evidence, but cannot repeat order history or commissions.
      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: {
          gatewayData: {
            ...evidence,
            checkoutPaymentId: event.paymentId,
            processedWebhookEventIds: [...processed.slice(-49), event.eventId],
            lastWebhookEventId: event.eventId,
            lastWebhookType: event.type,
          },
        },
      });
      return { payment: updated, replay: true, orderChanged: false };
    }

    const updatedPayment = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: transition.next,
        gatewayRef: event.paymentId,
        paidAt: transition.next === "PAID" ? new Date() : null,
        gatewayData: {
          ...evidence,
          checkoutPaymentId: event.paymentId,
          processedWebhookEventIds: [...processed.slice(-49), event.eventId],
          lastWebhookEventId: event.eventId,
          lastWebhookType: event.type,
        },
      },
    });

    const order = await tx.order.findUnique({ where: { id: event.orderId } });
    if (!order) throw new Error("Payment attempt order was not found");
    if (event.type === "payment_declined") {
      // A failed attempt must not downgrade an order paid by another attempt.
      if (order.paymentStatus !== "PAID") {
        await tx.order.update({ where: { id: order.id }, data: { paymentStatus: "FAILED" } });
      }
      return { payment: updatedPayment, replay: false, orderChanged: order.paymentStatus !== "PAID" };
    }

    if (CLOSED_ORDER_STATUSES.has(order.status)) {
      throw new Error(`Cannot confirm payment for a ${order.status.toLowerCase()} order`);
    }
    const shouldConfirm = ["PENDING_PAYMENT", "PAYMENT_CONFIRMED"].includes(order.status);
    const orderChanged = order.paymentStatus !== "PAID" || shouldConfirm;
    if (orderChanged) {
      await tx.order.update({
        where: { id: order.id },
        data: { paymentStatus: "PAID", ...(shouldConfirm ? { status: "CONFIRMED" } : {}) },
      });
    }
    if (shouldConfirm) {
      await tx.orderStatusHistory.create({
        data: { orderId: order.id, status: "CONFIRMED", message: "Payment confirmed via Checkout.com" },
      });
    }
    await accrueCommissions(tx, order.id);
    return { payment: updatedPayment, replay: false, orderChanged };
  });
}

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
    assertInternalPaymentMethodMatches(order.paymentMethod, input.method);

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
