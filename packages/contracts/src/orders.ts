import { z } from "zod";

import {
  CurrencySchema,
  OrderStatusSchema,
  OrderTypeSchema,
  PaymentMethodSchema,
  PaymentStatusSchema,
  ShipmentStatusSchema,
} from "./enums";
import { IdSchema, ImageSchema, MoneySchema, SlugSchema, TimestampSchema, VatRatePercentSchema } from "./primitives";
import { CursorQuerySchema, pageEnvelope, successEnvelope } from "./envelope";
import { QuoteLineInputSchema, ShippingAddressInputSchema } from "./checkout";

/**
 * The totals ON A PLACED ORDER, which are NOT the same schema as a quote's.
 *
 * This is the one place the contract cannot promise what `composeOrderTotals`
 * computes, and it says so in the type rather than papering over it.
 * `composeOrderTotals` produces seven figures; the `Order` table has five
 * columns — subtotal, discountAmount, vatAmount, shippingAmount, total. The
 * split between `goodsVatAmount` and `shippingVatAmount` is computed at
 * checkout, used to build `vatAmount`, and then DISCARDED. Nothing persists it.
 *
 * So on this schema the two components are nullable, meaning "this order
 * predates the split being recorded", and the parse-time identity is
 * conditional: when both are present they must still sum to `vatAmount`. That
 * keeps a reconstructed pair honest without pretending a stored one exists.
 *
 * This is a real gap, not a contract preference: a tax authority asking which
 * part of the declared VAT was on freight cannot be answered from the database
 * today, and neither can a partial refund that returns the goods but not the
 * delivery. Adding `goodsVatAmount` and `shippingVatAmount` to `Order` would
 * let this schema become `OrderTotalsSchema` exactly. Flagged in the report.
 */
export const PersistedOrderTotalsSchema = z
  .object({
    subtotal: MoneySchema,
    discountAmount: MoneySchema,
    shippingAmount: MoneySchema,
    /** Declared tax: goods VAT plus delivery VAT. Always recorded. */
    vatAmount: MoneySchema,
    /** VAT on the goods. Null when the order predates the components being stored. */
    goodsVatAmount: MoneySchema.nullable(),
    /** VAT on the delivery. Null when the order predates the components being stored. */
    shippingVatAmount: MoneySchema.nullable(),
    total: MoneySchema,
  })
  .strict()
  .superRefine((totals, ctx) => {
    const { goodsVatAmount, shippingVatAmount } = totals;
    if (goodsVatAmount == null || shippingVatAmount == null) {
      // Both components must be absent together: one alone is a half-answer
      // that invites the reader to infer the other by subtraction and be wrong
      // whenever the stored vatAmount is the collapsed figure.
      if (goodsVatAmount != null || shippingVatAmount != null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["shippingVatAmount"],
          message: "goodsVatAmount and shippingVatAmount are recorded together or not at all",
        });
      }
      return;
    }
    if (Number((goodsVatAmount + shippingVatAmount).toFixed(2)) !== totals.vatAmount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["vatAmount"],
        message: "vatAmount must equal goodsVatAmount + shippingVatAmount",
      });
    }
  });

export const OrderItemSchema = z
  .object({
    id: IdSchema,
    productId: IdSchema,
    variantId: IdSchema.nullable(),
    sellerId: IdSchema,
    slug: SlugSchema.nullable(),
    sku: z.string().min(1).max(64),
    nameEn: z.string().min(1).max(200),
    nameAr: z.string().min(1).max(200),
    image: ImageSchema.nullable(),
    quantity: z.number().int().positive(),
    unitPrice: MoneySchema,
    vatRatePercent: VatRatePercentSchema,
    vatAmount: MoneySchema,
    total: MoneySchema,
    status: OrderStatusSchema,
  })
  .strict();

export const OrderStatusEventSchema = z
  .object({
    status: OrderStatusSchema,
    message: z.string().max(500).nullable(),
    occurredAt: TimestampSchema,
  })
  .strict();

export const ShipmentSchema = z
  .object({
    id: IdSchema,
    status: ShipmentStatusSchema,
    carrier: z.string().max(120).nullable(),
    trackingNumber: z.string().max(120).nullable(),
    trackingUrl: z.string().url().max(2048).nullable(),
    estimatedDelivery: TimestampSchema.nullable(),
  })
  .strict();

/**
 * THE LEAN ORDER CARD. `/api/orders` today returns every column of every order
 * with all of its items and a status-history row, unpaginated, for the whole
 * account. A list row draws a number, a date, a state and a price.
 */
export const OrderCardSchema = z
  .object({
    id: IdSchema,
    orderNumber: z.string().min(1).max(64),
    status: OrderStatusSchema,
    paymentStatus: PaymentStatusSchema,
    type: OrderTypeSchema,
    currency: CurrencySchema,
    total: MoneySchema,
    itemCount: z.number().int().positive(),
    /** One thumbnail for the row. Null when no item on the order has an image. */
    thumbnail: ImageSchema.nullable(),
    placedAt: TimestampSchema,
  })
  .strict();

