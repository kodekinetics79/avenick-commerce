import { db } from "../index";
import { read } from "../resilient-ops";
import { countSellerUnreadMessages } from "./messaging";
import { SELLER_RFQ_INBOX_WHERE } from "./rfq";
import type { Prisma, ProductStatus, Currency, PricingType } from "@prisma/client";

export interface ProductListParams {
  page?: number;
  limit?: number;
  search?: string;
  categorySlug?: string;
  categoryId?: string;
  sellerId?: string;
  status?: ProductStatus;
  b2c?: boolean;
  b2b?: boolean;
  publiclyDiscoverable?: boolean;
  inStock?: boolean;
  /**
   * Restrict to one brand, by slug. The /brands page links every tile here;
   * without this the link landed on the unfiltered catalogue while presenting
   * itself as that brand's listings. Search cannot stand in for it — the brand
   * tier there matches only identifier-shaped terms against the slug, so it
   * returns a different set rather than this one.
   */
  brandSlug?: string;
  sort?: "newest" | "name_asc";
  currency?: Currency;
}

/**
 * Shortest search term that can use the trigram indexes.
 *
 * The catalog search runs an unanchored ILIKE across seven columns on two
 * tables, backed by pg_trgm GIN indexes. Trigrams need three characters: a
 * one- or two-character term cannot use the index and degrades to a sequential
 * scan on every matching row — on a public, unauthenticated route.
 *
 * The floor is a limit on FREE TEXT only. It is not a limit on the catalog:
 * identifier-shaped terms are answered below by equality and anchored prefix on
 * indexed identifier columns, which never touch a trigram index.
 */
export const MIN_CATALOG_SEARCH_LENGTH = 3;

/**
 * Shortest term we will prefix-match. A single-character prefix is not a search
 * — it selects a large arbitrary slice of the catalog — so one-character
 * identifiers are answered by exact equality alone.
 */
const MIN_IDENTIFIER_PREFIX_LENGTH = 2;

/**
 * An identifier-shaped term: a SKU, part number, size code or ERP code, never a
 * phrase. In an industrial catalog these are the highest-intent queries there
 * are, and the shortest — "3M", "M6", "M8" — which is exactly the range the
 * trigram floor used to swallow.
 */
const IDENTIFIER_TERM = /^[A-Za-z0-9][A-Za-z0-9._\/-]*$/;

/**
 * What actually happened to a caller's search term. The whole point of this
 * union is that "too_short" cannot be mistaken for "none": a refused search must
 * never be rendered as a catalog listing under a result count.
 */
export type CatalogSearchOutcome =
  /** No term was supplied. This is a plain catalog listing, not a search. */
  | { status: "none" }
  /**
   * Below MIN_CATALOG_SEARCH_LENGTH and not identifier-shaped, so no predicate
   * this schema can index applies. Nothing was queried; callers must say so.
   */
  | { status: "too_short"; term: string; minLength: number }
  /** A search ran. `strategy` names the predicate families that were applied. */
  | { status: "ran"; term: string; strategy: "identifier" | "identifier+text" | "text" };

/**
 * Whitespace normalisation only.
 *
 * This used to also return `undefined` below the trigram floor, which is how the
 * defect worked: listProducts could not tell "no search" from "search refused",
 * so a one- or two-character query silently returned the entire catalog while
 * the UI reported a result count over it. The length decision now lives in
 * classifyCatalogSearch, where it produces a distinguishable outcome.
 */
export function normalizeCatalogSearch(value?: string) {
  const normalized = value?.trim().replace(/\s+/g, " ");
  if (!normalized) return undefined;
  return normalized;
}

export function classifyCatalogSearch(value?: string): CatalogSearchOutcome {
  const term = normalizeCatalogSearch(value);
  if (!term) return { status: "none" };
  const isIdentifier = IDENTIFIER_TERM.test(term);
  if (term.length >= MIN_CATALOG_SEARCH_LENGTH) {
    return { status: "ran", term, strategy: isIdentifier ? "identifier+text" : "text" };
  }
  if (isIdentifier) return { status: "ran", term, strategy: "identifier" };
  return { status: "too_short", term, minLength: MIN_CATALOG_SEARCH_LENGTH };
}

