import { db } from "../index";
import { read } from "../resilient-ops";
import {
  PRODUCT_LIST_INCLUDE,
  PUBLIC_CATALOG_SELLER,
  attachProductRatings,
  type ProductListRow,
  type ProductListRowBase,
  type ProductRating,
} from "./products";
import type { OrderStatus, PaymentStatus, Prisma } from "@prisma/client";

/**
 * The storefront home page's product rails — Best Sellers, New Arrivals, Top
 * Rated, Featured — and the brand logo strip beneath them.
 *
 * Every row here is measured, never decorated. The rules this module refuses to
 * break:
 *
 *  · A RANK IS A COUNT OF SOMETHING THAT HAPPENED. "Best Sellers" is summed
 *    units from orders that really are sales; "Top Rated" is an average over
 *    real reviews. Neither falls back to "some products" when the measurement
 *    is empty — an empty rail is the truthful answer and the UI must be able to
 *    render one.
 *  · IT NEVER INVENTS EDITORIAL CURATION. This schema has no featured flag, no
 *    campaign and no collection table. See FEATURED below for what the word
 *    already means in this codebase and what it therefore returns.
 *  · IT SHOWS ONLY WHAT THE CATALOG WOULD SHOW. All four rails are filtered by
 *    the same visibility predicate the public catalog listing uses, imported
 *    from products.ts rather than restated, so a rail can never advertise a
 *    product the catalog itself would hide or checkout would refuse.
 *
 * Every rail is one grouped/aggregate query plus one keyed fetch. There is no
 * per-product query anywhere in this file: it runs on the busiest route on the
 * site.
 */

/** Rows per rail when the caller does not choose. */
export const DEFAULT_SECTION_SIZE = 8;

/**
 * Hard ceiling per rail. These queries scan OrderItem and ProductReview on a
 * public, unauthenticated route; the size of a home rail is a layout decision,
 * not a reason to let a caller ask for a thousand rows.
 */
export const MAX_SECTION_SIZE = 24;

/**
 * How many reviews a product needs before it may be called "Top Rated".
 *
 * Ranking on a bare average makes the section a lottery: one 5-star review is a
 * perfect 5.0 and outranks a product with two hundred reviews averaging 4.8.
 * That is not a top-rated product, it is a product with a friend.
 *
 * Three is the smallest threshold that actually buys anything, and it is chosen
 * rather than borrowed:
 *
 *  · At n=1 and n=2 a single review still sets or halves the score outright. At
 *    n=3 no single voice can hold the average at the top — one 5 among two 3s
 *    averages 3.67, comfortably below a genuine 4.5, so an outlier is diluted
 *    rather than crowned.
 *  · It is not higher because reviews here are expensive: product-reviews.ts
 *    only accepts a review from a buyer with a DELIVERED order containing the
 *    product, one per buyer (unique [productId, userId]). Review volume is
 *    therefore bounded by real deliveries, and a threshold of 10 or 20 would
 *    empty this rail on a young catalog — which would not be "safe", it would
 *    just be a section that never renders while well-reviewed products exist.
 *
 * Callers may raise it (never silently lower the bar in the UI); the ranking is
 * a pure function below so the trade-off is testable.
 */
export const MIN_REVIEWS_FOR_TOP_RATED = 3;

/**
 * WHICH ORDER STATES COUNT AS A SALE.
 *
 * Stated as a total map over OrderStatus, not as a list of exclusions, so that
 * adding a member to the enum is a COMPILE ERROR here rather than a new state
 * silently counted as revenue. A denylist fails open; this fails closed.
 *
 * Counted — the buyer committed and the money is expected or taken:
 *   PAYMENT_CONFIRMED, CONFIRMED, PROCESSING, SHIPPED, OUT_FOR_DELIVERY,
 *   DELIVERED. These are the states an order walks through after payment; a sale
 *   does not become more or less real because a parcel is still in a van.
 *   RETURN_REQUESTED is counted too: a request is not an outcome. The goods were
 *   paid for and delivered, and the reversal has not happened — when it does the
 *   order moves to RETURNED or REFUNDED and drops out of this set on its own.
 *
 * Not counted:
 *   PENDING_PAYMENT — nothing has been paid. An abandoned checkout is the single
 *     easiest way to fake a best-seller, since anyone can create these at will.
 *   CANCELLED       — the sale was undone before fulfilment.
 *   REFUNDED        — the money went back. Selling and then refunding is not
 *     selling.
 *   RETURNED        — the goods came back.
 */
