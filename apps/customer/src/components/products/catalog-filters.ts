/**
 * The catalogue filter contract, as pure functions.
 *
 * Everything a buyer can narrow the catalogue by lives in the URL and nowhere
 * else. That is not a stylistic preference: /products is a Server Component, a
 * filtered view has to survive a refresh, arrive intact in a colleague's inbox
 * and be reachable without client JavaScript, and none of that is true of state
 * held in a component.
 *
 * This module holds the parts of that contract that have no markup in them — the
 * allowlists, the parser, the URL builder and the list of what is currently in
 * force — because those are the parts that go wrong silently. A filter that is
 * parsed but never sent to the API, or sent but never shown as active, looks
 * exactly like a catalogue that has nothing to offer.
 *
 * No translations here. Every function returns identifiers and numbers; the
 * page turns them into words with literal `t("…")` calls, so the message-key
 * regression test can still see every key that is asked for.
 */

/**
 * Rating floors offered in the sidebar.
 *
 * Ratings are 1–5 integers, so a 4.5 average is attainable and meaningful.
 * Nothing below 3 is offered: "2 stars and up" is not a quality filter, it is a
 * near-synonym for "has been reviewed", and offering it would imply the
 * catalogue is full of two-star goods.
 */
export const RATING_CHOICES = [4.5, 4, 3] as const;

/**
 * Minimum-order ceilings offered in the sidebar.
 *
 * A buyer with a forty-unit requirement wants suppliers whose smallest lot is at
 * or below it; they never want a floor. The single floor bucket below ("more
 * than 100") exists so the rail is a complete partition of the column — a buyer
 * can see that nothing is being hidden between the buckets — and because
 * bulk-lot suppliers are where the quantity price breaks live.
 */
export const MOQ_CEILINGS = [1, 10, 50, 100] as const;

/** The one floor bucket. 101 and up is exactly "more than 100". */
export const MOQ_BULK_FLOOR = 101;

/**
 * Sorts the catalog query performs across the WHOLE result set.
 *
 * Price is deliberately absent, and it is absent for a schema reason rather than
 * an effort one: a product has no price. ProductPrice holds a row per
 * (type, currency, quantity band), most of this catalogue is quote-only, and
 * `cardPrice` is computed per request from the viewer's channel and currency.
 * There is nothing for the database to ORDER BY, so a price sort would either
 * order by NULL or re-sort the twenty-four rows already on the page — which is
 * what this control used to do, and why it was removed.
 */
export const SORT_CHOICES = ["newest", "name_asc", "rating", "moq_asc"] as const;
export type CatalogSort = (typeof SORT_CHOICES)[number];
export const DEFAULT_SORT: CatalogSort = "newest";

/** Every query parameter /products reads. */
export interface CatalogSearchParams {
  category?: string;
  /** Brand slug. Every tile on /brands links here with it. */
  brand?: string;
  search?: string;
  page?: string;
  sort?: string;
  inStock?: string;
  minRating?: string;
  moqMin?: string;
  moqMax?: string;
  b2b?: string;
  currency?: string;
}

export interface CatalogFilters {
  category?: string;
  brand?: string;
  inStock: boolean;
  minRating?: number;
  moqMin?: number;
  moqMax?: number;
  sort: CatalogSort;
}

/** Upper bound on a MOQ parameter, matching the API route's own bound. */
const MAX_MOQ_BOUND = 1_000_000;

/**
 * A rating floor as it is printed, always to one decimal.
 *
 * "4 and up" and "4.5 and up" set at different widths and read as different
 * kinds of number; "4.0" and "4.5" read as one scale. Formatted here rather than
 * left to ICU so the two options in the sidebar and the chip that reports the
 * choice cannot disagree about it.
 */
export function formatRatingFloor(value: number): string {
  return value.toFixed(1);
}

function positiveInt(value: string | undefined): number | undefined {
  if (value == null || value.trim() === "") return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_MOQ_BOUND) return undefined;
  return parsed;
}

/**
 * Read the filters out of the URL, dropping anything malformed.
 *
 * Dropping rather than erroring is the right call HERE and only here: the page
 * renders no chip for a filter it dropped, so a hand-edited `?minRating=banana`
 * shows the unfiltered catalogue with nothing claiming a rating filter is on.
 * The API route rejects the same input with a 400 instead, because a caller that
 * asked for a filter and got an unfiltered list back has been misled.
 *
 * The bounds are not the sidebar's buckets. `?moqMax=40` is a perfectly good
 * shareable link and is honoured; it simply highlights no bucket, and the
 * applied chip states the real number.
 */
export function parseCatalogFilters(params: CatalogSearchParams): CatalogFilters {
  const rating = params.minRating == null || params.minRating.trim() === "" ? NaN : Number(params.minRating);
  const minRating = Number.isFinite(rating) && rating >= 1 && rating <= 5 ? rating : undefined;
  const moqMin = positiveInt(params.moqMin);
  const moqMax = positiveInt(params.moqMax);
  return {
    category: params.category?.trim() || undefined,
    brand: params.brand?.trim() || undefined,
    inStock: params.inStock === "1",
    minRating,
    // An inverted window matches nothing while looking reasonable, so it is
    // treated as no window at all rather than as an empty catalogue.
    ...(moqMin != null && moqMax != null && moqMin > moqMax ? {} : { moqMin, moqMax }),
    sort: (SORT_CHOICES as readonly string[]).includes(params.sort ?? "")
      ? (params.sort as CatalogSort)
      : DEFAULT_SORT,
  };
}