/**
 * Case foldings tried for an identifier match.
 *
 * The btree indexes on these columns are case-sensitive, and Prisma's
 * `mode: "insensitive"` compiles to ILIKE, which cannot use them — that is the
 * sequential scan we are avoiding. Testing a small literal set keeps the lookup
 * an indexed equality while still bridging the two casings a catalog actually
 * holds: what a buyer types ("1145a") and what the supplier sheet loaded
 * ("1145A"). A mixed-case identifier stored as neither ("Part1145aB") will not
 * match on this path; at three characters or more the trigram tier below still
 * finds it case-insensitively.
 */
function identifierCandidates(term: string) {
  return Array.from(new Set([term, term.toUpperCase(), term.toLowerCase()]));
}

/**
 * Exact identifier equality — the rank-1 tier.
 *
 * Only columns the schema gives a btree index are listed: Product.sku (unique)
 * plus manufacturerPartNumber / externalItemNumber / erpCode on
 * ProductCommercialMetadata. supplierPartNumber is deliberately absent: it has a
 * trigram GIN index and no btree, so an equality on it cannot be indexed and
 * would seq-scan ProductCommercialMetadata — dragging the whole OR down with it
 * and reintroducing precisely the vulnerability the floor exists to prevent. It
 * stays in the free-text tier, where it is genuinely indexed. Adding a btree
 * index would need a migration, which is out of scope here.
 */
function exactIdentifierWhere(term: string): Prisma.ProductWhereInput {
  const values = identifierCandidates(term);
  return {
    OR: [
      { sku: { in: values } },
      { commercialMetadata: { is: { OR: [
        { manufacturerPartNumber: { in: values } },
        { externalItemNumber: { in: values } },
        { erpCode: { in: values } },
      ] } } },
    ],
  };
}

/**
 * Anchored prefix on the same identifier columns — the rank-2 tier.
 *
 * Anchoring is what makes this safe below the trigram floor: `LIKE 'M6%'` reads
 * one indexed identifier column per table and is answered from the btree
 * outright wherever the deployment's collation permits it (C/POSIX, or a
 * *_pattern_ops index). Even where it is not, it is a single anchored column
 * comparison rather than the unanchored `%M6%` across seven columns and two
 * tables that MIN_CATALOG_SEARCH_LENGTH exists to keep off a public route.
 */
function prefixIdentifierWhere(term: string): Prisma.ProductWhereInput {
  const prefixes = identifierCandidates(term);
  return {
    OR: [
      ...prefixes.map((value) => ({ sku: { startsWith: value } })),
      { commercialMetadata: { is: { OR: prefixes.flatMap((value) => [
        { manufacturerPartNumber: { startsWith: value } },
        { externalItemNumber: { startsWith: value } },
        { erpCode: { startsWith: value } },
      ]) } } },
    ],
  };
}

/**
 * Brand identity — the last tier, matched on Brand.slug.
 *
 * slug is the only indexed brand column (unique); nameEn has no index and is not
 * searched. Brand earns a tier because "3M" is a two-character query with
 * unmistakable intent against a catalog that really does carry 3M products —
 * answering "no results" there would be a confident false negative, not a safe
 * refusal. Brand is a small table reached through Product's brandId index, so
 * the predicate is cheap at any term length.
 *
 * It is ranked last for a second, non-cosmetic reason: brandId is NULLABLE, and
 * every tier below the first is expressed as "matches me AND NOT any tier above
 * me". `NOT (brandId IN (...))` evaluates to NULL — not true — for a product
 * with no brand, so a brand tier placed above another tier would silently drop
 * every brandless product out of it. Last means nothing is ever subtracted
 * through this predicate. The other tiers negate only sku, nameEn/nameAr and the
 * ProductCommercialMetadata subquery, all of which compare non-nullable values.
 */
function brandIdentifierWhere(term: string): Prisma.ProductWhereInput {
  const values = identifierCandidates(term);
  const prefixes = term.length >= MIN_IDENTIFIER_PREFIX_LENGTH
    ? Array.from(new Set([term, term.toLowerCase()])).map((value) => ({ slug: { startsWith: value } }))
    : [];
  return { brand: { is: { OR: [{ slug: { in: values } }, ...prefixes] } } };
}

/** Unanchored trigram search — the tier MIN_CATALOG_SEARCH_LENGTH guards. */
function freeTextWhere(term: string): Prisma.ProductWhereInput {
  return {
    OR: [
      { nameEn: { contains: term, mode: "insensitive" } },
      { nameAr: { contains: term, mode: "insensitive" } },
      { sku: { contains: term, mode: "insensitive" } },
      { commercialMetadata: { is: { OR: [
        { manufacturerPartNumber: { contains: term, mode: "insensitive" } },
        { supplierPartNumber: { contains: term, mode: "insensitive" } },
        { externalItemNumber: { contains: term, mode: "insensitive" } },
        { erpCode: { contains: term, mode: "insensitive" } },
      ] } } },
    ],
  };
}

