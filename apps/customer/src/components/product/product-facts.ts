import type * as React from "react";
import { formatCurrency } from "@avenick/utils";
import { resolveStorefrontSelection, type StorefrontProduct } from "@/lib/catalog-commercial";
import type { Currency } from "@/lib/market-context";
import { productCardPurchaseAction } from "@/lib/product-card-commerce";

/**
 * The facts the product detail page is built out of, kept in a module with NO
 * "use client" directive.
 *
 * Law 9: Next replaces a client module's exports with references in the server
 * graph, so a helper exported from a "use client" file fails the production
 * build the moment a server component calls it. Every styling helper and every
 * derivation on this surface therefore lives here, where either graph can reach
 * it.
 */

/**
 * Attribute keys are stored as the supplier typed them — "colorFamily",
 * "shelf_life". There is no enum→label map for a free-form attribute, so the
 * only safe thing to do is separate the words and capitalise the first. This is
 * presentation only: it never touches the value, and an unknown key still
 * renders whatever the supplier recorded.
 */
export function attributeLabel(key: string): string {
  const spaced = key.replace(/[_-]+/g, " ").replace(/([a-z\d])([A-Z])/g, "$1 $2").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * <Num> renders the currency mark at half the figure's size, which is what stops
 * a 46px price reading as the CODE shouted at the buyer. formatCurrency remains
 * the only thing deciding digits, grouping, decimals and mark placement per
 * currency and per locale — this only splits a leading Latin code back off, and
 * hands the whole string through unchanged if the output does not have that
 * shape. In Arabic the mark trails the figure, so the whole string is returned
 * and <Num> prints it as one run, which is correct.
 */
export function splitMoney(amount: number, currency: Currency, locale: "en" | "ar"): { code?: string; figure: string } {
  const formatted = formatCurrency(amount, currency, locale);
  const prefix = `${currency} `;
  return formatted.startsWith(prefix) ? { code: currency, figure: formatted.slice(prefix.length) } : { figure: formatted };
}

export type PriceBand = {
  minQty: number;
  /** Exclusive upper bound — the next band's start — or null for the top band. */
  nextQty: number | null;
  unitPrice: number;
};

/**
 * The volume ladder, derived by ASKING THE RESOLVER what a buyer would pay at
 * each published quantity break — never by re-reading the price rows here.
 * Re-implementing the tier rule on the page is exactly how a displayed ladder
 * drifts away from the price the cart actually charges; calling the same
 * function the cart calls cannot drift. Breaks that resolve to the same unit
 * price are one band to a buyer, so they are collapsed.
 */
export function buildPriceLadder(
  product: StorefrontProduct,
  variantId: string | undefined,
  currency: string,
  moq: number,
): PriceBand[] {
  const variant = variantId ? product.variants.find((candidate) => candidate.id === variantId) : undefined;
  const ladder: PriceBand[] = [];
  const breaks = Array.from(new Set(
    [...(variant?.prices ?? []), ...product.prices]
      .filter((price) => price.currency === currency)
      .map((price) => Math.max(price.minQty, moq)),
  )).sort((a, b) => a - b);

  for (const breakQty of breaks) {
    const atBreak = resolveStorefrontSelection(product, variantId, breakQty, currency);
    if (!atBreak || atBreak.currency !== currency) continue;
    const previous = ladder[ladder.length - 1];
    if (previous && previous.unitPrice === atBreak.unitPrice) continue;
    ladder.push({ minQty: breakQty, nextQty: null, unitPrice: atBreak.unitPrice });
  }
  for (let i = 0; i < ladder.length - 1; i++) ladder[i].nextQty = ladder[i + 1].minQty;
  return ladder;
}

/**
 * The first band ABOVE the buyer's current quantity, if there is one and it is
 * cheaper per unit. This is the one piece of merchandising on the page that is
 * not a claim: the bands are the supplier's own, and the offer is arithmetic on
 * them — "12 more units reaches AED 38.00 per unit". A tile that told a
 * procurement manager this is a tile built for him.
 */
export function nextBandOffer(ladder: PriceBand[], qty: number): { band: PriceBand; more: number } | null {
  const current = ladder.find((band) => qty >= band.minQty && (band.nextQty === null || qty < band.nextQty));
  const next = ladder.find((band) => band.minQty > qty);
  if (!next) return null;
  if (current && next.unitPrice >= current.unitPrice) return null;
  return { band: next, more: next.minQty - qty };
}

/**
 * What the buy column offers when this view of the product carries NO price at
 * all — or null when it does.
 *
 * WHY THIS EXISTS. 383 of the 385 live listings publish only business price
 * bands, and the anonymous detail DTO filters price rows by channel, so for
 * almost every visitor `resolveStorefrontSelection` returns null. The page used
 * to treat that null as ONE state and render it as an error: danger-ink "No
 * applicable price is available…", a basis line saying none of the published
 * bands covered the combination (false — the bands exist, in another channel),
 * a locked stepper and a disabled Add to cart, with the RFQ link demoted to a
 * secondary button beneath it. The tiles on the same page had already been
 * taught the opposite: a product this storefront cannot price is a product to
 * quote, not an error state (product-card-commerce.ts).
 *
 * So null is now TWO states. Prices exist in this view but no band covers the
 * selection (a quantity or currency gap) — that is still the genuine gap, and
 * still says so. No price row in this view at all, on the product or on any
 * variant — that is the catalogue's normal quote-only state, and this returns
 * the action for it.
 *
 * THE LABEL IS THE TILE'S RULE, not a second one. `productCardPurchaseAction`
 * decides "request availability" versus "request a quote" from stock, and the
 * page asks it the same question with the same stock fact the tile had, so the
 * button a buyer pressed on the grid and the button on the page they land on
 * say the same words. `hasVariants` goes in as false on purpose: the tile
 * routes a variant-bearing row HERE so a variant can be chosen, and on this
 * page one already has been, so the selected variant's own stock decides.
 */
export function quoteOnlyAction(
  product: Pick<StorefrontProduct, "prices" | "variants" | "inventory">,
  selectedVariantId: string | undefined,
  hasSelection: boolean,
): "REQUEST_QUOTE" | "REQUEST_AVAILABILITY" | null {
  if (hasSelection) return null;
  const hasChannelPrice = product.prices.length > 0
    || product.variants.some((variant) => (variant.prices ?? []).length > 0);
  if (hasChannelPrice) return null;
  const variant = selectedVariantId ? product.variants.find((candidate) => candidate.id === selectedVariantId) : undefined;
  const inStock = variant ? variant.inStock === true : product.inventory[0]?.inStock === true;
  return productCardPurchaseAction(false, inStock, false) === "REQUEST_AVAILABILITY"
    ? "REQUEST_AVAILABILITY"
    : "REQUEST_QUOTE";
}

/**
 * The name to lead with in the reader's language, and the other language's name
 * to carry beneath it, or "" when there is nothing different to carry.
 *
 * The bilingual secondary line is deliberate: a GCC procurement buyer routinely
 * needs the English trade name of an Arabic listing, and the reverse. But it was
 * printed whenever the other column was non-empty. All 385 live products, and
 * five of nine seller profiles, store the English name in the Arabic column too,
 * so every product page printed its title twice. The second copy was set
 * right-to-left and pushed to the inline end, where it read as a layout fault.
 * An echo is not a translation, so an identical string is not repeated.
 */
export function bilingualName(nameEn: string, nameAr: string, locale: "en" | "ar"): { primary: string; secondary: string } {
  const en = nameEn.trim();
  const ar = nameAr.trim();
  const primary = locale === "ar" ? ar || en : en;
  const other = locale === "ar" ? (ar ? en : "") : ar;
  return { primary, secondary: other && other !== primary ? other : "" };
}

export type CrumbCategory = { slug: string; nameEn: string; nameAr: string | null };

/**
 * The category rung of the product breadcrumb, or null when there should be none.
 *
 * The trail used to jump from "Products" straight to the item: the service
 * loaded the category and the DTO dropped it, so a buyer arriving from search or
 * a shared link had no way up to the shelf. Two cases still get no crumb.
 *
 *   - The category page would not list this product. The public category tree
 *     only includes categories with a publicly discoverable product beneath them,
 *     so a business-only listing's category may be a 404.
 *   - The crumb would only repeat the product. Imported catalogues often name a
 *     leaf category and its only product the same thing ("Wire & Cable
 *     Lubricants › Wire & Cable Lubricants"), and an echo is not a trail.
 */
export function breadcrumbCategory(
  product: { isPubliclyDiscoverable?: unknown; category?: CrumbCategory | null },
  productName: string,
  locale: "en" | "ar",
): { href: string; name: string } | null {
  const category = product.category;
  if (!category || product.isPubliclyDiscoverable !== true) return null;
  const name = (locale === "ar" ? category.nameAr?.trim() || category.nameEn : category.nameEn).trim();
  if (!name || name.toLocaleLowerCase() === productName.trim().toLocaleLowerCase()) return null;
  return { href: `/categories/${encodeURIComponent(category.slug)}`, name };
}

/**
 * The SellerDocument types the message tree names. A verification basis is only
 * printed for one of these, so a new enum value can never reach a buyer raw.
 */
export const SELLER_DOCUMENT_TYPES = [
  "COMMERCIAL_REGISTRATION",
  "TRADE_LICENSE",
  "VAT_CERTIFICATE",
  "SASO_CERTIFICATE",
  "SFDA_APPROVAL",
  "HALAL_CERTIFICATE",
  "ESMA_CERTIFICATE",
  "ISO_CERTIFICATE",
  "OTHER",
] as const;

export type SellerDocumentType = (typeof SELLER_DOCUMENT_TYPES)[number];

export function isSellerDocumentType(value: string): value is SellerDocumentType {
  return (SELLER_DOCUMENT_TYPES as readonly string[]).includes(value);
}

/**
 * The RFQ form's address for THIS product, not just for its supplier.
 *
 * The supplier card linked `?supplier=<id>` alone and the buy column
 * `?supplier=&product=`, and the form read neither, so both buttons landed on a
 * blank request and the buyer retyped the name of the thing they had just been
 * looking at. The form now resolves `product` — and `variant`, and `qty` — on
 * the server (app/b2b/rfq/new/product-seed.ts), so the link carries identifiers
 * only. No name or SKU travels in the URL: the server reads those from the
 * catalogue under the product API's own visibility rule, which a query string
 * anyone can type could not be held to.
 */
export function rfqHrefForProduct({
  sellerId,
  productId,
  variantId,
  quantity,
}: {
  sellerId: string;
  productId: string;
  variantId?: string;
  quantity?: number;
}): string {
  const query = new URLSearchParams({ supplier: sellerId, product: productId });
  if (variantId) query.set("variant", variantId);
  if (quantity && Number.isInteger(quantity) && quantity > 0) query.set("qty", String(quantity));
  return `/b2b/rfq/new?${query.toString()}`;
}

/**
 * How many of the loaded reviews sit at each star. Counted over the window the
 * catalogue actually returned, never extrapolated to the server's total — the
 * caller labels it as such. A distribution invented from an average is fiction
 * with a chart on it.
 */
export function ratingDistribution(reviews: { rating: number }[]): { stars: number; count: number }[] {
  return [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: reviews.filter((review) => Math.round(review.rating) === stars).length,
  }));
}

/**
 * A focus ring drawn INSIDE the control's own box.
 *
 * `.u-focus` paints its two-stop ring as an OUTWARD box-shadow, which is simply
 * invisible whenever the control is flush against a clipping parent — a cell of
 * a <CellGrid>, a row inside a well, a thumbnail in a horizontally scrolling
 * strip, anything inside a masked scroller. A negative outline-offset puts the
 * ring colour inside the border box, where nothing can clip it, and it composes
 * with `shadow-*` instead of replacing it the way a box-shadow ring would.
 */
export const FOCUS_INSET =
  "outline-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring";

/**
 * <Surface as="button"> is typed with generic HTML attributes, which carry no
 * `type`. Declaring the attribute once here keeps a chip inert if one of them
 * ever ends up inside a form, without a cast at every call site.
 */
export const BUTTON_TYPE = { type: "button" } as unknown as React.HTMLAttributes<HTMLElement>;