/**
 * The order parameters are written into a URL.
 *
 * Fixed rather than "whatever order the object happened to have", so the same
 * filter selection always produces byte-identical links — which is what makes
 * them comparable, cacheable and testable.
 */
const PARAM_ORDER: Array<keyof CatalogSearchParams> = [
  "search",
  "category",
  "brand",
  "inStock",
  "minRating",
  "moqMin",
  "moqMax",
  "sort",
  "b2b",
  "currency",
  "page",
];

/**
 * A /products URL with some parameters changed and the rest kept.
 *
 * `page` is always dropped: every filter change is a new result set, and page 7
 * of the old one is not a position in the new one. Governed storefront context
 * (`b2b`, `currency`) is carried through, because losing it would quietly move
 * the buyer to consumer pricing while they were adjusting a filter.
 */
export function catalogHref(
  current: CatalogSearchParams,
  updates: Partial<Record<keyof CatalogSearchParams, string | undefined>> = {},
): string {
  const merged: CatalogSearchParams = { ...current, ...updates, page: undefined };
  const query = new URLSearchParams();
  for (const key of PARAM_ORDER) {
    const value = merged[key];
    if (value != null && value !== "") query.set(key, value);
  }
  const suffix = query.toString();
  return suffix ? `/products?${suffix}` : "/products";
}

/**
 * One filter currently narrowing the catalogue, and the exact edit that removes
 * it.
 *
 * `clear` removes that filter and NOTHING else, so undoing one choice never
 * costs the others — which is what a single "Clear all" link forces.
 */
export type AppliedFilterId = "category" | "brand" | "inStock" | "minRating" | "moqMin" | "moqMax";

export interface AppliedFilter {
  id: AppliedFilterId;
  /** The slug or number the filter carries, for the chip's label. */
  value?: string | number;
  clear: Partial<Record<keyof CatalogSearchParams, string | undefined>>;
}

/**
 * Everything in force, in the order it appears in the sidebar.
 *
 * `search` is NOT here. It is set from the header search field and is already
 * stated in the page heading and the result line; repeating it as a removable
 * chip in the filter panel would imply the panel put it there.
 *
 * Sort is not here either — it changes the order of an answer, not which
 * question was asked, and it has its own visible control.
 */
export function appliedCatalogFilters(filters: CatalogFilters): AppliedFilter[] {
  const applied: AppliedFilter[] = [];
  if (filters.category) applied.push({ id: "category", value: filters.category, clear: { category: undefined } });
  if (filters.brand) applied.push({ id: "brand", value: filters.brand, clear: { brand: undefined } });
  if (filters.inStock) applied.push({ id: "inStock", clear: { inStock: undefined } });
  if (filters.minRating != null) {
    applied.push({ id: "minRating", value: filters.minRating, clear: { minRating: undefined } });
  }
  if (filters.moqMax != null) applied.push({ id: "moqMax", value: filters.moqMax, clear: { moqMax: undefined } });
  if (filters.moqMin != null) applied.push({ id: "moqMin", value: filters.moqMin, clear: { moqMin: undefined } });
  return applied;
}

/**
 * Does the ORDER of the results depend on a restriction the buyer may not have
 * noticed?
 *
 * `sort=rating` ranks by an average over ProductReview, and a product with no
 * reviews has no average — so choosing it narrows the catalogue to reviewed
 * products as a side effect of ordering it. The page states that above the grid.
 * `minRating` narrows it for the same reason, but there the buyer asked.
 */
export function sortNarrowsToReviewed(filters: CatalogFilters): boolean {
  return filters.sort === "rating" && filters.minRating == null;
}

/**
 * The query string /api/products is called with.
 *
 * Pure and exported so a test can assert the one thing that cannot be seen by
 * looking at the page: that a filter the buyer selected actually reaches the
 * database. A filter parsed from the URL, rendered as an active chip and then
 * left out of this string is invisible in every screenshot and in every type
 * check, and it makes the catalogue look like it ignored the buyer.
 */
export function catalogApiQuery(
  filters: CatalogFilters,
  context: { page: number; limit: number; b2b: boolean; currency?: string; search?: string },
): URLSearchParams {
  return new URLSearchParams({
    page: String(context.page),
    limit: String(context.limit),
    // B2B is a request for a channel and is checked against the session.
    // The public side sends NO channel parameter at all: `b2c=true` means
    // "only products flagged isB2CEnabled", the route now honours it, and not
    // one product in this catalogue carries that flag — so the main catalogue
    // page asked for the empty set and got it. Omitted, the route answers with
    // every publicly discoverable product and the DTO withholds B2B pricing,
    // which is what a public catalogue means.
    ...(context.b2b ? { b2b: "true" } : {}),
    ...(context.currency ? { currency: context.currency } : {}),
    ...(context.search ? { search: context.search } : {}),
    ...(filters.category ? { categorySlug: filters.category } : {}),
    ...(filters.brand ? { brand: filters.brand } : {}),
    ...(filters.inStock ? { inStock: "true" } : {}),
    ...(filters.minRating != null ? { minRating: String(filters.minRating) } : {}),
    ...(filters.moqMin != null ? { moqMin: String(filters.moqMin) } : {}),
    ...(filters.moqMax != null ? { moqMax: String(filters.moqMax) } : {}),
    ...(filters.sort !== DEFAULT_SORT ? { sort: filters.sort } : {}),
  });
}
