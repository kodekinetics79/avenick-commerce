import { z } from "zod";

import type { PageMeta, ProductCard, ProductListQuerySchema } from "@avenick/contracts";
import type { Prisma, ProductListRow } from "@avenick/database";
import {
  PRODUCT_LIST_INCLUDE,
  PUBLIC_CATALOG_SELLER,
  attachProductRatings,
  db,
  listProducts,
} from "@avenick/database";

import { validationFailed } from "../_lib/errors";
import { encodeRankCursor, keysetCursorKey, parseCursor } from "../_lib/keyset";
import { paginate } from "../_lib/pagination";
import type { Principal } from "../_lib/principal";
import { activeCategorySubtreeIds } from "../categories/category-tree";

import { toProductCard } from "./product-projection";

export type ProductListQuery = z.infer<typeof ProductListQuerySchema>;

/**
 * GET /v1/products, WITHOUT a count().
 *
 * `/api/products` runs `db.product.count()` beside every page query — once per
 * relevance tier — on a public, unauthenticated route sharing a connection pool
 * with checkout's transactions. A phone scrolling a list never needs "how
 * many"; it needs "is there more", and an over-fetched row answers that for the
 * price of one row.
 *
 * There are two paths, and the split is not a convenience:
 *
 *  · THE KEYSET PATH — a plain browse, with or without filters, sorted by
 *    newest / name / MOQ. Every predicate it needs is expressible as a `where`,
 *    so it reads `limit + 1` rows in one query, orders on (sort column, id) and
 *    resumes strictly after the last row it returned. No count, at any depth.
 *
 *  · THE RANKED PATH — a search term, a rating floor, or `sort=rating`. Each of
 *    those needs a predicate that `packages/database/src/services/products.ts`
 *    builds and does NOT export: the four relevance tiers
 *    (`exactIdentifierWhere`, `prefixIdentifierWhere`, `freeTextWhere`,
 *    `brandIdentifierWhere`) and the grouped review aggregate behind
 *    `minRating` / `sort=rating` are module-private. Restating them here would
 *    duplicate the most defect-prone code in that file — the case-folding, the
 *    indexed-vs-trigram tier split, the nullable-brand exclusion rule — and the
 *    copy would drift the first time one of them is tightened. So this path
 *    delegates to `listProducts` and pages it by rank position, keeping the
 *    service's count.
 *
 * MAKING THE SECOND PATH KEYSET TOO IS A ONE-LINE CHANGE IN THE SERVICE:
 * `export` its `searchTiers()` (and the rating ranking beside it). This file
 * was scoped out of `packages/database`, so it is flagged rather than done.
 */

const PUBLIC_LISTING: Prisma.ProductWhereInput = {
  deletedAt: null,
  status: "ACTIVE",
  // The seller rule the whole public catalogue is filtered by, taken from the
  // service rather than restated: a product behind a withdrawn seller that is
  // visible and unbuyable is worse than one that is not listed.
  seller: PUBLIC_CATALOG_SELLER,
};

/** True when the request needs a predicate only `listProducts` can build. */
export function needsRanking(query: ProductListQuery): boolean {
  return query.search !== undefined || query.minRating !== undefined || query.sort === "rating";
}

