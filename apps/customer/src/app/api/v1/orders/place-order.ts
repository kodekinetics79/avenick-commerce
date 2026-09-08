import type { PlaceOrderRequest } from "@avenick/contracts";
import type { PaymentMethod } from "@avenick/database";
import {
  assertGenericCheckoutHasNoPurchaseOrder,
  db,
  finalizeInternalOrderPayment,
  secureCreateOrder,
} from "@avenick/database";
import {
  assertMatchingIdempotencyFingerprint,
  canonicalOrderRequest,
} from "@avenick/database/commerce-governance";

import { V1Error, conflict, upstreamUnavailable, validationFailed } from "../_lib/errors";
import type { Principal } from "../_lib/principal";
import { readOrderDetail } from "./order-read";

/**
 * POST /api/v1/orders — the write the whole app exists to reach.
 *
 * The order-shaped logic all lives in `secureCreateOrder`: seller ids are
 * derived from the product, prices and VAT are resolved server-side, stock and
 * MOQ are re-checked, and the whole thing runs in one transaction. Nothing here
 * recomputes any of it. What this file owns is the endpoint's POLICY — which
 * payment methods can complete, what a retry means, and how a business refusal
 * becomes one of the contract's nine error codes.
 */

/** Pilot-only test payments, gated by the environment exactly as `/api/orders` gates them. */
function pilotMockPaymentsEnabled(): boolean {
  return process.env.PILOT_MODE === "true" && process.env.ALLOW_MOCK_PAYMENTS === "true";
}

/**
 * The two methods this platform can settle by itself.
 *
 * `finalizeInternalOrderPayment` accepts exactly these, which is why the type
 * below is an `Extract` of the enum and not a new list.
 */
const INTERNAL_METHODS = ["BANK_TRANSFER", "MOCK"] as const satisfies readonly PaymentMethod[];
type InternalMethod = (typeof INTERNAL_METHODS)[number];

/**
 * EVERY OTHER METHOD FAILS CLOSED. DO NOT LOOSEN THIS.
 *
 * A signed Checkout.com webhook exists in this repository; a flow that CREATES
 * a payment session does not. So an order placed with a card or a wallet would
 * be accepted, recorded as UNPAID, and never chargeable — a buyer who believes
 * they have paid, an operator with an order nobody can settle, and no error
 * anywhere. Refusing is the only honest answer until the session flow lands.
 *
 * The fence below is the idiom `apps/customer/src/app/api/orders/route.ts` uses
 * for OrderStatus: add a method to the Prisma enum and forget it here and this
 * file stops compiling, rather than the new method silently falling through to
 * "accepted and unpayable". That is deliberate — this list must never be able
 * to grow by omission.
 */
type ExternalPaymentMethod = Exclude<PaymentMethod, InternalMethod>;

const EXTERNAL_METHODS = [
  "MADA",
  "APPLE_PAY",
  "CREDIT_CARD",
  "STC_PAY",
] as const satisfies readonly ExternalPaymentMethod[];

type _EveryExternalMethodIsListed =
  Exclude<ExternalPaymentMethod, (typeof EXTERNAL_METHODS)[number]> extends never ? true : never;
const _everyExternalMethodIsListed: _EveryExternalMethodIsListed = true;
void _everyExternalMethodIsListed;

function isExternal(method: PaymentMethod): method is ExternalPaymentMethod {
  return (EXTERNAL_METHODS as readonly PaymentMethod[]).includes(method);
}

/**
 * Business refusals from the checkout transaction, as the contract's codes.
 *
 * This is the same classification `/api/orders` performs, kept deliberately
 * identical rather than improved: the two routes place orders through the same
 * function, and a rule that answered differently depending on which client
 * called would be a second definition of what "the stock moved" means.
 *
 * A message that matches is the endpoint WORKING — a stale basket, a withdrawn
 * seller, a spent coupon — and is answered 409 with the reason. Anything else
 * is unexpected and is rethrown, so the wrapper logs it with its stack and
 * tells the client nothing but the requestId.
 */
const BUSINESS_REFUSAL =
  /price|stock|unavailable|at least one item|account|company|purchase order|B2B|B2C|permitted|coupon|promotion|quantity|payment|idempotency/i;

function asContractError(error: unknown): never {
  if (error instanceof V1Error) throw error;
  const message = error instanceof Error ? error.message : "";
  if (message && BUSINESS_REFUSAL.test(message)) throw conflict(message);
  throw error;
}

/**
 * Settle the methods this platform settles itself.
 *
 * Shared by the fresh placement and the idempotent replay because
 * `/api/orders` repairs a replay the same way it settles a new order: the
 * finalizer is idempotent per order (it takes an advisory lock and returns the
 * existing payment rather than creating a second), so a retry whose first
 * attempt died between the order write and the payment write still ends up
 * settled.
 */
