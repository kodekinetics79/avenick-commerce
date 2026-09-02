import { AuditAction, Prisma, type Currency, type PaymentMethod, type PaymentStatus } from "@prisma/client";
import { db } from "../index";
import { requireCurrentAdminActor } from "./checkout-invariants";
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

// ─── ADMIN-CONFIRMED BANK TRANSFERS ───────────────────────────────────────────

/**
 * Evidence written onto a bank-transfer Payment row when a human confirms it.
 * A finance team is audited on exactly these fields, so they are recorded on
 * the row itself rather than reconstructed later from timestamps.
 */
type StoredBankTransferEvidence = {
  paymentRail?: string;
  source?: string;
  openedBy?: string;
  precedingPaymentId?: string;
  expectedAmount?: string;
  bankReference?: string;
  valueDate?: string;
  confirmedAt?: string;
  confirmedByActorId?: string;
  /** Other orders' PAID rows carrying the same bank reference at confirmation time. */
  sharedReferenceOrders?: Array<{ paymentId: string; orderNumber: string; amount: string; currency: string }>;
};

function asBankTransferEvidence(value: Prisma.JsonValue | null): StoredBankTransferEvidence {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as StoredBankTransferEvidence;
}

// The bank reference is the only thing tying a row in this ledger to a line on
// a bank statement. It is mandatory and constrained rather than free text so an
// empty or whitespace "confirmation" can never be recorded as evidence.
const BANK_REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 ._:\/#-]{2,63}$/;

export function normaliseBankReference(value: string): string {
  const reference = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!BANK_REFERENCE_PATTERN.test(reference)) {
    throw new Error(
      "A bank reference of 3-64 characters (letters, digits and space . _ : / # -) is required as settlement evidence",
    );
  }
  return reference;
}

/**
 * Money never becomes a JS float here. Payment.amount is Decimal(12,2): an
 * amount carrying more precision than the ledger can store would be silently
 * rounded on write, so it is refused instead of quietly losing fils.
 */
export function parseConfirmedTransferAmount(value: Prisma.Decimal | number | string): Prisma.Decimal {
  let amount: Prisma.Decimal;
  try {
    amount = new Prisma.Decimal(typeof value === "string" ? value.trim() : value);
  } catch {
    throw new Error("Confirmed amount is not a valid number");
  }
  if (!amount.isFinite()) throw new Error("Confirmed amount is not a valid number");
  if (amount.lessThanOrEqualTo(0)) throw new Error("Confirmed amount must be greater than zero");
  if (amount.decimalPlaces() > 2) throw new Error("Confirmed amount cannot carry more than two decimal places");
  if (amount.greaterThan("9999999999.99")) throw new Error("Confirmed amount exceeds the range this ledger can store");
  return amount;
}

// A date-only value date arrives as UTC midnight, so an operator in a UTC+
// zone can legitimately submit "today" hours before UTC reaches that date.
// The tolerance covers that and nothing more: a value date genuinely in the
// future would assert that funds settled before they were received.
const VALUE_DATE_TOLERANCE_MS = 24 * 60 * 60 * 1000;

export function parseTransferValueDate(value: Date | string, now: Date = new Date()): Date {
  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(String(value ?? "").trim());
  if (Number.isNaN(parsed.getTime())) throw new Error("A valid bank value date is required");
  if (parsed.getTime() > now.getTime() + VALUE_DATE_TOLERANCE_MS) {
    throw new Error("Bank value date cannot be in the future — funds cannot settle before they are received");
  }
  return parsed;
}

/**
 * The transfer instruction a buyer pays against is issued when the order is
 * placed, so a credit value-dated before that cannot have been made against
 * it. In practice such a date is a mistyped year ("0226-09-01" parses as a
 * valid date), and `paidAt` is what finance reports on: accepting it would
 * file the receipt under a period nobody will ever open. The same date-only
 * tolerance applies as for the future bound.
 */
export function assertValueDateNotBeforeOrder(valueDate: Date, order: { orderNumber: string; createdAt: Date }) {
  if (valueDate.getTime() < order.createdAt.getTime() - VALUE_DATE_TOLERANCE_MS) {
    throw new Error(
      `Bank value date ${valueDate.toISOString().slice(0, 10)} is before order ${order.orderNumber} was placed on ${order.createdAt.toISOString().slice(0, 10)}; a credit that predates the order cannot be reconciled against its transfer instruction`,
    );
  }
}

