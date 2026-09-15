import { z } from "zod";

import { ChannelSchema, CountrySchema, CurrencySchema } from "./enums";
import { IdSchema, MoneySchema, TimestampSchema, VatRatePercentSchema } from "./primitives";
import { successEnvelope } from "./envelope";

/**
 * The order's ship-to address, exactly the four fields `/api/orders` requires
 * and with its bounds. A quote that priced delivery against a richer address
 * than checkout accepts would quote freight for a destination the order could
 * not be placed to.
 */
export const ShippingAddressInputSchema = z
  .object({
    label: z.string().trim().min(1).max(80),
    line1: z.string().trim().min(3).max(240),
    line2: z.string().trim().max(240).optional(),
    city: z.string().trim().min(1).max(120),
    country: CountrySchema,
    postalCode: z.string().trim().max(20).optional(),
  })
  .strict();

export const QuoteLineInputSchema = z
  .object({
    productId: IdSchema,
    variantId: IdSchema.optional(),
    quantity: z.number().int().positive().max(100_000),
  })
  .strict();

/**
 * POST /v1/checkout/quote — request.
 *
 * `items` is required and explicit even though the server holds a cart: a
 * quote the buyer is shown must be a quote for the lines the buyer can see,
 * and a server-side cart that changed between render and quote would otherwise
 * price something the screen never displayed. `cartId` travels alongside so
 * the server can refuse a quote against a cart that has moved on.
 *
 * Prices, discounts, VAT and freight are NOT accepted from the client. They
 * are resolved server-side, for the same reason `/api/orders` resolves them:
 * a shipping figure the client can influence is a discount the client can
 * grant itself.
 */
export const CheckoutQuoteRequestSchema = z
  .object({
    cartId: IdSchema.optional(),
    items: z.array(QuoteLineInputSchema).min(1).max(500),
    shippingAddress: ShippingAddressInputSchema,
    /** Required, never defaulted: a defaulted currency prices an order the buyer never chose. */
    currency: CurrencySchema,
    channel: ChannelSchema.default("B2C"),
    couponCode: z
      .string()
      .trim()
      .min(3)
      .max(40)
      .regex(/^[A-Za-z0-9_-]+$/)
      .optional(),
  })
  .strict();

export type CheckoutQuoteRequest = z.infer<typeof CheckoutQuoteRequestSchema>;

/**
 * THE ORDER TOTALS. This mirrors `OrderTotals` in
 * `packages/database/src/services/checkout-invariants.ts`, field for field.
 *
 * The seven fields are all REQUIRED and the object is `.strict()`, which is
 * the entire point of this schema. PR #21 fixed a defect where VAT was charged
 * on the goods and not on the delivery: the total was
 * `goods + goodsVat + shipping`, which adds freight AFTER tax. Every figure on
 * the order agreed with every other, the buyer was undercharged, and the
 * understated `vatAmount` was persisted for invoicing and settlement to read —
 * a silent wrong answer that scaled with the freight bill.
 *
 * A contract with a single `vatAmount` field would let that defect back in
 * without anything failing, because a collapsed VAT figure is indistinguishable
 * from a correct one at the type level. So the two components are separate,
 * neither is optional, neither is nullable, and the identities below are
 * enforced at parse time rather than documented in prose:
 *
 *   vatAmount === goodsVatAmount + shippingVatAmount
 *   total     === subtotal - discountAmount + goodsVatAmount
 *                          + shippingAmount + shippingVatAmount
 *
 * A zero-rated jurisdiction needs no special case: QA and KW carry rate 0, so
 * `shippingVatAmount` is 0 and both identities still hold. That is different
 * from the field being absent, and this schema keeps the difference.
 *
 * The comparisons are exact rather than epsilon-based on purpose. Every input
 * is already rounded to two places by the server's `money()` helper before it
 * is summed, so the sum of the rounded parts is exact in binary floating point
 * at these magnitudes; an epsilon here would forgive precisely the drift the
 * schema exists to catch. The one place rounding could bite — the final
 * `total`, rounded once from already-rounded parts — is compared through the
 * same `toFixed(2)` the server applies.
 */
const roundMoney = (value: number) => Number(value.toFixed(2));