export const OrderDetailSchema = z
  .object({
    id: IdSchema,
    orderNumber: z.string().min(1).max(64),
    status: OrderStatusSchema,
    paymentStatus: PaymentStatusSchema,
    paymentMethod: PaymentMethodSchema.nullable(),
    type: OrderTypeSchema,
    currency: CurrencySchema,
    totals: PersistedOrderTotalsSchema,
    items: z.array(OrderItemSchema).min(1).max(500),
    shippingAddress: ShippingAddressInputSchema,
    shipments: z.array(ShipmentSchema).max(50),
    statusHistory: z.array(OrderStatusEventSchema).max(200),
    notes: z.string().max(2000).nullable(),
    /** Signed URL for the tax invoice, when one has been issued. */
    vatInvoiceUrl: z.string().url().max(2048).nullable(),
    placedAt: TimestampSchema,
    updatedAt: TimestampSchema,
  })
  .strict();

export const OrderListQuerySchema = CursorQuerySchema.extend({
  status: OrderStatusSchema.optional(),
}).strict();

export const OrderListResponseSchema = pageEnvelope(OrderCardSchema);

export const OrderPathParamsSchema = z.object({ id: IdSchema }).strict();

export const OrderDetailResponseSchema = successEnvelope(OrderDetailSchema);

/**
 * POST /v1/orders — REQUEST.
 *
 * The client sends identity and quantity and NOTHING that costs money. Prices,
 * discounts, VAT and freight are resolved server-side, for the same reason
 * `/api/orders` resolves them: a shipping figure the client can influence is a
 * discount the client can grant itself. `items` and `shippingAddress` are the
 * same schemas `POST /v1/checkout/quote` takes, so the object the app was
 * quoted on is the object it orders with — byte for byte, which is also what
 * makes the idempotency fingerprint over the two agree.
 *
 * TWO FIELDS THE LEGACY ROUTE ACCEPTS ARE DELIBERATELY ABSENT, because on this
 * path they can only ever produce a refusal:
 *
 *   · `type` — `assertGovernedB2BCheckout` (checkout-invariants.ts) refuses
 *     `type: "B2B"` from generic checkout unconditionally: a B2B order must
 *     carry an approved purchase order AND its immutable governed terms, and
 *     neither can come from a phone. So this endpoint places B2C orders, and
 *     the field would be a switch with one working position.
 *   · `purchaseOrderId` — `assertGenericCheckoutHasNoPurchaseOrder` refuses it
 *     outright; approved POs are placed by `placeGovernedPurchaseOrder`, which
 *     has no v1 endpoint. Accepting the field would let the app offer a button
 *     whose only outcome is a 409 it cannot act on.
 *
 * A client that sends either gets `validation_failed` naming the field, which
 * says "this surface does not do that" — rather than a business conflict, which
 * says "try again differently" when there is no differently.
 */
export const PlaceOrderRequestSchema = z
  .object({
    items: z.array(QuoteLineInputSchema).min(1).max(500),
    shippingAddress: ShippingAddressInputSchema,
    paymentMethod: PaymentMethodSchema,
    /** Required, never defaulted: a defaulted currency prices an order the buyer never chose. */
    currency: CurrencySchema,
    couponCode: z
      .string()
      .trim()
      .min(3)
      .max(40)
      .regex(/^[A-Za-z0-9_-]+$/)
      .optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .strict();

export type PlaceOrderRequest = z.infer<typeof PlaceOrderRequestSchema>;

/**
 * The `Idempotency-Key` request header.
 *
 * A header rather than a body field, matching `/api/orders`, and for a reason
 * the body could not serve: the key must survive a RETRY OF THE SAME REQUEST
 * unchanged, and a value inside the payload is one a client is tempted to
 * regenerate along with the payload. `Order.idempotencyKey` is unique per user,
 * so a replay returns the original order instead of creating a second one — the
 * single most important property on this endpoint, because the request that
 * times out is exactly the one a phone on a warehouse connection will send
 * twice.
 *
 * 128 characters is the column's practical bound and the same cap the existing
 * route enforces.
 */
export const IdempotencyKeySchema = z.string().trim().min(1).max(128);

export const PlaceOrderHeadersSchema = z
  .object({ "idempotency-key": IdempotencyKeySchema.optional() })
  .strict();

/**
 * POST /v1/orders — RESPONSE.
 *
 * The whole order, through the same projection `GET /v1/orders/{id}` uses, so
 * the confirmation screen needs no second call and cannot disagree with the
 * order screen it becomes.
 *
 * `replayed` is the legacy route's `idempotent: true` signal, moved INSIDE the
 * payload. It cannot be a sibling of `data`: the success envelope is `.strict()`
 * and admits only `data` and `meta`, which is exactly the drift that let
 * `/api/products` grow `{ success, products, page, limit, total, totalPages }`
 * around its payload. The app uses it to avoid celebrating the same order twice
 * when a retry succeeds.
 */
export const PlacedOrderSchema = z
  .object({
    order: OrderDetailSchema,
    /** True when this response replays an order the same Idempotency-Key already created. */
    replayed: z.boolean(),
  })
  .strict();

export const PlaceOrderResponseSchema = successEnvelope(PlacedOrderSchema);