/**
 * The seller states whose products the public catalog may advertise.
 *
 * secure-checkout re-checks exactly this pair before it will accept a line
 * (services/secure-checkout.ts: the seller must be ACTIVE and not soft-deleted),
 * so a product behind a withdrawn seller is visible, indexable and unbuyable —
 * the one combination worse than not listing it at all. Only four models carry
 * `deletedAt` and the client applies no guard of its own, so the predicate has
 * to be written out on every public path; it is defined once here so the rows,
 * the counts that paginate them, and the detail read cannot drift apart.
 *
 * Exported so the storefront home sections reuse this exact predicate rather
 * than restating it. A second copy is how a section starts advertising products
 * behind a withdrawn seller after this one is tightened.
 */
export const PUBLIC_CATALOG_SELLER: Prisma.SellerProfileRelationFilter = {
  is: { deletedAt: null, status: "ACTIVE" },
};

/**
 * Every relation a catalog tile renders, in one place.
 *
 * Exported because the storefront home sections render through the SAME tile
 * component and must therefore return the same row shape. A hand-copied second
 * include would diverge the first time a field is added here, and the divergence
 * would show up as a tile that renders on one row of the page and not another.
 */
export const PRODUCT_LIST_INCLUDE = {
  images: { where: { isPrimary: true }, take: 1 },
  prices: { where: { isActive: true } },
  inventory: { select: { variantId: true, qty: true, reservedQty: true } },
  variants: {
    where: { isActive: true },
    select: { id: true, prices: { where: { isActive: true } } },
  },
  category: { select: { nameEn: true, nameAr: true, slug: true } },
  brand: { select: { nameEn: true, nameAr: true } },
  seller: { select: { businessNameEn: true, businessNameAr: true, tier: true, rating: true } },
} satisfies Prisma.ProductInclude;

/**
 * The one place the catalog list shape is defined. Hoisted out of listProducts so
 * the row type can be named: the refusal path below returns an empty page of the
 * same shape, and callers must not have to discriminate two different arrays.
 */
function findProductPage(
  where: Prisma.ProductWhereInput,
  skip: number,
  take: number,
  orderBy: Prisma.ProductOrderByWithRelationInput,
) {
  return db.product.findMany({ where, skip, take, orderBy, include: PRODUCT_LIST_INCLUDE });
}

/** A tile as the database returns it, before the review aggregate is attached. */
export type ProductListRowBase = Awaited<ReturnType<typeof findProductPage>>[number];

/**
 * A product's standing, as the star rating on a tile.
 *
 * `average` is rounded to two decimals for display; the ranking that orders the
 * "Top Rated" section is done on the unrounded aggregate in SQL, so rounding
 * here can never change which products are chosen — only how the chosen ones
 * are printed.
 */
export interface ProductRating {
  average: number;
  count: number;
}

/**
 * Shape one grouped aggregate into a rating, or into NOTHING.
 *
 * null and 0 are different claims. "0 stars" says buyers rated this product and
 * hated it; "no rating" says nobody has rated it yet. A tile that renders an
 * empty five-star row for an unreviewed product is stating the first while
 * meaning the second, which is a lie about a seller's goods. So: no reviews, no
 * rating object, and the UI decides what to draw in its place.
 *
 * A non-finite average with a positive count is a data fault, not a rating —
 * it is refused for the same reason, rather than printed as NaN stars.
 */
export function shapeProductRating(average: number | null | undefined, count: number): ProductRating | null {
  if (!Number.isFinite(count) || count <= 0) return null;
  if (average == null || !Number.isFinite(average)) return null;
  return { average: Math.round(average * 100) / 100, count };
}

/**
 * Attach each row's review aggregate using ONE grouped query for the whole page.
 *
 * Not a per-row aggregate: this runs on the busiest route in the storefront, and
 * a rating lookup per tile is twenty round trips per page view. `groupBy` returns
 * only products that actually have reviews, so every id missing from the result
 * is genuinely unreviewed and gets `rating: null` — the absence is the answer,
 * not a failure to look.
 *
 * No visibility filter on the reviews themselves: ProductReview has no status or
 * moderation column, and the product detail page counts them unfiltered too. If
 * one is ever added, it must be added in both places or the tile and the detail
 * page will disagree about the same product.
 */