/**
 * Records a bank credit against one BANK_TRANSFER payment attempt, on the
 * authority of a current platform admin who has read it off a bank statement.
 * Without this path a B2B order stays UNPAID forever: no Checkout.com webhook
 * ever fires for a wire, so `applyCheckoutPaymentEvent` never runs and
 * `accrueCommissions` is never reached for B2B revenue.
 *
 * Discipline is mirrored from `applyCheckoutPaymentEvent` above:
 *  - one order-scoped advisory fence serializes competing confirmations;
 *  - immutable evidence (reference, value date, actor) is written on the row;
 *  - a settled attempt is never re-settled, and the order's paymentStatus is
 *    derived from the SUM of confirmed receipts rather than assumed from one
 *    row, so a short payment lands on PARTIALLY_PAID and never on PAID.
 *
 * There is no FX table in this repository, so any currency disagreement is
 * refused rather than converted.
 */
export async function confirmBankTransferPayment(input: {
  paymentId: string;
  actorId: string;
  bankReference: string;
  amount: Prisma.Decimal | number | string;
  valueDate: Date | string;
}) {
  if (!input.paymentId || !input.actorId) {
    throw new Error("Payment and admin actor identity are required to confirm a bank transfer");
  }
  // Input is validated before any lock is taken: a malformed reference or
  // amount must never hold the order fence.
  const bankReference = normaliseBankReference(input.bankReference);
  const amount = parseConfirmedTransferAmount(input.amount);
  const valueDate = parseTransferValueDate(input.valueDate);

  // Payment.orderId is immutable in this codebase (no write path ever rewrites
  // it), so it is safe to read outside the fence purely to derive the lock key.
  // Every fact the decision rests on is re-read under the lock below, and the
  // binding itself is re-asserted there.
  const target = await db.payment.findUnique({ where: { id: input.paymentId }, select: { id: true, orderId: true } });
  if (!target) throw new Error("Payment not found");

  return db.$transaction(async (tx) => {
    // Actor authority (user-commerce fence) is taken before the order fence:
    // that is the order every other governed mutation in this repo acquires
    // them in, and nothing acquires order-payment before user-commerce, so
    // confirmations cannot deadlock against checkout or PO placement.
    await requireCurrentAdminActor(tx, input.actorId);
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`order-payment:${target.orderId}`}))`,
    );

    const payment = await tx.payment.findUnique({ where: { id: target.id } });
    if (!payment) throw new Error("Payment not found");
    if (payment.orderId !== target.orderId) {
      throw new Error("Payment moved to another order while it was being confirmed; reload and retry");
    }
    if (payment.method !== "BANK_TRANSFER") {
      throw new Error("Only a bank transfer can be confirmed by an administrator; gateway payments settle through their signed webhook");
    }

    const order = await tx.order.findUnique({ where: { id: payment.orderId } });
    if (!order) throw new Error("Payment order was not found");
    // Reuses the single guard that binds an internally-settled order to its
    // stored payment method rather than restating the rule here.
    assertInternalPaymentMethodMatches(order.paymentMethod, "BANK_TRANSFER");
    if (payment.currency !== order.currency) {
      throw new Error(
        `Bank transfer is denominated in ${payment.currency} but the order is in ${order.currency}; this system has no FX policy, so the receipt cannot be reconciled`,
      );
    }

    // Confirmed receipts are summed in Postgres and grouped by currency: a
    // mixed-currency order cannot be reconciled without an FX policy, so it
    // fails loudly instead of adding unlike amounts together.
    const confirmedGroups = await tx.payment.groupBy({
      by: ["currency"],
      where: { orderId: order.id, status: "PAID" },
      _sum: { amount: true },
    });
    const foreignReceipts = confirmedGroups.filter((group) => group.currency !== order.currency);
    if (foreignReceipts.length > 0) {
      throw new Error(
        `Order ${order.orderNumber} already holds confirmed receipts in ${foreignReceipts.map((group) => group.currency).join(", ")}; refusing to reconcile across currencies`,
      );
    }
    const priorConfirmed = new Prisma.Decimal(confirmedGroups[0]?._sum.amount ?? 0);

    const evidence = asBankTransferEvidence(payment.gatewayData);
    if (payment.status === "PAID") {
      // Terminal state is monotonic. The same reference and amount is a
      // double-submit and is answered idempotently; anything else is a second
      // credit and must be recorded against the open balance, never by
      // overwriting settled evidence.
      const recordedReference = (evidence.bankReference ?? payment.gatewayRef ?? "").toUpperCase();
      if (recordedReference === bankReference.toUpperCase() && payment.amount.equals(amount)) {
        return {
          payment,
          orderId: order.id,
          orderNumber: order.orderNumber,
          replay: true,
          orderPaymentStatus: order.paymentStatus,
          confirmedTotal: priorConfirmed,
          outstanding: order.total.sub(priorConfirmed),
          residualPayment: null as typeof payment | null,
          sharedReferenceOrders: evidence.sharedReferenceOrders ?? [],
        };
      }
      throw new Error(
        `This payment was already confirmed${evidence.bankReference ? ` against bank reference ${evidence.bankReference}` : ""}; record a further credit against the order's open balance instead`,
      );
    }
    if (payment.status !== "UNPAID") {
      throw new Error(`A ${payment.status.toLowerCase().replace(/_/g, " ")} payment cannot be confirmed`);
    }

    if (CLOSED_ORDER_STATUSES.has(order.status)) {
      throw new Error(`Cannot confirm a bank transfer for a ${order.status.toLowerCase().replace(/_/g, " ")} order`);
    }
    if (order.paymentStatus === "REFUNDED") {
      throw new Error("This order has been refunded; a further bank transfer cannot be confirmed against it");
    }
    assertValueDateNotBeforeOrder(valueDate, order);

    // The same bank statement line must not be banked twice on one order.
    const duplicateReference = await tx.payment.findFirst({
      where: {
        orderId: order.id,
        status: "PAID",
        id: { not: payment.id },
        gatewayRef: { equals: bankReference, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (duplicateReference) {
      throw new Error(`Bank reference ${bankReference} is already recorded against order ${order.orderNumber}`);
    }

    // One wire can legitimately settle several orders, so the same reference
    // on another order is not refused — but it is also exactly what banking
    // one statement line twice looks like. It is recorded on the row, in the
    // audit trail and in the result so the operator and the auditor both see
    // it, rather than being discoverable only by searching the ledger later.
    const sharedReference = await tx.payment.findMany({
      where: {
        orderId: { not: order.id },
        status: "PAID",
        method: "BANK_TRANSFER",
        gatewayRef: { equals: bankReference, mode: "insensitive" },
      },
      select: { id: true, amount: true, currency: true, order: { select: { orderNumber: true } } },
      orderBy: { createdAt: "asc" },
      take: 20,
    });
    const sharedReferenceOrders = sharedReference.map((row) => ({
      paymentId: row.id,
      orderNumber: row.order.orderNumber,
      amount: row.amount.toFixed(2),
      currency: row.currency,
    }));

    const confirmedTotal = priorConfirmed.add(amount);
    if (confirmedTotal.greaterThan(order.total)) {
      throw new Error(
        `Confirming ${amount.toFixed(2)} ${order.currency} would take confirmed receipts to ${confirmedTotal.toFixed(2)} against an order total of ${order.total.toFixed(2)}; record the amount actually credited, or handle the excess as a refund`,
      );
    }
    const nextPaymentStatus: PaymentStatus = confirmedTotal.equals(order.total) ? "PAID" : "PARTIALLY_PAID";
    if (order.paymentStatus === "PAID" && nextPaymentStatus !== "PAID") {
      // Never silently downgrade a paid order. Reaching here means the order
      // flag and the receipts disagree, which a human must investigate.
      throw new Error(
        `Order ${order.orderNumber} is marked paid but its confirmed receipts (${confirmedTotal.toFixed(2)} ${order.currency}) do not cover its total (${order.total.toFixed(2)}); refusing to downgrade it`,
      );
    }

    const confirmedAt = new Date();
    // Compare-and-set on the status we read: the fence serializes confirmations
    // but this is the guarantee that exactly one of them settles this row.
    const settled = await tx.payment.updateMany({
      where: { id: payment.id, status: "UNPAID" },
      data: {
        status: "PAID",
        // The row now states the credit that actually landed; what was
        // originally instructed is preserved in the evidence below.
        amount,
        gatewayRef: bankReference,
        // Value date, not confirmation time: this is when the funds settled,
        // and it is what finance reports on.
        paidAt: valueDate,
        gatewayData: {
          ...evidence,
          paymentRail: "BANK_TRANSFER",
          source: "AVENICK",
          expectedAmount: payment.amount.toFixed(2),
          bankReference,
          valueDate: valueDate.toISOString(),
          confirmedAt: confirmedAt.toISOString(),
          confirmedByActorId: input.actorId,
          ...(sharedReferenceOrders.length > 0 ? { sharedReferenceOrders } : {}),
        },
      },
    });
    if (settled.count !== 1) {
      throw new Error("Payment status changed while it was being confirmed; reload and retry");
    }

    const shouldConfirmStatus =
      nextPaymentStatus === "PAID" && ["PENDING_PAYMENT", "PAYMENT_CONFIRMED"].includes(order.status);
    if (order.paymentStatus !== nextPaymentStatus || shouldConfirmStatus) {
      // The order total and currency are in the predicate because the
      // reconciliation above was computed from them; the advisory fence does
      // not cover order edits made by other flows.
      const moved = await tx.order.updateMany({
        where: {
          id: order.id,
          status: order.status,
          paymentStatus: order.paymentStatus,
          total: order.total,
          currency: order.currency,
        },
        data: { paymentStatus: nextPaymentStatus, ...(shouldConfirmStatus ? { status: "CONFIRMED" } : {}) },
      });
      if (moved.count !== 1) {
        throw new Error("Order changed while the bank transfer was being confirmed; reload and retry");
      }
    }

    if (shouldConfirmStatus) {
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: "CONFIRMED",
          message: `Bank transfer confirmed (ref ${bankReference})`,
          actorId: input.actorId,
        },
      });
    }

    // Same call, same transaction, same replay guard as the two existing paid
    // paths — commission accrual is not duplicated here.
    if (nextPaymentStatus === "PAID") {
      await accrueCommissions(tx, order.id);
    }

    // A short payment leaves the order with no open instruction to confirm the
    // next tranche against, which is what made PARTIALLY_PAID unreachable in
    // practice. One unpaid row for the residual balance keeps the ledger
    // honest: every confirmed row is exactly one bank credit.
    const outstanding = order.total.sub(confirmedTotal);
    let residualPayment: typeof payment | null = null;
    if (outstanding.greaterThan(0)) {
      const openInstruction = await tx.payment.findFirst({
        where: { orderId: order.id, method: "BANK_TRANSFER", status: "UNPAID" },
        select: { id: true },
      });
      if (!openInstruction) {
        residualPayment = await tx.payment.create({
          data: {
            orderId: order.id,
            method: "BANK_TRANSFER",
            status: "UNPAID",
            amount: outstanding,
            currency: order.currency,
            gatewayData: {
              paymentRail: "BANK_TRANSFER",
              source: "AVENICK",
              openedBy: "PARTIAL_CONFIRMATION",
              precedingPaymentId: payment.id,
            },
          },
        });
      }
    }

    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        entityType: "Payment",
        entityId: payment.id,
        action: AuditAction.STATUS_CHANGE,
        before: {
          paymentStatus: payment.status,
          instructedAmount: payment.amount.toFixed(2),
          orderStatus: order.status,
          orderPaymentStatus: order.paymentStatus,
          confirmedToDate: priorConfirmed.toFixed(2),
        },
        after: {
          paymentStatus: "PAID",
          confirmedAmount: amount.toFixed(2),
          currency: order.currency,
          bankReference,
          valueDate: valueDate.toISOString(),
          confirmedAt: confirmedAt.toISOString(),
          orderId: order.id,
          orderNumber: order.orderNumber,
          orderTotal: order.total.toFixed(2),
          orderStatus: shouldConfirmStatus ? "CONFIRMED" : order.status,
          orderPaymentStatus: nextPaymentStatus,
          confirmedToDate: confirmedTotal.toFixed(2),
          outstanding: outstanding.toFixed(2),
          residualPaymentId: residualPayment?.id ?? null,
          sharedReferenceOrders,
        },
      },
    });

    const confirmed = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
    return {
      payment: confirmed,
      orderId: order.id,
      orderNumber: order.orderNumber,
      replay: false,
      orderPaymentStatus: nextPaymentStatus,
      confirmedTotal,
      outstanding,
      residualPayment,
      sharedReferenceOrders,
    };
  });
}