export const SALE_COUNTING_ORDER_STATUS: Record<OrderStatus, boolean> = {
  PENDING_PAYMENT: false,
  PAYMENT_CONFIRMED: true,
  CONFIRMED: true,
  PROCESSING: true,
  SHIPPED: true,
  OUT_FOR_DELIVERY: true,
  DELIVERED: true,
  RETURN_REQUESTED: true,
  CANCELLED: false,
  REFUNDED: false,
  RETURNED: false,
};

/** The counted states, as the array the query predicates take. */
export const SALE_COUNTING_ORDER_STATUSES: OrderStatus[] = (
  Object.entries(SALE_COUNTING_ORDER_STATUS) as Array<[OrderStatus, boolean]>
)
  .filter(([, counts]) => counts)
  .map(([status]) => status);

/**
 * Payment outcomes that void a sale regardless of where the order status got to.
 *
 * The two columns can disagree: payments.ts moves paymentStatus to REFUNDED when
 * money is returned, and a partial refund leaves the order in DELIVERED. FAILED
 * is the same argument from the other end — an order that limped forward on a
 * payment that never succeeded is not a unit sold.
 */
const NON_SALE_PAYMENT_STATUSES: PaymentStatus[] = ["REFUNDED", "FAILED"];

/**
 * The public visibility rule, in one place, exactly as the catalog listing
 * applies it (services/products.ts + the /api/products route that calls it):
 * not soft-deleted, ACTIVE, publicly discoverable, and behind a seller that is
 * ACTIVE and not soft-deleted.
 *
 * `isB2CEnabled` follows listProducts EXACTLY: applied when the caller states a
 * channel, absent when it does not. `undefined` therefore means "both channels",
 * not "B2C" — the same three-state the catalog route has always had.
 *
 * This distinction is not academic. The home page has been calling
 * `/api/products?b2c=true` since it was written, and that route never reads the
 * parameter — it parses `b2b` only. So the filter has never once been applied,
 * and the page has been showing the whole catalogue while believing it showed
 * the B2C slice. Defaulting to `true` here would have been the first code to
 * honour that intent, and it would have emptied the storefront: not one product
 * in the catalogue has isB2CEnabled set. A rail that silently shows nothing is
 * worse than one that shows what is actually for sale.
 */
function publicProductWhere(b2c: boolean | undefined): Prisma.ProductWhereInput {
  return {
    deletedAt: null,
    status: "ACTIVE",
    isPubliclyDiscoverable: true,
    seller: PUBLIC_CATALOG_SELLER,
    ...(b2c !== undefined && { isB2CEnabled: b2c }),
  };
}

// ─── PURE RANKING ─────────────────────────────────────────────────────────────

/** One row of the units-sold aggregate. `units` is null when Prisma summed nothing. */
export interface UnitsSoldGroup {
  productId: string;
  units: number | null;
}

/**
 * Rank by units sold, then by id.
 *
 * The id tiebreak is not cosmetic: two products on equal units have no defined
 * order in SQL, so without it the home page reshuffles between requests and the
 * 60-second cache serves a different "ranking" each time it refills.
 *
 * A product with zero or non-finite units is dropped rather than ranked last —
 * "sold none" is not a position in a best-seller list.
 */
export function rankBestSellers(groups: UnitsSoldGroup[], limit: number): string[] {
  return groups
    .filter((group) => Number.isFinite(group.units) && (group.units ?? 0) > 0)
    .sort((a, b) => (b.units ?? 0) - (a.units ?? 0) || a.productId.localeCompare(b.productId))
    .slice(0, Math.max(0, limit))
    .map((group) => group.productId);
}

/** One row of the review aggregate. `average` is null when nothing was averaged. */
export interface RatingGroup {
  productId: string;
  average: number | null;
  count: number;
}