export async function attachProductRatings<T extends { id: string }>(
  rows: T[],
): Promise<Array<T & { rating: ProductRating | null }>> {
  if (rows.length === 0) return [];
  const groups = await db.productReview.groupBy({
    by: ["productId"],
    where: { productId: { in: rows.map((row) => row.id) } },
    _avg: { rating: true },
    _count: { rating: true },
  });
  const byProduct = new Map(groups.map((group) => [group.productId, group]));
  return rows.map((row) => {
    const group = byProduct.get(row.id);
    return { ...row, rating: group ? shapeProductRating(group._avg.rating, group._count.rating) : null };
  });
}

export type ProductListRow = ProductListRowBase & { rating: ProductRating | null };

/**
 * The relevance tiers, most relevant first. In a B2B marketplace an exact part
 * number hit is result #1 — never row 40 behind an unrelated newer product,
 * which is all `createdAt desc` alone could promise.
 */
function searchTiers(outcome: CatalogSearchOutcome): Prisma.ProductWhereInput[] {
  if (outcome.status !== "ran") return [];
  const tiers: Prisma.ProductWhereInput[] = [];
  if (outcome.strategy !== "text") {
    tiers.push(exactIdentifierWhere(outcome.term));
    if (outcome.term.length >= MIN_IDENTIFIER_PREFIX_LENGTH) tiers.push(prefixIdentifierWhere(outcome.term));
  }
  if (outcome.strategy !== "identifier") tiers.push(freeTextWhere(outcome.term));
  // Brand goes last — see brandIdentifierWhere for why its nullable FK must
  // never appear in another tier's exclusion.
  if (outcome.strategy !== "text") tiers.push(brandIdentifierWhere(outcome.term));
  return tiers;
}

