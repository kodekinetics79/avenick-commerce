import type { Channel, CheckoutQuoteRequest, Currency } from "@avenick/contracts";
import { assertMinimumOrderQuantity, resolveUnitPrice, type PriceTierRow } from "@avenick/database";

import { conflict, notFound, validationFailed } from "../../_lib/errors";

/**
 * Pricing the GOODS half of a quote, line by line, exactly the way
 * `createOrder` prices them.
 *
 * Everything here is a mirror of the loop inside `createOrder`'s transaction
 * (`packages/database/src/services/orders.ts`, from the `pricedLines` map
 * onwards). Where a rule could be shared it IS shared —
 * `assertMinimumOrderQuantity` and `resolveUnitPrice` are imported, not
 * re-derived, and `resolveUnitPrice` was moved into `checkout-invariants.ts`
 * for precisely this reason.
 *
 * What could NOT be shared is the loop itself: it lives inside
 * `db.$transaction`, interleaved with advisory locks and stock reservation, and
 * there is no seam to call it from outside an order. So the two per-line money
 * expressions below are reproduced, and `checkout-quote-arithmetic.regression.test.ts`
 * asserts that the expressions in `orders.ts` still read the way these do. See
 * the report accompanying this change: extracting the loop is the real fix and
 * it belongs in the order path, not in a route.
 *
 * The one thing this file must never do is invent arithmetic of its own. The
 * ORDER-level totals are assembled by `composeOrderTotals` and nothing else.
 */

const money = (value: number) => Number(value.toFixed(2));

/** Prisma hands money back as Decimal; tests and fixtures hand it back as a number. */
type Decimalish = { toString(): string } | number;

/**
 * One published price band, as the SHARED tier selector reads it. Aliased from
 * `@avenick/database` rather than restated: a second declaration of this shape
 * is the first step towards a second selection rule.
 */
export type PriceRow = PriceTierRow;

/** One requested line, as the contract states it. */
type QuoteLineInput = CheckoutQuoteRequest["items"][number];

export interface QuotableVariant {
  id: string;
  sku: string;
  nameEn: string;
  nameAr: string | null;
  isActive: boolean;
  prices: PriceRow[];
}

export interface QuotableProduct {
  id: string;
  sellerId: string;
  categoryId: string;
  brandId: string | null;
  status: string;
  sku: string;
  nameEn: string;
  nameAr: string;
  moq: number;
  weight: Decimalish | null;
  isB2CEnabled: boolean;
  isB2BEnabled: boolean;
  seller: { status: string; deletedAt: Date | null };
  prices: PriceRow[];
  variants: QuotableVariant[];
}

export interface PricedQuoteLine {
  /** Stable key for allocating promotion discounts, as `createOrder` keys them. */
  key: string;
  productId: string;
  variantId: string | null;
  sellerId: string;
  /** Carried because promotion scoping reads them, exactly as `createOrder` does. */
  categoryId: string;
  brandId: string | null;
  sku: string;
  nameEn: string;
  nameAr: string;
  quantity: number;
  unitPrice: number;
  /** quantity x unitPrice, net of VAT and before any discount. */
  lineSubtotal: number;
  /** Unit weight in kg, or null when the catalogue records none. */
  weightKg: number | null;
}

/**
 * Contract bounds on display text are tighter than the columns behind them:
 * `nameEn`/`nameAr` are unbounded `String` in Postgres and 200 characters in
 * `QuoteLineSchema`. A name over the bound is a rendering detail; failing the
 * whole quote over one would stop a buyer checking out because a seller wrote
 * a long title. The SKU is deliberately NOT clamped — it is line identity, and
 * a silently shortened SKU is a different SKU.
 */
function display(primary: string | null | undefined, fallback: string): string {
  const value = (primary ?? "").trim() || fallback.trim();
  return value.slice(0, 200);
}

function toNumber(value: Decimalish): number {
  return typeof value === "number" ? value : Number(value.toString());
}

/**
 * Resolve every requested line against the catalogue, or refuse.
 *
 * The refusals are mapped onto the contract's codes rather than the bare
 * `Error`s `createOrder` throws, because a phone has to tell "this product no
 * longer exists" (remove the line) from "you must pick a variant" (a fixable
 * input) from "we are out of stock" (come back later). `createOrder` answers
 * all three with a string.
 */
