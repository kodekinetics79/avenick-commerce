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
import { ShippingAddressInputSchema } from "./checkout";

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
