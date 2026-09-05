/*
 * NO "use client" HERE, deliberately. These are pure helpers over the row shape
 * the recommendation slots take, usable from a server page that shapes rows as
 * well as from the client components that render them.
 */
import { formatCurrency } from "@avenick/utils";
import type { ProductCardPriceBand } from "@/components/products/product-card";
import type { CardRow } from "@/lib/product-card-row";
import type { Currency } from "@/lib/market-context";
import { productCardPurchaseAction, storefrontProductHref } from "@/lib/product-card-commerce";
import type { CartItem } from "@/stores/cart";

/**
 * THE PROP CONTRACT for both recommendation slots.
 *
 * It is `CardRow` — the one mapping from a catalogue DTO to card props, which
 * `toCardRow` in lib/product-card-row.ts produces from the shape
 * `toCatalogListDto` emits — plus the B2B quantity bands the tile grids build
 * with `publishedBands`. `getCartCompletions(productIds)` returns
 * `ProductListRow[]`; the route or server page that calls it runs each row
 * through `toCatalogListDto(row, channel, currency)` and then `toCardRow(dto,
 * locale)`, exactly as /api/products/[slug]/recommendations already does, and
 * hands the result here. Nothing in this directory imports that service.
 */
export type CartCompletionRow = CardRow & { priceBands?: ProductCardPriceBand[] };

/**
 * An async provider of rows for the current cart. It MUST be a stable
 * reference (module-level function), because the drawer keys its fetch effect
 * on it; an inline lambda would refetch on every render. It is expected to
 * fetch an API route — never to import the database service into the client.
 */
export type CartCompletionsLoader = (productIds: string[]) => Promise<CartCompletionRow[]>;

/**
 * The rows worth showing: not already in the cart, and each product once.
 * A "you might also need" that suggests the thing you just added is not a
 * recommendation, it is a bug with a heading.
 */
export function completionsNotInCart<T extends { id: string }>(
  rows: readonly T[],
  items: readonly Pick<CartItem, "productId">[],
): T[] {
  const inCart = new Set(items.map((item) => item.productId));
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (inCart.has(row.id) || seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

export const rfqHref = (sellerId: string, productId: string) =>
  `/b2b/rfq/new?supplier=${encodeURIComponent(sellerId)}&product=${encodeURIComponent(productId)}`;

export type CompletionAction =
  | { kind: "ADD_TO_CART" }
  | { kind: "SELECT_VARIANT"; href: string }
  | { kind: "REQUEST_AVAILABILITY"; href: string }
  | { kind: "REQUEST_QUOTE"; href: string };

/**
 * What a recommendation row's one control does — the SAME decision the
 * product card makes, in the same order, so a row in the drawer and the tile
 * in the grid never disagree about a product:
 *
 *   out of stock            → request availability (RFQ), never the cart
 *   variants                → the product page, where a real selection is made
 *   no price in this channel → request a quote (RFQ). This catalogue is quoted,
 *                              not carted, for most of its listings, and the
 *                              quote path routes to the RFQ form — never into
 *                              the drawer with an invented figure.
 *   otherwise               → an authoritative cart line at MOQ
 */
export function completionAction(row: CartCompletionRow, channel: "B2C" | "B2B"): CompletionAction {
  const action = productCardPurchaseAction(row.hasVariants, row.inStock);
  if (action === "REQUEST_AVAILABILITY") return { kind: "REQUEST_AVAILABILITY", href: rfqHref(row.sellerId, row.id) };
  if (action === "SELECT_VARIANT") {
    return { kind: "SELECT_VARIANT", href: storefrontProductHref(row.slug, { currency: row.currency, b2b: channel === "B2B" }) };
  }
  if (row.price == null || !row.currency || row.vatRate == null) return { kind: "REQUEST_QUOTE", href: rfqHref(row.sellerId, row.id) };
  return { kind: "ADD_TO_CART" };
}

/**
 * The cart line a row adds — field for field what the product card's own
 * handler writes, so a line added from a recommendation is indistinguishable
 * from one added from the grid: MOQ as the opening quantity, the VAT rate and
 * `priceTiered` carried so the cart knows whether it may edit the quantity in
 * place. Null when the row has no price, which `completionAction` has already
 * routed to the RFQ form.
 */
export function cartLineFromCompletion(row: CartCompletionRow, channel: "B2C" | "B2B"): Omit<CartItem, "id"> | null {
  if (row.price == null || !row.currency || row.vatRate == null) return null;
  const moq = Number.isInteger(row.moq) && (row.moq as number) > 0 ? (row.moq as number) : 1;
  return {
    productId: row.id,
    slug: row.slug,
    channel,
    nameEn: row.nameEn,
    nameAr: row.nameAr,
    imageUrl: row.imageUrl,
    sku: row.sku,
    qty: moq,
    moq,
    unitPrice: row.price,
    vatRate: row.vatRate,
    priceTiered: row.priceTiered,
    sellerId: row.sellerId,
    currency: row.currency,
  };
}

/** The line's own name, in the reader's language — the cart page's rule. */
export const cartLineName = (item: Pick<CartItem, "nameEn" | "nameAr">, locale: string) =>
  locale === "ar" ? item.nameAr || item.nameEn : item.nameEn || item.nameAr;

/**
 * The quantity ladder for a line, from the bands the supplier published — the
 * product card's own construction, including the U+200E LEFT-TO-RIGHT MARK on
 * each band label: "50+" is a numeric run with a neutral at its edge, and in
 * Arabic an unmarked one renders as "+50".
 */
export function ladderTiersFrom(
  bands: readonly ProductCardPriceBand[] | null | undefined,
  currency: string | undefined,
  locale: "en" | "ar",
) {
  if (!currency || !bands || bands.length < 2) return [];
  return [...bands]
    .sort((a, b) => a.minQty - b.minQty)
    .map((band) => ({
      from: band.minQty,
      to: band.maxQty,
      band: band.maxQty == null ? `‎${band.minQty}+` : `‎${band.minQty}–${band.maxQty}`,
      price: formatCurrency(band.amount, currency as Currency, locale),
    }));
}