/**
 * THE CHANNEL DOES NOT FILTER THE CATALOGUE. IT PRICES IT.
 *
 * This reverses an earlier version of this file, and the reversal is the whole
 * point of the channel-aware app, so it is written down rather than left as a
 * diff.
 *
 * That version honoured `isB2CEnabled` as a LISTING filter — `channel=B2C`
 * returned only consumer-sellable products. It was a defensible reading of
 * "respect the flag", and it produced a true and useless result: the pilot
 * importer writes `isB2CEnabled: false` on every row it creates, so the
 * consumer catalogue was EMPTY. A storefront with nothing in it is not a
 * faithful rendering of a quote-only catalogue; it is a broken app.
 *
 * The catalogue is quote-only, so "cannot be added to a basket" is the NORMAL
 * state of a product here, not a reason to hide it. So the listing returns
 * what is publicly discoverable behind a live seller, the channel decides which
 * price bands resolve, and every card carries `sellableInChannel` — which is
 * what the app branches on: true shows Add to Cart, false shows Request a
 * Quote (POST /v1/rfqs).
 *
 * The flag is still honoured, and honoured harder than before: it is now STATED
 * per row rather than silently narrowing a result set, and `secureCreateOrder`
 * refuses an order for a false one regardless. What is gone is the pretence
 * that an unsellable product is an invisible one.
 *
 * Both channels are treated the same way for the same reason — a company buyer
 * raising an RFQ for something not B2B-enabled is the original use case of the
 * RFQ table, not an edge case. B2B still needs a live company membership to
 * reach at all; that gate is on the route, because B2B PRICES are private.
 */
function channelWhere(_channel: ProductListQuery["channel"]): Prisma.ProductWhereInput {
  return { isPubliclyDiscoverable: true };
}

async function filterWhere(query: ProductListQuery): Promise<Prisma.ProductWhereInput> {
  const where: Prisma.ProductWhereInput = {
    ...PUBLIC_LISTING,
    ...channelWhere(query.channel),
  };

  if (query.categorySlug) {
    // Imported catalogues hang products off leaf categories, so an exact-slug
    // match makes every advertised parent a dead end. The whole active subtree
    // is resolved, exactly as `listProducts` resolves it.
    where.categoryId = { in: await activeCategorySubtreeIds(query.categorySlug) };
  }
  // `is` rather than a bare relation filter: `brandId` is nullable, and a
  // product with no brand must not match a brand filter.
  if (query.brandSlug) where.brand = { is: { slug: query.brandSlug } };
  if (query.inStock === true) where.inventory = { some: { qty: { gt: 0 } } };
  if (query.inStock === false) where.inventory = { none: { qty: { gt: 0 } } };
  if (query.moqMin != null || query.moqMax != null) {
    where.moq = {
      ...(query.moqMin != null && { gte: query.moqMin }),
      ...(query.moqMax != null && { lte: query.moqMax }),
    };
  }
  return where;
}

type SortKind = Exclude<ProductListQuery["sort"], "rating">;

function orderFor(sort: SortKind): Prisma.ProductOrderByWithRelationInput[] {
  // `id` is appended to every ordering. Without it a sort with many ties — and
  // `moq_asc` is nearly all ties, since moq defaults to 1 — has no defined
  // order in SQL, and a keyset over an undefined order repeats rows on one page
  // and drops them from another.
  return [
    sort === "name_asc" ? { nameEn: "asc" } : sort === "moq_asc" ? { moq: "asc" } : { createdAt: "desc" },
    { id: "asc" },
  ];
}

function sortKeyOf(row: ProductListRow, sort: SortKind): string {
  if (sort === "name_asc") return row.nameEn;
  if (sort === "moq_asc") return String(row.moq);
  return row.createdAt.toISOString();
}

/**
 * "Strictly after (key, id)" in the current ordering, as a Prisma predicate.
 *
 * The tie half is what makes the cursor correct rather than approximately
 * correct: two products created in the same millisecond, or sharing a name, or
 * (routinely) sharing `moq: 1`, are separated by `id` and neither is shown
 * twice nor skipped.
 */
function keysetWhere(sort: SortKind, key: string, id: string): Prisma.ProductWhereInput {
  if (sort === "name_asc") {
    return { OR: [{ nameEn: { gt: key } }, { nameEn: key, id: { gt: id } }] };
  }
  if (sort === "moq_asc") {
    const moq = Number(key);
    if (!Number.isInteger(moq)) throw malformedCursor();
    return { OR: [{ moq: { gt: moq } }, { moq, id: { gt: id } }] };
  }
  const createdAt = new Date(key);
  if (Number.isNaN(createdAt.getTime())) throw malformedCursor();
  return { OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { gt: id } }] };
}

