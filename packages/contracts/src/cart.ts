import { z } from "zod";

import { AvailabilitySchema, ChannelSchema, CurrencySchema } from "./enums";
import { IdSchema, ImageSchema, MoneySchema, SlugSchema, TimestampSchema, VatRatePercentSchema } from "./primitives";
import { successEnvelope } from "./envelope";

/**
 * The server cart, which must absorb the client cart in
 * `apps/customer/src/stores/cart.ts` without losing anything the web store
 * relies on — `moq`, `priceTiered`, `channel`, `sellerId` and the per-line
 * currency all have consequences, and a line that arrives without them cannot
 * be repriced or even stepped correctly.
 *
 * NOTE FOR THE BACKEND: `CartItem` stores `qty` and a single Decimal column
 * literally named `priceAED`, with no currency, no channel, no MOQ and no
 * tier flag — while `Cart` carries a `currency` that `priceAED` contradicts by
 * name. See the report accompanying this package.
 */

/** The quantity ceiling the web cart's stepper enforces (`CART_QTY_MAX`). */
export const CART_QTY_MAX = 9999;

export const CartLineSchema = z
  .object({
    /** Line identity, stable across quantity edits. Not the product id. */
    id: IdSchema,
    productId: IdSchema,
    variantId: IdSchema.nullable(),
    sellerId: IdSchema,
    slug: SlugSchema,
    sku: z.string().min(1).max(64),
    nameEn: z.string().min(1).max(200),
    nameAr: z.string().min(1).max(200),
    /** The primary image, described. Null when the seller uploaded none. */
    image: ImageSchema.nullable(),
    channel: ChannelSchema,
    qty: z.number().int().positive().max(CART_QTY_MAX),
    /** Minimum order quantity. The stepper's floor, so it travels with the line. */
    moq: z.number().int().positive(),
    unitPrice: MoneySchema,
    currency: CurrencySchema,
    vatRatePercent: VatRatePercentSchema,
    /**
     * True when this product publishes more than one price band in this
     * currency, so a different quantity may resolve to a different unit price.
     * The app must send such a line's quantity change back through the server
     * rather than editing it locally: keeping the old tier's price against a
     * quantity that no longer qualifies is a total the server never charges.
     */
    priceTiered: z.boolean(),
    availability: AvailabilitySchema,
    /**
     * Can this line be ORDERED in `channel`? See `ProductCard.sellableInChannel`
     * for the full argument; the short version is that `channel` says which
     * price list the figures came from and this says whether checkout will
     * accept the line at all. The pilot catalogue is priced in B2C and sellable
     * to nobody, so the two disagree for every production row.
     *
     * A cart is where the difference bites hardest: a line that cannot be
     * ordered must not sit under a Checkout button, and the app should not have
     * to place the order to find out. `secureCreateOrder` refuses it, so the
     * only question is whether the buyer learns before or after they try.
     */
    sellableInChannel: z.boolean(),
    /** qty x unitPrice, net of VAT. Convenience only — the quote is authoritative. */
    lineTotal: MoneySchema,
  })
  .strict();

export type CartLine = z.infer<typeof CartLineSchema>;

/**
 * The cart.
 *
 * It reports `subtotal` — goods, net of VAT — and NOTHING ELSE about money.
 * There is deliberately no `vatAmount` and no `total` here: VAT depends on the
 * ship-to country and the delivery has its own VAT, neither of which the cart
 * knows. A cart that printed a total would print a different number from the
 * one checkout charges, which is the shape of the defect PR #21 fixed.
 * `POST /v1/checkout/quote` is the only endpoint that states a total.
 */
export const CartSchema = z
  .object({
    id: IdSchema,
    currency: CurrencySchema,
    lines: z.array(CartLineSchema).max(500),
    /** Sum of the line quantities, for the tab badge. */
    itemCount: z.number().int().min(0),
    /** Goods, net of VAT, before discount. Not a total. */
    subtotal: MoneySchema,
    updatedAt: TimestampSchema,
  })
  .strict();

export type Cart = z.infer<typeof CartSchema>;

export const CartResponseSchema = successEnvelope(CartSchema);

/** POST /v1/cart/items — add. The server resolves price, MOQ and tier. */
export const AddCartItemRequestSchema = z
  .object({
    productId: IdSchema,
    variantId: IdSchema.optional(),
    qty: z.number().int().positive().max(CART_QTY_MAX),
    channel: ChannelSchema.default("B2C"),
  })
  .strict();

/**
 * PATCH /v1/cart/items/{id} — set quantity in place.
 *
 * Quantity is the only mutable property of a line. Price, channel and variant
 * are not editable here by design: changing a variant is a different line, and
 * a client-settable price is a discount the client grants itself.
 */
export const UpdateCartItemRequestSchema = z
  .object({
    qty: z.number().int().positive().max(CART_QTY_MAX),
  })
  .strict();

export const CartItemPathParamsSchema = z.object({ id: IdSchema }).strict();

/**
 * POST /v1/cart/merge — fold the device's offline cart into the account's.
 *
 * The app accumulates lines while signed out (the web store persists to local
 * storage the same way), and they must survive sign-in. Only identity and
 * quantity are accepted; every price is re-resolved, because a line that has
 * sat on a phone for a week carries a price that may no longer exist.
 */
export const CartMergeLineSchema = z
  .object({
    productId: IdSchema,
    variantId: IdSchema.optional(),
    qty: z.number().int().positive().max(CART_QTY_MAX),
    channel: ChannelSchema.default("B2C"),
  })
  .strict();

export const CartMergeRequestSchema = z
  .object({
    /**
     * `sum` adds the offline quantity to any matching server line; `replace`
     * takes the offline quantity as the truth. Required rather than defaulted,
     * because the two produce different carts and silently picking one is how
     * a buyer ends up with twice what they meant to order.
     */
    strategy: z.enum(["sum", "replace"]),
    lines: z.array(CartMergeLineSchema).min(1).max(500),
  })
  .strict();

/**
 * What a merge could not take, and why. A merge that silently drops a
 * delisted product returns a cart the buyer believes is complete.
 */
export const CartMergeRejectionSchema = z
  .object({
    productId: IdSchema,
    variantId: IdSchema.nullable(),
    reason: z.enum([
      "product_not_found",
      "product_unavailable",
      "variant_not_found",
      "channel_not_enabled",
      "currency_not_priced",
      "below_moq",
      "insufficient_stock",
      "quantity_limit",
    ]),
    /** The quantity the server settled on, when it clamped rather than refused. */
    acceptedQty: z.number().int().min(0).nullable(),
  })
  .strict();

export const CartMergeResultSchema = z
  .object({
    cart: CartSchema,
    rejected: z.array(CartMergeRejectionSchema),
  })
  .strict();

export const CartMergeResponseSchema = successEnvelope(CartMergeResultSchema);