export async function listProducts(params: ProductListParams) {
  const { page = 1, limit = 20, search, categoryId, categorySlug, sellerId, status, b2c, b2b, publiclyDiscoverable, inStock, brandSlug, sort } = params;
  const skip = (page - 1) * limit;
  const searchOutcome = classifyCatalogSearch(search);

  // Refuse, do not list. A term we cannot run is reported as refused with zero
  // results; the caller renders "enter at least N characters". Falling through
  // to an unfiltered query here is what made a failed search look like a
  // successful one — the entire catalog under a confident result count.
  if (searchOutcome.status === "too_short") {
    return { products: [] as ProductListRow[], total: 0, page, limit, totalPages: 0, search: searchOutcome };
  }

  const categoryIds = categorySlug
    ? await db.$queryRaw<Array<{ id: string }>>`
        WITH RECURSIVE category_tree AS (
          SELECT id FROM "Category" WHERE slug = ${categorySlug} AND "isActive" = true
          UNION ALL
          SELECT child.id
          FROM "Category" child
          INNER JOIN category_tree parent ON child."parentId" = parent.id
          WHERE child."isActive" = true
        )
        SELECT id FROM category_tree
      `.then((rows) => rows.map(({ id }) => id))
    : undefined;

  const baseWhere: Prisma.ProductWhereInput = {
    deletedAt: null,
    // In baseWhere on purpose: every tier predicate and every count() below is
    // built from this object, so the page rows and the total that paginates
    // them are filtered by the same rule. A filter applied to the rows alone
    // would produce a page count that does not match them.
    seller: PUBLIC_CATALOG_SELLER,
    ...(publiclyDiscoverable !== undefined && { isPubliclyDiscoverable: publiclyDiscoverable }),
    ...(status && { status }),
    ...(categoryId && { categoryId }),
    // Pilot imports attach products to leaf categories at varying depths.
    // Resolve the full active subtree so every advertised parent category is
    // a truthful browse path, not an exact-slug dead end.
    ...(categoryIds && { categoryId: { in: categoryIds } }),
    ...(sellerId && { sellerId }),
    ...(b2c !== undefined && { isB2CEnabled: b2c }),
    ...(b2b !== undefined && { isB2BEnabled: b2b }),
    ...(inStock && { inventory: { some: { qty: { gt: 0 } } } }),
    // `is` rather than a bare relation filter: Product.brandId is nullable, and
    // a product with no brand must not match a brand filter.
    ...(brandSlug && { brand: { is: { slug: brandSlug } } }),
  };

  // Each tier subtracts every tier above it, so the tiers partition the result
  // set: their counts sum to the true total exactly once per product, and
  // reading them in order gives a stable global ranking that pagination can
  // walk. Without a search there is one tier and this is the original query.
  const tiers = searchTiers(searchOutcome);
  const tierWheres: Prisma.ProductWhereInput[] = tiers.length === 0
    ? [baseWhere]
    : tiers.map((tier, index) => ({
        ...baseWhere,
        AND: index === 0 ? [tier] : [tier, { NOT: { OR: tiers.slice(0, index) } }],
      }));

  // The caller's sort is the tiebreak WITHIN a tier, so "Newest" and "Name A–Z"
  // keep working; they just no longer outrank an exact part-number match.
  const orderBy: Prisma.ProductOrderByWithRelationInput =
    sort === "name_asc" ? { nameEn: "asc" } : { createdAt: "desc" };

  // Catalog listing is a "must stay up" read: run it through the resilience
  // layer with a short-lived, stale-on-failure cache so a DB blip degrades to
  // last-known-good results instead of a 500 on the browse/search path.
  const cacheKey = `products:list:${JSON.stringify({ page, limit, sort, tierWheres })}`;
  const { data } = await read(
    async () => {
      // With one tier — the un-searched catalog listing, the hottest read on the
      // site — the page query does not depend on the count: that tier is always
      // read at `skip`. Issue both in the same round trip, as this path did
      // before tiering, instead of paying count-then-query serially. Both live
      // in one Promise.all so neither rejection is ever unhandled.
      const countsPromise: Promise<number[]> = Promise.all(
        tierWheres.map((tierWhere) => db.product.count({ where: tierWhere })),
      );
      const singleTierPromise: Promise<ProductListRowBase[] | null> =
        tierWheres.length === 1
          ? Promise.resolve(findProductPage(tierWheres[0], skip, limit, orderBy))
          : Promise.resolve(null);
      const [counts, singleTierRows] = await Promise.all([countsPromise, singleTierPromise]);
      const total = counts.reduce((sum, count) => sum + count, 0);
      if (singleTierRows) {
        const products = await attachProductRatings(singleTierRows);
        return { products, total, page, limit, totalPages: Math.ceil(total / limit), search: searchOutcome };
      }

      // Walk the tiers in rank order, consuming `skip` against each tier's size
      // before reading from it, so a page can straddle a tier boundary without
      // repeating or dropping a row.
      const collected: ProductListRowBase[] = [];
      let offset = skip;
      let remaining = limit;
      for (const [index, tierWhere] of tierWheres.entries()) {
        if (remaining <= 0) break;
        const count = counts[index];
        if (offset >= count) {
          offset -= count;
          continue;
        }
        const rows = await findProductPage(tierWhere, offset, remaining, orderBy);
        collected.push(...rows);
        remaining -= rows.length;
        offset = 0;
      }

      // One aggregate for the whole page, after the tiers have been assembled —
      // not one per tier, which would put a query inside the loop.
      const products = await attachProductRatings(collected);
      return { products, total, page, limit, totalPages: Math.ceil(total / limit), search: searchOutcome };
    },
    { name: "products.list", cache: { key: cacheKey, ttlMs: 60_000 } },
  );

  return data;
}

