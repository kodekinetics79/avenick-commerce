import { formatCurrency, isSupportedCurrency } from "@avenick/utils";
import { productCardPricePresentation } from "@/lib/product-card-commerce";

/**
 * The hero carousel's slides, shaped from the rows the home page already loads.
 *
 * A pure module with no directive, deliberately: the shaping runs on the server
 * beside the page's other price logic, and only the finished view-model crosses
 * into the client island. Law 9 — a callable helper must never be exported from
 * a "use client" module — is why this is not a function inside the carousel.
 *
 * EVERY SLIDE IS A REAL PRODUCT from the fetch the page already does. Nothing
 * here can invent one: an empty feed produces an empty array and the hero's
 * object column simply does not render. Never a placeholder product, never
 * stock photography, never a rating.
 */

/** The card-shaped row page.tsx builds for every rail (its `toCard`). Only the
 *  fields the hero reads are named, so a private field cannot reach the client
 *  component by accident. */
export interface HeroSlideSource {
  id: string;
  slug: string;
  nameEn: string;
  nameAr?: string | null;
  imageUrl?: string | null;
  category?: string | null;
  price?: number | null;
  currency?: string | null;
  priceIsFrom?: boolean;
  hasVariants?: boolean;
}

export interface HeroSlide {
  id: string;
  slug: string;
  /** In the active locale, falling back to English when the Arabic name is unset. */
  name: string;
  /** Null when the category is unknown: the product is shown WITHOUT one rather
   *  than filed under a category it may not belong to. */
  category: string | null;
  imageUrl: string | null;
  currency: string | null;
  /**
   * The product's own public figure, formatted, or null when the catalogue
   * exposes none for this channel — in which case the caption says "Price on
   * request" rather than borrowing a B2B figure an anonymous visitor may not see.
   */
  amount: string | null;
  /**
   * Whether the figure is the lowest of several bands. The "From" qualifier is
   * rendered BESIDE the figure by the caption, never baked into the string, so
   * it cannot collapse the figure's rank.
   */
  isFrom: boolean;
}

/** Up to ten, as the brief allows — and never more than the feed holds. */
export const HERO_SLIDE_LIMIT = 10;

/**
 * Distinct NAMES, not just distinct rows. The pilot catalogue carries the same
 * product name across several SKUs — the first six rows of the live feed are
 * three "Wire & Cable Lubricants" and two "Twist-on Wire Connectors" — and a
 * carousel that turns from one to an identical-looking next reads as a
 * rendering fault rather than a shelf.
 */
function distinctByName(rows: readonly HeroSlideSource[]): HeroSlideSource[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.nameEn)) return false;
    seen.add(row.nameEn);
    return true;
  });
}

function toSlide(row: HeroSlideSource, locale: "en" | "ar"): HeroSlide {
  const { price, currency } = row;
  const priced = price != null && typeof currency === "string" && isSupportedCurrency(currency);
  return {
    id: row.id,
    slug: row.slug,
    name: locale === "ar" ? row.nameAr || row.nameEn : row.nameEn,
    category: row.category || null,
    imageUrl: row.imageUrl || null,
    currency: typeof currency === "string" ? currency : null,
    amount: priced ? formatCurrency(price, currency, locale) : null,
    // The same rule the product grid uses, belt and braces: a variant-bearing
    // product's card price is the lowest of several bands, and the hero showing
    // that figure bare would state a price the buyer cannot transact at.
    isFrom:
      priced &&
      (row.priceIsFrom === true || productCardPricePresentation(price, row.hasVariants === true) === "FROM"),
  };
}

export function toHeroSlides(
  rows: readonly HeroSlideSource[],
  options: { locale: "en" | "ar"; limit?: number },
): HeroSlide[] {
  const limit = options.limit ?? HERO_SLIDE_LIMIT;
  const distinct = distinctByName(rows);
  // Pictured products first. A slide is an OBJECT on the slab; ten empty squares
  // over ten captions is not a carousel. If nothing in the feed is pictured the
  // lead row still stands alone with its caption, exactly as the single specimen
  // did, so the hero never claims a photograph the catalogue does not hold.
  const pictured = distinct.filter((row) => Boolean(row.imageUrl));
  const chosen = pictured.length > 0 ? pictured : distinct.slice(0, 1);
  return chosen.slice(0, limit).map((row) => toSlide(row, options.locale));
}