/**
 * Rank by average rating among products that clear the review threshold.
 *
 * Ties break on review count first — between two products averaging 4.8, the one
 * fifty buyers agree on is the better claim — and on id last, for the same
 * stability reason as above.
 *
 * KNOWN LIMIT, stated rather than hidden: this is a threshold, not a shrinkage.
 * A 5.0 from exactly `minReviews` reviews still outranks a 4.9 from two hundred.
 * The threshold bounds how wrong that can be; a Bayesian prior would order them
 * properly and is the upgrade path if the catalog ever has the review volume to
 * justify one.
 */
export function rankTopRated(groups: RatingGroup[], minReviews: number, limit: number): string[] {
  return groups
    .filter(
      (group) =>
        group.count >= minReviews &&
        group.average != null &&
        Number.isFinite(group.average),
    )
    .sort(
      (a, b) =>
        (b.average ?? 0) - (a.average ?? 0) ||
        b.count - a.count ||
        a.productId.localeCompare(b.productId),
    )
    .slice(0, Math.max(0, limit))
    .map((group) => group.productId);
}

/**
 * Put fetched rows back into the ranked order the aggregate produced.
 *
 * `findMany({ id: { in: ids } })` returns rows in the database's order, not the
 * caller's, so a rank computed and then thrown away is the classic way a
 * "Best Sellers" rail ends up in arbitrary order. An id with no row — a product
 * that lost visibility between the aggregate and the fetch — is dropped, and a
 * row whose id was not ranked is never appended: the output is a subsequence of
 * `ids`, nothing more.
 */
export function orderRowsByIds<T extends { id: string }>(rows: T[], ids: string[]): T[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.map((id) => byId.get(id)).filter((row): row is T => row !== undefined);
}

/** Clamp a caller-supplied rail size into something a public route can serve. */
export function sectionSize(limit: number | undefined): number {
  if (limit == null || !Number.isFinite(limit)) return DEFAULT_SECTION_SIZE;
  return Math.min(MAX_SECTION_SIZE, Math.max(1, Math.floor(limit)));
}

// ─── SECTIONS ─────────────────────────────────────────────────────────────────

export interface StorefrontSectionOptions {
  /** Rows per rail. Clamped to 1..MAX_SECTION_SIZE. */
  limit?: number;
  /** Consumer storefront (isB2CEnabled). Default true — the home page is B2C. */
  b2c?: boolean;
  /** Raise the Top Rated bar. Defaults to MIN_REVIEWS_FOR_TOP_RATED. */
  minReviews?: number;
  /**
   * Count only sales from this instant onward. Omitted means all time, which is
   * what "best sellers" means here today: nothing in this schema records a
   * rolling sales rank, so a window would be a choice this module invented. A
   * caller that wants "best sellers this quarter" must say so explicitly.
   */
  bestSellersSince?: Date;
}

export interface StorefrontSections {
  bestSellers: ProductListRow[];
  newArrivals: ProductListRow[];
  topRated: ProductListRow[];
  featured: ProductListRow[];
}

/**
 * FEATURED.
 *
 * There is no featured flag in this schema. No `isFeatured`, no curation table,
 * no campaign, no collection — the promotion models are coupons, which attach to
 * a cart and not to a product. What "featured" already means in this codebase is
 * written down in two places and means the same thing in both: the home page's
 * `getFeaturedProducts()` and /deals both fetch `/api/products?limit=N&b2c=true`
 * and render the result, and /deals states it outright — "a slice of the catalog
 * feed, in the order the catalog returned it ... no ranking, promotion or
 * discount is applied".
 *
 * So that is what this returns: the public catalog feed in its own default order
 * (newest first), and nothing else. It is NOT ranked, and callers must not label
 * it as if it were.
 *
 * The one liberty taken is de-duplication — featured excludes products already
 * shown in the other three rails — and that is not invented either: it is what
 * `partitionHomeProducts()` in apps/customer already does, for the stated reason
 * of keeping home collections distinct when the API exposes no sales ranking.
 * Without it, "Featured" would be a verbatim copy of "New Arrivals", since both
 * are the same feed in the same order.
 *
 * Consequence worth stating: a genuinely editorial "Featured" needs a schema
 * change (a curated flag or a collection table). This function is the honest
 * limit of what present data supports.
 */