export async function getProductBySlug(
  slug: string,
  channel: "B2C" | "B2B" = "B2C",
  currency?: Currency,
) {
  // findFirst, not findUnique: slug is unique so this is the same index lookup,
  // but the seller predicate is a relation filter and findFirst takes it without
  // relying on extended-unique-where semantics.
  const product = await db.product.findFirst({
    // Same seller rule as the listing: a product the storefront will not list
    // must not be reachable by deep link either, or the indexed URL outlives
    // the listing and lands on an item checkout will refuse.
    where: { slug, deletedAt: null, seller: PUBLIC_CATALOG_SELLER },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      prices: { where: { isActive: true }, orderBy: [{ type: "asc" }, { minQty: "asc" }] },
      inventory: { include: { location: { include: { warehouse: true } } } },
      category: true,
      brand: true,
      // Not `rating`/`reviewCount`: nothing writes those SellerProfile columns
      // (no service updates them and the seed no longer does), so selecting
      // them would print a number nobody vouches for. The seller's standing is
      // aggregated from ProductReview below instead.
      seller: { select: { id: true, businessNameEn: true, businessNameAr: true, tier: true, city: true, country: true } },
      compliance: { where: { status: "APPROVED" } },
      variants: { include: { prices: { where: { isActive: true } } } },
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { user: { select: { firstName: true, lastName: true } } },
      },
      // The page shows the newest twenty above and must not present that
      // window's length as the total. ProductReview has no status or
      // visibility column and the window applies no filter, so the count
      // needs none either — if a filter is ever added to `reviews`, mirror
      // it here as `reviews: { where }` or the two will disagree again.
      _count: { select: { reviews: true } },
    },
  });
  if (!product) return null;
  // The seller's standing across every product they list — the same aggregate
  // the seller portal's performance page and the admin seller detail run, so
  // the three portals show one number. No visibility filter: ProductReview has
  // none, and the product's own `reviews` window above applies none either.
  const sellerReviews = await db.productReview.aggregate({
    where: { product: { sellerId: product.sellerId } },
    _avg: { rating: true },
    _count: { _all: true },
  });
  const { inventory, variants, prices, _count, seller, ...safe } = product;
  return {
    ...safe,
    seller: {
      ...seller,
      reviewSummary: {
        // null, not 0, when there is nothing to average: the page then shows
        // no rating at all rather than a zero-star seller.
        averageRating: sellerReviews._count._all > 0 ? sellerReviews._avg.rating : null,
        reviewCount: sellerReviews._count._all,
      },
    },
    reviewTotal: _count.reviews,
    prices: prices.filter((price) => price.type === channel && (!currency || price.currency === currency)),
    inventory: inventory.map((stock) => ({
      variantId: stock.variantId,
      available: Math.max(0, stock.qty - stock.reservedQty),
    })),
    variants: variants.map((variant) => ({
      ...variant,
      prices: variant.prices.filter((price) => price.type === channel && (!currency || price.currency === currency)),
    })),
  };
}

export async function getSellerDashboard(sellerId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const [
    todayOrderCount,
    pendingOrders,
    lowStockItems,
    issueCount,
    pendingCompliance,
    pendingPayout,
    activeListings,
    recentOrders,
    unreadMessages,
    rfqCount,
  ] = await Promise.all([
    db.orderItem.count({ where: { sellerId, order: { createdAt: { gte: today } } } }),
    db.orderItem.count({ where: { sellerId, status: "PROCESSING" } }),
    // Count low-stock items using raw SQL for cross-column comparison
    db.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*)::bigint as count FROM "InventoryStock" WHERE "productId" IN (SELECT id FROM "Product" WHERE "sellerId" = ${sellerId}) AND qty <= "reorderPoint"`.then((r) => Number(r[0]?.count ?? 0)),
    db.productIssue.count({ where: { product: { sellerId }, resolvedAt: null } }),
    db.sellerDocument.count({ where: { sellerId, status: "PENDING_REVIEW" } }),
    db.sellerPayout.aggregate({ where: { sellerId, status: "PENDING" }, _sum: { amount: true } }),
    db.product.count({ where: { sellerId, status: "ACTIVE", deletedAt: null } }),
    db.order.findMany({
      where: { items: { some: { sellerId } } },
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, orderNumber: true, status: true, currency: true, createdAt: true, type: true,
        items: { where: { sellerId }, select: { total: true } },
      },
    }),
    // Both badges are counted the way their destination counts and lists —
    // the messaging service's own unread count (the /messages header uses the
    // same call) and the rfq service's inbox predicate (getRFQsForSeller
    // lists with it) — so a badge can never promise rows the page lacks. The
    // old RFQ predicate ("assigned to me AND still SUBMITTED") was empty by
    // construction: submitQuote is the only writer of sellerId and it sets
    // QUOTED in the same update.
    countSellerUnreadMessages(sellerId),
    db.rFQRequest.count({ where: SELLER_RFQ_INBOX_WHERE(sellerId) }),
  ]);

  const monthRevenue = await db.orderItem.aggregate({
    where: { sellerId, order: { createdAt: { gte: monthStart }, paymentStatus: "PAID" } },
    _sum: { total: true },
  });

  return {
    todayOrderCount,
    pendingOrders,
    lowStockItems,
    issueCount,
    pendingCompliance,
    pendingPayoutAmount: pendingPayout._sum.amount ?? 0,
    activeListings,
    monthRevenue: monthRevenue._sum.total ?? 0,
    recentOrders: recentOrders.map(({ items, ...order }) => ({
      ...order,
      total: items.reduce((sum, item) => sum + Number(item.total), 0),
    })),
    unreadMessages,
    rfqCount,
  };
}