export function priceQuoteLines(input: {
  items: readonly QuoteLineInput[];
  products: ReadonlyMap<string, QuotableProduct>;
  channel: Channel;
  currency: Currency;
}): PricedQuoteLine[] {
  return input.items.map((item, index) => {
    const product = input.products.get(item.productId);
    if (!product) throw notFound(`Product ${item.productId} is no longer available.`);
    if (product.status !== "ACTIVE") throw conflict(`"${product.nameEn}" is no longer available.`);
    if (product.seller.status !== "ACTIVE" || product.seller.deletedAt) {
      throw conflict(`The seller of "${product.nameEn}" is not currently trading.`);
    }
    if (input.channel === "B2B" && !product.isB2BEnabled) {
      throw conflict(`"${product.nameEn}" is not available for business ordering.`);
    }
    if (input.channel === "B2C" && !product.isB2CEnabled) {
      throw conflict(`"${product.nameEn}" is not available for consumer ordering.`);
    }

    try {
      assertMinimumOrderQuantity(product.nameEn, item.quantity, product.moq);
    } catch (error) {
      throw validationFailed(error instanceof Error ? error.message : "Quantity is below the minimum.", {
        [`items.${index}.quantity`]: [
          `Minimum order quantity for "${product.nameEn}" is ${Math.max(1, product.moq)}.`,
        ],
      });
    }

    const activeVariants = product.variants.filter((candidate) => candidate.isActive);
    if (!item.variantId && activeVariants.length > 0) {
      throw validationFailed(`Select a variant for "${product.nameEn}".`, {
        [`items.${index}.variantId`]: [`"${product.nameEn}" is sold by variant; choose one.`],
      });
    }
    const variant = item.variantId
      ? activeVariants.find((candidate) => candidate.id === item.variantId)
      : undefined;
    if (item.variantId && !variant) {
      throw conflict(`The selected variant of "${product.nameEn}" is no longer available.`);
    }

    // Variant price list first, product price list second — the same
    // precedence, and the same tier-selection function, the order uses.
    const variantTier = variant
      ? resolveUnitPrice(variant.prices, input.channel, input.currency, item.quantity)
      : null;
    const tier =
      variantTier ?? resolveUnitPrice(product.prices, input.channel, input.currency, item.quantity);
    if (!tier) {
      throw conflict(
        `"${product.nameEn}" has no published ${input.channel} price in ${input.currency} for a quantity of ${item.quantity}.`,
      );
    }

    const unitPrice = toNumber(tier.price);
    return {
      key: `line-${index}`,
      productId: item.productId,
      variantId: item.variantId ?? null,
      sellerId: product.sellerId,
      categoryId: product.categoryId,
      brandId: product.brandId,
      sku: variant?.sku ?? product.sku,
      nameEn: display(variant?.nameEn ?? product.nameEn, product.nameEn),
      nameAr: display(variant?.nameAr ?? product.nameAr, product.nameEn),
      quantity: item.quantity,
      unitPrice,
      // Mirrors orders.ts: `lineSubtotal: money(unitPrice * item.quantity)`.
      lineSubtotal: money(unitPrice * item.quantity),
      weightKg: product.weight == null ? null : toNumber(product.weight),
    };
  });
}

export interface GoodsTotals {
  /** Goods, net of VAT, BEFORE discount — what the free-delivery threshold reads. */
  subtotal: number;
  /** VAT on the goods, after discount. Freight VAT is added by composeOrderTotals. */
  goodsVatAmount: number;
  lines: Array<{
    productId: string;
    variantId: string | null;
    sellerId: string;
    sku: string;
    nameEn: string;
    nameAr: string;
    quantity: number;
    unitPrice: number;
    vatRatePercent: number;
    vatAmount: number;
    lineTotal: number;
  }>;
}

/**
 * Apply the promotion allocation and compute goods VAT, line by line.
 *
 * `vatRatePercent` is the jurisdiction's statutory rate for EVERY line, not
 * `ProductPrice.vatRate`. That is what `createOrder` charges, and its comment
 * explains why: the price row's rate is data a seller or an importer typed,
 * and consulting it to decide tax is the two-sources-of-truth defect the order
 * path now guards against. A quote that used the seller's number would show a
 * tax figure the invoice then contradicts.
 */
export function composeGoodsTotals(input: {
  lines: readonly PricedQuoteLine[];
  lineDiscounts: Readonly<Record<string, number>>;
  vatRatePercent: number;
}): GoodsTotals {
  let subtotal = 0;
  let vatTotal = 0;
  const lines = input.lines.map((line) => {
    const lineDiscount = Math.min(input.lineDiscounts[line.key] ?? 0, line.lineSubtotal);
    const discountedSubtotal = money(line.lineSubtotal - lineDiscount);
    // Mirrors orders.ts: `money(discountedSubtotal * (line.vatRate / 100))`.
    const vatAmount = money(discountedSubtotal * (input.vatRatePercent / 100));
    subtotal += line.lineSubtotal;
    vatTotal += vatAmount;
    return {
      productId: line.productId,
      variantId: line.variantId,
      sellerId: line.sellerId,
      sku: line.sku,
      nameEn: line.nameEn,
      nameAr: line.nameAr,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      vatRatePercent: input.vatRatePercent,
      vatAmount,
      lineTotal: money(discountedSubtotal + vatAmount),
    };
  });
  return { subtotal: money(subtotal), goodsVatAmount: money(vatTotal), lines };
}