function malformedCursor() {
  return validationFailed("The cursor is not one this endpoint issued.", {
    cursor: ["Send back the `meta.cursor` value from the previous page, unchanged."],
  });
}

export interface CataloguePage {
  data: ProductCard[];
  meta: PageMeta;
}

export async function readCataloguePage(input: {
  query: ProductListQuery;
  principal: Principal | null;
  origin: string;
}): Promise<CataloguePage> {
  const { query, origin } = input;
  return needsRanking(query)
    ? readRankedPage(query, origin)
    : readKeysetPage(query, origin);
}

async function readKeysetPage(query: ProductListQuery, origin: string): Promise<CataloguePage> {
  const sort = query.sort as SortKind;
  const cursor = parseCursor(query.cursor, "keyset");
  const where = await filterWhere(query);
  const scoped: Prisma.ProductWhereInput =
    cursor === null || cursor.mode !== "keyset"
      ? where
      : { ...where, AND: [keysetWhere(sort, cursor.key, cursor.id)] };

  // limit + 1: the extra row is never returned, and its existence IS `hasMore`.
  const rows = await db.product.findMany({
    where: scoped,
    orderBy: orderFor(sort),
    take: query.limit + 1,
    include: PRODUCT_LIST_INCLUDE,
  });
  // One grouped aggregate for the whole page, through the service's own
  // helper — not one rating lookup per tile.
  const rated = await attachProductRatings(rows);

  const page = paginate(rated, query.limit, (row) => keysetCursorKey(sortKeyOf(row, sort), row.id));
  return {
    data: page.data.map((row) => toProductCard(row, query.channel, query.currency, origin)),
    meta: page.meta,
  };
}

async function readRankedPage(query: ProductListQuery, origin: string): Promise<CataloguePage> {
  /*
    `inStock=false` cannot be expressed through `listProducts`: its `baseWhere`
    applies the stock predicate only when the flag is truthy, so passing false
    is a filter that is silently DROPPED — and answering "out of stock only"
    with the whole catalogue under the caller's heading is precisely the defect
    the ignored `b2c` parameter was. Refused with the field named instead.
  */
  if (query.inStock === false) {
    throw validationFailed(
      "Filtering to out-of-stock items cannot be combined with a search or a rating sort.",
      { inStock: ["Drop `search`, `minRating` and `sort=rating`, or drop `inStock=false`."] },
    );
  }

  const cursor = parseCursor(query.cursor, "rank");
  const page = cursor?.mode === "rank" ? cursor.page : 1;

  const result = await listProducts({
    page,
    limit: query.limit,
    search: query.search,
    categorySlug: query.categorySlug,
    brandSlug: query.brandSlug,
    status: "ACTIVE",
    publiclyDiscoverable: true,
    // Deliberately NOT passed: the channel prices the catalogue, it does not
    // narrow it. Passing `b2c`/`b2b` here would make a relevance search return
    // a different set from the same query without one — a search for "bolt"
    // finding nothing while browsing the same category finds four hundred.
    b2c: undefined,
    b2b: undefined,
    inStock: query.inStock === true,
    minRating: query.minRating,
    moqMin: query.moqMin,
    moqMax: query.moqMax,
    sort: query.sort,
    currency: query.currency,
  });

  /*
    A search term the service REFUSED — below the trigram floor and not
    identifier-shaped — comes back as zero rows with `search.status:
    "too_short"`. That is a refusal, not an empty catalogue, and it is
    propagated as one: `hasMore: false` and no cursor, so the app stops rather
    than paging forever through nothing.
  */
  const hasMore = result.products.length > 0 && page * query.limit < result.total;
  return {
    data: result.products.map((row) => toProductCard(row, query.channel, query.currency, origin)),
    meta: { cursor: hasMore ? encodeRankCursor(page + 1) : null, hasMore },
  };
}
