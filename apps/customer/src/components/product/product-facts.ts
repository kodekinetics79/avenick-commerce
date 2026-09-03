import type * as React from "react";
import { formatCurrency } from "@avenick/utils";
import { resolveStorefrontSelection, type StorefrontProduct } from "@/lib/catalog-commercial";
import type { Currency } from "@/lib/market-context";

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