function featuredWhere(visible: Prisma.ProductWhereInput, excludeIds: string[]): Prisma.ProductWhereInput {
  return excludeIds.length > 0 ? { ...visible, id: { notIn: excludeIds } } : visible;
}

function findSectionRows(where: Prisma.ProductWhereInput, take: number, orderBy?: Prisma.ProductOrderByWithRelationInput) {
  return db.product.findMany({
    where,
    take,
    ...(orderBy && { orderBy }),
    include: PRODUCT_LIST_INCLUDE,
  });
}

/**
 * All four home rails, each shaped exactly like a row of `listProducts()` so one
 * tile component renders every section.
 *
 * Cost: three round trips regardless of how many rails there are — the two
 * aggregates and the newest-first page go together, the two ranked fetches and
 * the featured page go together, and one grouped review query rates every row on
 * the page at once. Wrapped in the resilient read with a short TTL because this
 * is the busiest route on the site and a home page that degrades to
 * last-known-good beats a home page that 500s.
 */
export async function getStorefrontSections(
  opts: StorefrontSectionOptions = {},
): Promise<StorefrontSections> {
  const limit = sectionSize(opts.limit);
  const b2c = opts.b2c;
  const minReviews = Math.max(1, Math.floor(opts.minReviews ?? MIN_REVIEWS_FOR_TOP_RATED));
  const since = opts.bestSellersSince;
  const visible = publicProductWhere(b2c);

  const cacheKey = `storefront:sections:${JSON.stringify({
    limit,
    b2c,
    minReviews,
    since: since?.toISOString() ?? null,
  })}`;

  const { data } = await read(
    async () => {
      const [unitsSold, ratings, newArrivals] = await Promise.all([
        // Summed units per product, ranked and truncated in SQL. The `product`
        // predicate is inside the aggregate on purpose: ranking first and
        // filtering afterwards would return a short rail whenever a top seller
        // is hidden, since the truncation would already have happened.
        db.orderItem.groupBy({
          by: ["productId"],
          where: {
            // The LINE's own status, not just the order's. Fulfilment and admin
            // operations cancel individual lines, and product-reviews.ts already
            // treats a cancelled line in a delivered order as goods the buyer
            // never received. A cancelled line is not a unit sold either.
            status: { in: SALE_COUNTING_ORDER_STATUSES },
            order: {
              status: { in: SALE_COUNTING_ORDER_STATUSES },
              paymentStatus: { notIn: NON_SALE_PAYMENT_STATUSES },
              ...(since && { createdAt: { gte: since } }),
            },
            product: visible,
          },
          _sum: { quantity: true },
          orderBy: { _sum: { quantity: "desc" } },
          take: limit,
        }),
        // Average rating per product, with the threshold applied as HAVING so
        // the database never returns the single-review products at all.
        db.productReview.groupBy({
          by: ["productId"],
          where: { product: visible },
          _avg: { rating: true },
          _count: { rating: true },
          having: { rating: { _count: { gte: minReviews } } },
          orderBy: [{ _avg: { rating: "desc" } }, { _count: { rating: "desc" } }],
          take: limit,
        }),
        findSectionRows(visible, limit, { createdAt: "desc" }),
      ]);

      const bestSellerIds = rankBestSellers(
        unitsSold.map((group) => ({ productId: group.productId, units: group._sum.quantity })),
        limit,
      );
      const topRatedIds = rankTopRated(
        ratings.map((group) => ({
          productId: group.productId,
          average: group._avg.rating,
          count: group._count.rating,
        })),
        minReviews,
        limit,
      );

      // Featured excludes the ids the other rails CLAIMED, which is knowable
      // before their rows are fetched. If a ranked id turns out to have no
      // visible row, featured merely passed over one candidate — it can never
      // duplicate a tile, which is the property that matters.
      const claimed = Array.from(new Set([...bestSellerIds, ...topRatedIds, ...newArrivals.map((row) => row.id)]));

      const [bestSellerRows, topRatedRows, featuredRows] = await Promise.all([
        bestSellerIds.length > 0
          ? findSectionRows({ ...visible, id: { in: bestSellerIds } }, bestSellerIds.length)
          : Promise.resolve([] as ProductListRowBase[]),
        topRatedIds.length > 0
          ? findSectionRows({ ...visible, id: { in: topRatedIds } }, topRatedIds.length)
          : Promise.resolve([] as ProductListRowBase[]),
        findSectionRows(featuredWhere(visible, claimed), limit, { createdAt: "desc" }),
      ]);

      // One review aggregate for every tile on the page — deduplicated first,
      // because a product may legitimately appear in more than one rail.
      const unique = Array.from(
        new Map(
          [...bestSellerRows, ...newArrivals, ...topRatedRows, ...featuredRows].map((row) => [row.id, row]),
        ).values(),
      );
      const rated = await attachProductRatings(unique);
      const ratingById = new Map<string, ProductRating | null>(rated.map((row) => [row.id, row.rating]));
      const withRating = (rows: ProductListRowBase[]): ProductListRow[] =>
        rows.map((row) => ({ ...row, rating: ratingById.get(row.id) ?? null }));

      return {
        // Re-ordered by rank: the fetch above returned them in the database's
        // order, which has nothing to do with units sold or stars.
        bestSellers: withRating(orderRowsByIds(bestSellerRows, bestSellerIds)),
        newArrivals: withRating(newArrivals),
        topRated: withRating(orderRowsByIds(topRatedRows, topRatedIds)),
        featured: withRating(featuredRows),
      } satisfies StorefrontSections;
    },
    { name: "storefront.sections", cache: { key: cacheKey, ttlMs: 60_000 } },
  );

  return data;
}