export const OrderTotalsSchema = z
  .object({
    /** Goods, net of VAT, before discount. */
    subtotal: MoneySchema,
    discountAmount: MoneySchema,
    /** VAT on the goods, after discount. */
    goodsVatAmount: MoneySchema,
    /** Delivery, net of VAT. */
    shippingAmount: MoneySchema,
    /** VAT on the delivery, at the order's place-of-supply rate. */
    shippingVatAmount: MoneySchema,
    /** What the invoice declares as tax: goods VAT plus delivery VAT. */
    vatAmount: MoneySchema,
    total: MoneySchema,
  })
  .strict()
  .superRefine((totals, ctx) => {
    if (roundMoney(totals.goodsVatAmount + totals.shippingVatAmount) !== totals.vatAmount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["vatAmount"],
        message: "vatAmount must equal goodsVatAmount + shippingVatAmount — declared tax is both components, never only the goods",
      });
    }
    const expectedTotal = roundMoney(
      totals.subtotal - totals.discountAmount + totals.goodsVatAmount + totals.shippingAmount + totals.shippingVatAmount,
    );
    if (expectedTotal !== totals.total) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["total"],
        message: "total must equal subtotal - discountAmount + goodsVatAmount + shippingAmount + shippingVatAmount",
      });
    }
  });

export type OrderTotals = z.infer<typeof OrderTotalsSchema>;

/** The goods half of an order — what a governed PO snapshot approves. */
export const merchandiseTotalOf = (totals: OrderTotals): number =>
  roundMoney(totals.subtotal - totals.discountAmount + totals.goodsVatAmount);

/**
 * One priced line of the quote. `unitPrice` is the tier the server resolved
 * for THIS quantity, which is why the app must not reprice a tiered line
 * locally — see `priceTiered` on the cart line.
 */
export const QuoteLineSchema = z
  .object({
    productId: IdSchema,
    variantId: IdSchema.nullable(),
    sellerId: IdSchema,
    sku: z.string().min(1).max(64),
    nameEn: z.string().min(1).max(200),
    nameAr: z.string().min(1).max(200),
    quantity: z.number().int().positive().max(100_000),
    unitPrice: MoneySchema,
    /** Per-line VAT rate as a percentage. A seller may configure this per product. */
    vatRatePercent: VatRatePercentSchema,
    vatAmount: MoneySchema,
    lineTotal: MoneySchema,
  })
  .strict();

/**
 * How delivery was priced.
 *
 * `status` distinguishes the three real answers `secureCreateOrder` already
 * gives, which a bare `shippingAmount: 0` cannot: no zones are configured at
 * all (freight is genuinely zero and the order proceeds), a zone covers the
 * destination (a real price), or zones exist and none covers it (the order
 * will be REFUSED). An app that cannot tell the first from the third shows a
 * free-delivery badge on an order that is about to be rejected.
 */
export const ShippingQuoteSchema = z
  .object({
    status: z.enum(["priced", "unpriced_no_zones", "unavailable"]),
    zoneName: z.string().max(120).nullable(),
    amount: MoneySchema,
    /** Place-of-supply rate applied to the delivery. Percentage: 5 means 5%. */
    vatRatePercent: VatRatePercentSchema,
    estimatedDaysMin: z.number().int().min(0).max(365).nullable(),
    estimatedDaysMax: z.number().int().min(0).max(365).nullable(),
  })
  .strict();

export const AppliedPromotionSchema = z
  .object({
    promotionId: IdSchema,
    couponCode: z.string().max(40).nullable(),
    label: z.string().max(200),
    discountAmount: MoneySchema,
  })
  .strict();

/**
 * POST /v1/checkout/quote — response payload.
 *
 * `vatRatePercent` is the ORDER's place-of-supply rate, the one the delivery
 * is taxed at. It is stated separately from the per-line rates because the
 * delivery is a supply by the platform to the buyer and follows the order's
 * place of supply, not whatever rate a seller configured on a product.
 */
export const CheckoutQuoteSchema = z
  .object({
    quoteId: IdSchema,
    currency: CurrencySchema,
    channel: ChannelSchema,
    /** The order's place-of-supply VAT rate, as a percentage (5 means 5%). */
    vatRatePercent: VatRatePercentSchema,
    lines: z.array(QuoteLineSchema).min(1).max(500),
    shipping: ShippingQuoteSchema,
    promotions: z.array(AppliedPromotionSchema),
    totals: OrderTotalsSchema,
    /**
     * When this quote stops being the price. Prices, stock and promotions all
     * move; a quote with no expiry invites the app to show a stale total.
     */
    expiresAt: TimestampSchema,
  })
  .strict();

export type CheckoutQuote = z.infer<typeof CheckoutQuoteSchema>;

export const CheckoutQuoteResponseSchema = successEnvelope(CheckoutQuoteSchema);