async function settleInternalPayment(
  order: { id: string; paymentMethod: PaymentMethod | null },
  actorId: string,
): Promise<void> {
  if (order.paymentMethod === "BANK_TRANSFER") {
    await finalizeInternalOrderPayment({ orderId: order.id, method: "BANK_TRANSFER", actorId });
    return;
  }
  // The environment gate is enforced at the boundary below before a MOCK order
  // can be created, so this can only be reached for an order that was already
  // allowed one. Re-reading it here means a deployment that turned pilot
  // payments off does not go on confirming them on replay.
  if (order.paymentMethod === "MOCK" && pilotMockPaymentsEnabled()) {
    await finalizeInternalOrderPayment({
      orderId: order.id,
      method: "MOCK",
      pilotMockAllowed: true,
      actorId,
    });
  }
}

export interface PlaceOrderInput {
  request: PlaceOrderRequest;
  principal: Principal;
  /** The raw `Idempotency-Key` header, before validation. */
  idempotencyKeyHeader: string | null;
  origin: string;
}

export interface PlacedOrderResult {
  order: NonNullable<Awaited<ReturnType<typeof readOrderDetail>>>;
  replayed: boolean;
}

/** The contract's bound, restated as a refusal rather than a truncation. */
const MAX_IDEMPOTENCY_KEY = 128;

export async function placeOrder(input: PlaceOrderInput): Promise<PlacedOrderResult> {
  const { request, principal, origin } = input;
  const userId = principal.userId;

  const idempotencyKey = input.idempotencyKeyHeader?.trim() || undefined;
  if (idempotencyKey && idempotencyKey.length > MAX_IDEMPOTENCY_KEY) {
    throw validationFailed("The Idempotency-Key header is too long.", {
      "Idempotency-Key": [`Use at most ${MAX_IDEMPOTENCY_KEY} characters.`],
    });
  }

  /*
    Defence in depth, and a tripwire. `PlaceOrderRequestSchema` has no
    `purchaseOrderId` field at all, so this can only fire if one is ever added —
    at which point it fires instead of letting a governed PO be consumed by
    generic checkout, which is the whole reason the assertion exists.
  */
  const purchaseOrderId: string | undefined = undefined;
  assertGenericCheckoutHasNoPurchaseOrder(purchaseOrderId);

  /*
    The fingerprint covers what the order MEANS: lines (deduplicated and
    ordered), destination, currency, payment method, coupon and notes. Two
    requests with the same key but different meaning is a client bug, and
    answering it with the first order would hand back an order for goods the
    second request never asked for.
  */
  const requestFingerprint = canonicalOrderRequest({ ...request, type: "B2C" });

  if (idempotencyKey) {
    const existing = await db.order.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
      select: { id: true, paymentMethod: true, requestFingerprint: true },
    });
    if (existing) {
      try {
        assertMatchingIdempotencyFingerprint(existing.requestFingerprint, requestFingerprint);
        await settleInternalPayment(existing, userId);
      } catch (error) {
        asContractError(error);
      }
      const order = await readOrderDetail({ orderId: existing.id, userId, origin });
      if (!order) throw conflict("That order is no longer readable on this account.");
      return { order, replayed: true };
    }
  }

  const paymentMethod = request.paymentMethod;

  if (paymentMethod === "MOCK" && !pilotMockPaymentsEnabled()) {
    // A state conflict rather than a fault: the method is real, this deployment
    // simply is not a pilot one.
    throw conflict("Test payments are disabled for this environment.");
  }

  if (isExternal(paymentMethod)) {
    /*
      503 / `upstream_unavailable`, NOT 402 / `payment_required`.

      Both were on the table and the difference matters to the app. 402 means
      "the payment has not settled" — advice to go and pay, which is advice this
      client cannot act on: there is no session to enter, no redirect, no
      wallet sheet, because the flow that creates one does not exist. 503 says
      the payment provider is not reachable from this platform, which is what is
      actually true, and it is the status `/api/orders` already answers with, so
      the two surfaces refuse a card in exactly the same way.
    */
    throw upstreamUnavailable("Online payment is not enabled for this deployment.");
  }

  let created: { id: string; paymentMethod: PaymentMethod | null };
  try {
    created = await secureCreateOrder({
      userId,
      // B2C only. `assertGovernedB2BCheckout` refuses a B2B order that does not
      // carry an approved purchase order and its immutable governed terms, and
      // neither can originate from a phone — which is why the request schema
      // has no `type` field to send.
      type: "B2C",
      currency: request.currency,
      items: request.items,
      shippingAddress: request.shippingAddress,
      paymentMethod: paymentMethod as InternalMethod,
      notes: request.notes,
      couponCode: request.couponCode,
      idempotencyKey,
      requestFingerprint,
    });

    // Before the read, not after: the confirmation screen must show the order's
    // settled state, not the state it held for the millisecond between the two
    // writes. `/api/orders` answers from the pre-settlement row and is one
    // refresh behind for exactly that reason.
    await settleInternalPayment(created, userId);
  } catch (error) {
    asContractError(error);
  }

  const order = await readOrderDetail({ orderId: created.id, userId, origin });
  if (!order) {
    // The order was written a moment ago under this user id, so this is not a
    // reachable state; it is a fault, and it is reported as one.
    throw new V1Error("internal", "Something went wrong. Quote the request id.");
  }
  return { order, replayed: false };
}