// ─── BRAND STRIP ──────────────────────────────────────────────────────────────

/** A brand as the logo strip renders it. `logoUrl` is non-null BY CONSTRUCTION. */
export interface BrandWithLogo {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string | null;
  logoUrl: string;
}

/**
 * The brand strip: active brands that have a logo AND something to sell.
 *
 * Both halves are refusals, not preferences:
 *
 *  · NO LOGO, NO ROW. The strip renders each entry as an `<img>`. A brand with a
 *    null logoUrl would be a broken image or, worse, a name silently styled as
 *    if it were artwork. Prisma's `not: null` cannot exclude an empty string, so
 *    the trim below finishes the job — "" is a missing logo that passes a
 *    NOT NULL test.
 *  · NO VISIBLE PRODUCT, NO ROW. A logo in the strip is a promise that clicking
 *    it leads somewhere. The `some` predicate is the same public visibility rule
 *    the rails above use, so the brand link lands on a populated listing rather
 *    than an empty one — the /brands page filters by `brandSlug` through exactly
 *    this predicate.
 *
 * Deliberately STRICTER than /api/brands, which powers the /brands directory:
 * that route counts products with `status: ACTIVE, deletedAt: null` and no
 * discoverability or seller predicate — the /brands page says so in its own
 * dateline. A directory listing a brand a visitor cannot browse is merely a
 * wide count; a logo in the home strip is a link, so this one is filtered by
 * what a visitor can actually reach.
 *
 * One query. Ordered by name so the strip is stable between renders.
 */
export async function listBrandsWithLogos(opts: { limit?: number; b2c?: boolean } = {}): Promise<BrandWithLogo[]> {
  const take = opts.limit == null ? undefined : Math.max(1, Math.floor(opts.limit));
  const visible = publicProductWhere(opts.b2c ?? true);

  const { data } = await read(
    async () => {
      const brands = await db.brand.findMany({
        where: {
          isActive: true,
          logoUrl: { not: null },
          products: { some: visible },
        },
        select: { id: true, slug: true, nameEn: true, nameAr: true, logoUrl: true },
        orderBy: { nameEn: "asc" },
        ...(take != null && { take }),
      });
      return brands.flatMap((brand) => {
        const logoUrl = brand.logoUrl?.trim();
        if (!logoUrl) return [];
        return [{ id: brand.id, slug: brand.slug, nameEn: brand.nameEn, nameAr: brand.nameAr, logoUrl }];
      });
    },
    {
      name: "storefront.brandStrip",
      cache: { key: `storefront:brands:${JSON.stringify({ take: take ?? null, b2c: opts.b2c ?? true })}`, ttlMs: 300_000 },
    },
  );

  return data;
}
