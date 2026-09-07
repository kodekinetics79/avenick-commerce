import { db } from "../index";
import { read } from "../resilient-ops";
import {
  PRODUCT_LIST_INCLUDE,
  attachProductRatings,
  shapeProductRating,
  type ProductListRow,
  type ProductListRowBase,
  type ProductRating,
} from "./products";
import {
  SALE_COUNTING_ORDER_STATUSES,
  orderRowsByIds,
  publicProductWhere,
  sectionSize,
} from "./storefront-sections";
import type { PaymentStatus, Prisma } from "@prisma/client";

/**
 * The recommendation layer behind the sales surfaces: "Related products" on a
 * product page, "Others also bought" beside it, and "Complete your order" in
 * the cart.
 *
 * Two kinds of evidence exist in this schema, and this module keeps them apart
 * because they support different claims:
 *
 *  · AFFINITY is what is TRUE OF THE CATALOGUE: two products share a leaf
 *    category, a category family, a brand, or tags. It is available for every
 *    product from the day it is listed, and it supports the claim "related".
 *  · CO-PURCHASE is what BUYERS DID: two products in the same paid basket, by
 *    enough different buyers to be a pattern. It supports the claim "others
 *    also bought" — and nothing else does. Today (12 orders, 3 of them with
 *    more than one product) it is near-empty, and the functions say so by
 *    returning [].
 *
 * The rules, inherited from storefront-sections.ts and product-signals.ts:
 *
 *  · A FUNCTION RETURNS ONLY WHAT ITS NAME CLAIMS. `getBoughtTogether` never
 *    falls back to related products: a rail of category neighbours under a
 *    "bought together" header is a lie the UI cannot detect. The CALLER chooses
 *    what to render when a source is empty, and can therefore label it.
 *  · NOT ENOUGH EVIDENCE IS AN EMPTY LIST. Nothing here pads a rail with
 *    "some products". Related is empty when nothing shares a category or a
 *    brand; bought-together is empty below a support threshold and a quorum.
 *  · IT SHOWS ONLY WHAT THE CATALOGUE WOULD SHOW. Every candidate passes
 *    `publicProductWhere` — imported, not restated — at candidate time and
 *    again at fetch time, so a withdrawn product or a suspended seller cannot
 *    appear on a product page as a recommendation.
 *  · IT IS BOUNDED BY THE RAIL, NOT BY THE CATALOGUE. Candidate generation is
 *    a fixed number of capped queries; scoring happens in memory on lightweight
 *    rows; there is no per-product query anywhere in this file. The product
 *    page and the cart are the two hottest paths after the home page.
 *
 * Every ranking decision is a pure function over plain rows so the trade-offs
 * are unit-tested without a database.
 */

// ─── AFFINITY WEIGHTS ─────────────────────────────────────────────────────────

/**
 * The affinity score is a SUM of signals, but the weights are powers of two
 * chosen so that each signal outweighs every weaker signal COMBINED:
 *
 *   leaf (16) > family (8) + brand (4) + tags (max 3) = 15
 *   family (8) > brand (4) + tags (max 3) = 7
 *   brand (4) > tags (max 3)
 *
 * The consequence is a strict precedence — a product in the same leaf category
 * always outranks one that is not, whatever brand or tags the other shares —
 * while the weaker signals still ORDER products within a tier. Tags are added
 * only on top of a category or brand match; alone they score nothing. That is what
 * "related" means on a product page: more of the same kind first, and among
 * those, the same brand first. A flat sum without this property lets a
 * coalition of weak matches (same brand, three shared words) outvote the
 * taxonomy, which is the catalogue's own statement of what a product is.
 */
export const AFFINITY_SAME_LEAF_CATEGORY = 16;

/**
 * One level apart in the category tree: a sibling category (same parent), the
 * anchor's parent category itself, or a child of the anchor's category. All
 * three are "the next shelf over"; anything further up the tree is a
 * department, not a relation, and is not scored.
 */
export const AFFINITY_SAME_CATEGORY_FAMILY = 8;

/** Same brand. A structured attribute, unlike tags — hence above them. */
export const AFFINITY_SAME_BRAND = 4;

/** Per shared tag, after normalisation, up to MAX_SCORED_SHARED_TAGS. */
export const AFFINITY_SHARED_TAG = 1;

/**
 * Tags are seller-entered free text with no vocabulary (the seller form takes
 * up to twenty comma-separated words), and the imported catalogue carries
 * provenance markers — "pilot-catalog", "source:<sheet>", "demo-enriched" —
 * that most of the 385 products share. Two things follow:
 *
 *  · Tags never SOURCE a candidate. A product whose only link to the anchor is
 *    a shared tag is not fetched (see affinityTierWheres): with "pilot-catalog"
 *    on nearly everything, a tag tier would make every product related to every
 *    other and the rail could never be honestly empty. Tags only ORDER products
 *    that already share a category or a brand.
 *  · Shared tags are capped at three, worth less than one brand match, so a
 *    seller who stamps twenty products with the same twenty words cannot buy
 *    a rank with them.
 *
 * If merchandising tags arrive, promoting them to a candidate source needs a
 * rarity weight (a tag on 300 products says nothing; a tag on 3 says a lot),
 * which needs an unnest aggregate this file does not run today.
 */
export const MAX_SCORED_SHARED_TAGS = 3;

// ─── POOLS AND THRESHOLDS ─────────────────────────────────────────────────────

/**
 * Candidates fetched per affinity tier, per anchor.
 *
 * The rail shows at most MAX_SECTION_SIZE (24) tiles; the pool must be larger
 * than the rail so the tiebreaks — brand, tags, rating, recency — have a field
 * to order, and 64 keeps three tiers in parallel under two hundred six-column
 * rows. THE BOUND, stated: in a tier with more than 64 products the newest 64
 * are scored, so an older product in a large category can be passed over for a
 * newer, equally related one. The pool is ordered newest-first because that is
 * the direction of the recency tiebreak; the bound is blind only to rating.
 */
export const AFFINITY_TIER_POOL = 64;

/** Ceiling per tier for a basket, however many anchors it holds. */
export const MAX_AFFINITY_TIER_POOL = 192;

/**
 * Basket lines considered by the cart, in the order the caller gives them. A
 * basket larger than this is scored on its first 24 distinct products; the
 * predicate lists and the pairwise scoring loop are bounded by it.
 */
export const MAX_BASKET_ANCHORS = 24;

/**
 * Distinct BUYERS who put the two products in the same paid basket before the
 * pair counts as a co-purchase.
 *
 * Two, and it is the smallest number at which "others also bought" is a true
 * sentence: at one, the rail repeats a single buyer's single basket back to the
 * next visitor as if it were a pattern. It is not higher because a sale here is
 * expensive evidence — it requires a paid order that was not cancelled,
 * refunded or returned — and a threshold of five would keep the rail dark long
 * after genuine pairs existed. Support counts BUYERS (a company, or a consumer),
 * not orders and not lines: one B2B customer's standing monthly order is one
 * buyer's habit, and two variants of one product on one order are one purchase.
 */
export const MIN_CO_PURCHASE_SUPPORT = 2;

/**
 * Qualifying products before a "bought together" rail may render at all.
 *
 * Two. Unlike Trending, this rail is a claim of MEMBERSHIP ("these were bought
 * with it") more than of order, so it does not need the three that a ranking
 * needs to mean anything; but a plural header over a single tile reads as a
 * bug, and one product is an anecdote wearing that header. Measured on the
 * qualifying set before the cut to `limit`, as every quorum in this codebase is.
 */
export const MIN_BOUGHT_TOGETHER_PRODUCTS = 2;

/**
 * Most recent co-purchase lines scanned per request.
 *
 * The co-occurrence read joins OrderItem to Order and Product on a public
 * route; it must cost the same whether the anchor sold twelve times or twelve
 * thousand. At ~5 lines a basket this is a few hundred recent baskets, more
 * than enough to establish support of two many times over, and it makes the
 * signal "recently bought together" for a high-volume product. Truncation can
 * only UNDERCOUNT — it can hide a pattern, never invent one.
 */
export const CO_PURCHASE_LINE_POOL = 1000;

/**
 * Payment outcomes that void a sale whatever the order status says. This
 * mirrors the unexported NON_SALE_PAYMENT_STATUSES in storefront-sections.ts
 * (which owns the definition of a sale, alongside SALE_COUNTING_ORDER_STATUSES
 * that IS imported above); the two must be kept in step until that constant is
 * exported and this copy deleted.
 */
const NON_SALE_PAYMENT_STATUSES: PaymentStatus[] = ["REFUNDED", "FAILED"];

/** cuid/uuid shaped, as product-signals.ts checks. Anything else never reaches a query. */
const PRODUCT_ID_SHAPE = /^[A-Za-z0-9_-]{1,64}$/;

// ─── PURE AFFINITY ────────────────────────────────────────────────────────────

/** What affinity is computed from: the anchor, or a candidate, stripped to its taxonomy. */
export interface AffinityAnchor {
  id: string;
  categoryId: string;
  /** The category's parent, or null at the root. */
  categoryParentId: string | null;
  brandId: string | null;
  tags: string[];
}

/** A candidate carries what the tiebreaks need on top of its taxonomy. */
export interface AffinityCandidate extends AffinityAnchor {
  createdAt: Date;
  /** The review aggregate, or null when unreviewed — never a fabricated zero. */
  rating: ProductRating | null;
}

/**
 * Tags compared case-insensitively and trimmed: "Steel", " steel" and "STEEL"
 * are one tag. Empty strings vanish. The DATABASE tier queries do not use tags
 * at all (see MAX_SCORED_SHARED_TAGS), so no query is made looser by this.
 */
export function normaliseTags(tags: readonly string[] | null | undefined): Set<string> {
  const out = new Set<string>();
  for (const tag of tags ?? []) {
    const clean = typeof tag === "string" ? tag.trim().toLowerCase() : "";
    if (clean) out.add(clean);
  }
  return out;
}

interface PreparedAnchor {
  id: string;
  categoryId: string;
  categoryParentId: string | null;
  brandId: string | null;
  tags: Set<string>;
}

function prepare(anchor: AffinityAnchor): PreparedAnchor {
  return {
    id: anchor.id,
    categoryId: anchor.categoryId,
    categoryParentId: anchor.categoryParentId ?? null,
    brandId: anchor.brandId ?? null,
    tags: normaliseTags(anchor.tags),
  };
}

/** One level apart in the tree — and NOT the same leaf, which is scored separately. */
function inCategoryFamily(anchor: PreparedAnchor, candidate: PreparedAnchor): boolean {
  if (!candidate.categoryId || candidate.categoryId === anchor.categoryId) return false;
  // Siblings: the same parent.
  if (anchor.categoryParentId != null && candidate.categoryParentId === anchor.categoryParentId) return true;
  // The candidate sits in the anchor's parent category.
  if (anchor.categoryParentId != null && candidate.categoryId === anchor.categoryParentId) return true;
  // The candidate sits in a child of the anchor's category.
  if (candidate.categoryParentId != null && candidate.categoryParentId === anchor.categoryId) return true;
  return false;
}

function scorePrepared(anchor: PreparedAnchor, candidate: PreparedAnchor): number {
  if (!candidate.id || candidate.id === anchor.id) return 0;
  let score = 0;
  if (candidate.categoryId && candidate.categoryId === anchor.categoryId) {
    score += AFFINITY_SAME_LEAF_CATEGORY;
  } else if (inCategoryFamily(anchor, candidate)) {
    score += AFFINITY_SAME_CATEGORY_FAMILY;
  }
  if (anchor.brandId != null && candidate.brandId === anchor.brandId) score += AFFINITY_SAME_BRAND;
  // No structural relation, no relation: tags cannot make one on their own
  // (see MAX_SCORED_SHARED_TAGS). This is the pure-function half of the rule
  // whose query half is "there is no tag tier" — the two must agree, or the
  // scorer would rank a candidate the pool could never have fetched.
  if (score === 0) return 0;
  let shared = 0;
  for (const tag of candidate.tags) {
    if (anchor.tags.has(tag)) shared += 1;
  }
  score += Math.min(shared, MAX_SCORED_SHARED_TAGS) * AFFINITY_SHARED_TAG;
  return score;
}

/**
 * How related `candidate` is to `anchor`: 0 when they share nothing scored, or
 * when they are the same product. Pure; see the weights above for the order it
 * induces.
 */
export function affinityScore(anchor: AffinityAnchor, candidate: AffinityAnchor): number {
  return scorePrepared(prepare(anchor), prepare(candidate));
}

function createdAtMillis(candidate: AffinityCandidate): number {
  const millis = candidate.createdAt instanceof Date ? candidate.createdAt.getTime() : Number.NaN;
  return Number.isFinite(millis) ? millis : 0;
}

/**
 * The tiebreak among equally related products: rating, then recency, then id.
 *
 * Rated products precede unrated ones, best average first and, between equal
 * averages, the one more buyers agree on. A tiebreak on a rating can only
 * order what has a rating; an unreviewed product is not "zero stars", it is
 * unknown, and it follows the known. Stated consequence: among equals, a
 * poorly rated product precedes an unrated one — the tile shows its stars, so
 * the buyer sees why. Then newest first, as the catalogue itself orders, and
 * then id, because two rows with no defined order reshuffle every time the
 * cache refills.
 */
function compareStanding(a: AffinityCandidate, b: AffinityCandidate): number {
  if (a.rating && !b.rating) return -1;
  if (!a.rating && b.rating) return 1;
  if (a.rating && b.rating) {
    if (b.rating.average !== a.rating.average) return b.rating.average - a.rating.average;
    if (b.rating.count !== a.rating.count) return b.rating.count - a.rating.count;
  }
  const recency = createdAtMillis(b) - createdAtMillis(a);
  if (recency !== 0) return recency;
  return a.id.localeCompare(b.id);
}

/**
 * Rank candidates by affinity to one anchor, most related first.
 *
 * The anchor itself is dropped wherever it appears, duplicates collapse, and a
 * candidate that shares nothing scored is dropped rather than ranked last —
 * "unrelated" is not a position in a related-products list. The empty array is
 * therefore a first-class answer: the product has no category neighbours and no
 * brand-mates, and the rail should not render.
 */
export function rankRelated(anchor: AffinityAnchor, candidates: AffinityCandidate[], limit: number): string[] {
  const prepared = prepare(anchor);
  const seen = new Set<string>();
  const scored: Array<{ candidate: AffinityCandidate; score: number }> = [];
  for (const candidate of candidates) {
    if (!candidate.id || candidate.id === prepared.id || seen.has(candidate.id)) continue;
    seen.add(candidate.id);
    const score = scorePrepared(prepared, prepare(candidate));
    if (score <= 0) continue;
    scored.push({ candidate, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || compareStanding(a.candidate, b.candidate))
    .slice(0, Math.max(0, Math.floor(limit)))
    .map((entry) => entry.candidate.id);
}

// ─── PURE CO-PURCHASE ─────────────────────────────────────────────────────────

/**
 * One line from a paid basket that ALSO contained an anchor product. The
 * co-occurrence itself is established by the query (coPurchaseLineWhere); what
 * remains to decide here is how much of it there is.
 */
export interface CoPurchaseLine {
  productId: string;
  /** The buying party: the company for a B2B order, else the user. */
  buyerId: string;
}

/**
 * Support per product: the number of DISTINCT buyers who bought it in the same
 * basket as an anchor. Anchor products are never their own evidence, and a
 * line without a buyer is a row this function cannot attribute, so it counts
 * for nothing rather than for someone.
 */
export function coPurchaseSupport(lines: CoPurchaseLine[], anchorIds: Iterable<string>): Map<string, number> {
  const anchors = new Set(anchorIds);
  const buyersByProduct = new Map<string, Set<string>>();
  for (const line of lines) {
    if (!line.productId || !line.buyerId || anchors.has(line.productId)) continue;
    let buyers = buyersByProduct.get(line.productId);
    if (!buyers) {
      buyers = new Set();
      buyersByProduct.set(line.productId, buyers);
    }
    buyers.add(line.buyerId);
  }
  return new Map(Array.from(buyersByProduct, ([productId, buyers]) => [productId, buyers.size]));
}

export interface CoPurchaseRankOptions {
  anchorIds: string[];
  /** Distinct buyers a product needs before it counts. Never below 1. */
  minSupport: number;
  /** Qualifying products before anything is returned. Never below 1. */
  minProducts: number;
  limit: number;
}

/**
 * Rank co-purchased products by support, or refuse to.
 *
 * Returns [] whenever fewer than `minProducts` products reach `minSupport`,
 * checked BEFORE the cut to `limit` so a two-tile rail still needs a real set
 * behind it. There is no fallback to anything: a caller that wants to show
 * related products instead must call getRelatedProducts and label the rail
 * accordingly. Ties break on id — the only stable key available without
 * fetching timestamps this rail does not otherwise need.
 */
export function rankCoPurchases(lines: CoPurchaseLine[], opts: CoPurchaseRankOptions): string[] {
  const minSupport = Math.max(1, Math.floor(opts.minSupport));
  const minProducts = Math.max(1, Math.floor(opts.minProducts));
  const qualifying = Array.from(coPurchaseSupport(lines, opts.anchorIds)).filter(
    ([, support]) => support >= minSupport,
  );
  if (qualifying.length < minProducts) return [];
  return qualifying
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, Math.max(0, Math.floor(opts.limit)))
    .map(([productId]) => productId);
}

// ─── PURE CART COMPLETION ─────────────────────────────────────────────────────

export interface CartCompletionRankOptions {
  /** Distinct buyers before a co-purchase counts as evidence. Never below 1. */
  minSupport: number;
  limit: number;
}

/**
 * Rank completions for a basket. The keys, in order:
 *
 *  1. CO-PURCHASE SUPPORT at or above `minSupport` — what other buyers did
 *     beats what the taxonomy implies, and a product bought with a basket item
 *     by enough buyers ranks even if it shares nothing else with the basket.
 *     Support below the bar is not evidence and contributes nothing.
 *  2. BREADTH — how many distinct basket items the candidate is related to. A
 *     product related to three of the things being bought is a better
 *     completion than one related strongly to one of them.
 *  3. TOTAL AFFINITY across the basket, then the standing tiebreak.
 *
 * Basket items are excluded; a product with neither qualifying support nor any
 * affinity is dropped, never ranked last. A support entry with no candidate row
 * is ignored: the row is how a product proves it is still visible.
 */
export function rankCartCompletions(
  basket: AffinityAnchor[],
  candidates: AffinityCandidate[],
  coPurchase: ReadonlyMap<string, number>,
  opts: CartCompletionRankOptions,
): string[] {
  const minSupport = Math.max(1, Math.floor(opts.minSupport));
  const anchorsById = new Map<string, PreparedAnchor>();
  for (const item of basket) {
    if (item.id && !anchorsById.has(item.id)) anchorsById.set(item.id, prepare(item));
  }
  const anchors = Array.from(anchorsById.values());

  const ranked: Array<{ candidate: AffinityCandidate; support: number; breadth: number; affinity: number }> = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (!candidate.id || anchorsById.has(candidate.id) || seen.has(candidate.id)) continue;
    seen.add(candidate.id);
    const prepared = prepare(candidate);
    let breadth = 0;
    let affinity = 0;
    for (const anchor of anchors) {
      const score = scorePrepared(anchor, prepared);
      if (score > 0) {
        breadth += 1;
        affinity += score;
      }
    }
    const rawSupport = coPurchase.get(candidate.id) ?? 0;
    const support = Number.isFinite(rawSupport) && rawSupport >= minSupport ? rawSupport : 0;
    if (breadth === 0 && support === 0) continue;
    ranked.push({ candidate, support, breadth, affinity });
  }

  return ranked
    .sort(
      (a, b) =>
        b.support - a.support ||
        b.breadth - a.breadth ||
        b.affinity - a.affinity ||
        compareStanding(a.candidate, b.candidate),
    )
    .slice(0, Math.max(0, Math.floor(opts.limit)))
    .map((entry) => entry.candidate.id);
}

/**
 * The basket as the cart functions read it: trimmed, id-shaped, de-duplicated,
 * in the caller's order, cut to MAX_BASKET_ANCHORS. Pure, so the cap and the
 * validation are testable.
 */
export function normaliseBasket(productIds: readonly string[] | null | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of productIds ?? []) {
    const id = typeof raw === "string" ? raw.trim() : "";
    if (!id || !PRODUCT_ID_SHAPE.test(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= MAX_BASKET_ANCHORS) break;
  }
  return out;
}

// ─── QUERY SHAPES (pure, so the predicates are testable) ──────────────────────

export interface AffinityTierWheres {
  /** Same leaf category as any anchor. */
  leaf: Prisma.ProductWhereInput;
  /** One level away in the tree from any anchor, excluding the leaf tier. */
  family: Prisma.ProductWhereInput;
  /** Same brand as any anchor, excluding the leaf tier. Null when no anchor has a brand. */
  brand: Prisma.ProductWhereInput | null;
}

/**
 * One predicate per candidate tier, each composed as `AND: [visible, tier]` so
 * the visibility rule is the imported object itself and cannot drift from the
 * catalogue's. The tiers are fetched separately, not as one OR, so that a cap
 * hit on a broad tier (a brand with a thousand products) can never crowd out
 * the leaf tier, which outranks it. Family and brand both exclude the leaf
 * categories so no pool spends its cap on rows another tier already returns.
 * There is no tag tier — see MAX_SCORED_SHARED_TAGS.
 */
export function affinityTierWheres(anchors: AffinityAnchor[], visible: Prisma.ProductWhereInput): AffinityTierWheres {
  const anchorIds = Array.from(new Set(anchors.map((anchor) => anchor.id).filter(Boolean)));
  const categoryIds = Array.from(new Set(anchors.map((anchor) => anchor.categoryId).filter(Boolean)));
  const parentIds = Array.from(
    new Set(anchors.map((anchor) => anchor.categoryParentId).filter((id): id is string => id != null && id !== "")),
  );
  const brandIds = Array.from(
    new Set(anchors.map((anchor) => anchor.brandId).filter((id): id is string => id != null && id !== "")),
  );
  const notAnchor: Prisma.ProductWhereInput = { id: { notIn: anchorIds } };

  // Children of an anchor's category, and siblings of it (children of its
  // parent), are both "products whose parent is one of these".
  const familyParents = Array.from(new Set([...categoryIds, ...parentIds]));
  const familyClauses: Prisma.ProductWhereInput[] = [{ category: { parentId: { in: familyParents } } }];
  if (parentIds.length > 0) familyClauses.push({ categoryId: { in: parentIds } });

  return {
    leaf: { AND: [visible, { ...notAnchor, categoryId: { in: categoryIds } }] },
    family: { AND: [visible, { ...notAnchor, categoryId: { notIn: categoryIds }, OR: familyClauses }] },
    brand:
      brandIds.length > 0
        ? { AND: [visible, { ...notAnchor, categoryId: { notIn: categoryIds }, brandId: { in: brandIds } }] }
        : null,
  };
}

/**
 * Lines that were bought IN THE SAME ORDER as an anchor product, where that
 * order is a sale by the storefront's own definition — the line's status and
 * the order's status both in SALE_COUNTING_ORDER_STATUSES, the payment neither
 * refunded nor failed — and the line's product is publicly visible now. The
 * anchor lines themselves are excluded: they are the condition, not evidence.
 */
export function coPurchaseLineWhere(anchorIds: string[], visible: Prisma.ProductWhereInput): Prisma.OrderItemWhereInput {
  return {
    productId: { notIn: anchorIds },
    status: { in: SALE_COUNTING_ORDER_STATUSES },
    product: visible,
    order: {
      status: { in: SALE_COUNTING_ORDER_STATUSES },
      paymentStatus: { notIn: NON_SALE_PAYMENT_STATUSES },
      items: { some: { productId: { in: anchorIds }, status: { in: SALE_COUNTING_ORDER_STATUSES } } },
    },
  };
}

// ─── READ PATH ────────────────────────────────────────────────────────────────

/** The six columns affinity needs. Never the tile include: that is for winners only. */
const AFFINITY_SELECT = {
  id: true,
  categoryId: true,
  brandId: true,
  tags: true,
  createdAt: true,
  category: { select: { parentId: true } },
} satisfies Prisma.ProductSelect;

type AffinityRow = Prisma.ProductGetPayload<{ select: typeof AFFINITY_SELECT }>;

/** Newest first, then id: the recency tiebreak's direction, and a total order. */
const AFFINITY_POOL_ORDER: Prisma.ProductOrderByWithRelationInput[] = [{ createdAt: "desc" }, { id: "asc" }];

function toAnchor(row: AffinityRow): AffinityAnchor & { createdAt: Date } {
  return {
    id: row.id,
    categoryId: row.categoryId,
    categoryParentId: row.category.parentId,
    brandId: row.brandId,
    tags: row.tags,
    createdAt: row.createdAt,
  };
}

function toCandidate(row: AffinityRow, ratingById: ReadonlyMap<string, ProductRating | null>): AffinityCandidate {
  return { ...toAnchor(row), rating: ratingById.get(row.id) ?? null };
}

/** The three tier pools in one round trip, de-duplicated. Bounded by anchors x AFFINITY_TIER_POOL, capped. */
async function fetchAffinityPool(anchors: AffinityAnchor[], visible: Prisma.ProductWhereInput): Promise<AffinityRow[]> {
  if (anchors.length === 0) return [];
  const tiers = affinityTierWheres(anchors, visible);
  const take = Math.min(MAX_AFFINITY_TIER_POOL, AFFINITY_TIER_POOL * anchors.length);
  const pool = (where: Prisma.ProductWhereInput | null): Promise<AffinityRow[]> =>
    where
      ? db.product.findMany({ where, take, orderBy: AFFINITY_POOL_ORDER, select: AFFINITY_SELECT })
      : Promise.resolve([]);
  const [leaf, family, brand] = await Promise.all([pool(tiers.leaf), pool(tiers.family), pool(tiers.brand)]);
  const byId = new Map<string, AffinityRow>();
  for (const row of [...leaf, ...family, ...brand]) {
    if (!byId.has(row.id)) byId.set(row.id, row);
  }
  return Array.from(byId.values());
}

/**
 * One grouped review aggregate for a whole candidate pool, shaped exactly as
 * attachProductRatings shapes a tile's rating. Fetched for the POOL rather than
 * the winners because rating is a tiebreak: it must be known before the
 * winners are chosen, and the same map then rates the winning rows without a
 * second aggregate.
 */
async function fetchRatings(ids: string[]): Promise<Map<string, ProductRating | null>> {
  const byId = new Map<string, ProductRating | null>();
  if (ids.length === 0) return byId;
  const groups = await db.productReview.groupBy({
    by: ["productId"],
    where: { productId: { in: ids } },
    _avg: { rating: true },
    _count: { rating: true },
  });
  for (const group of groups) byId.set(group.productId, shapeProductRating(group._avg.rating, group._count.rating));
  return byId;
}

/**
 * The winning rows in rank order, re-checked against the visibility predicate
 * at fetch time: the pool and this fetch are milliseconds apart, but a seller
 * can be suspended in between and the tile that renders must satisfy the rule,
 * not merely have satisfied it. orderRowsByIds drops an id whose row vanished
 * and never appends a row that was not ranked.
 */
async function fetchRankedRows(rankedIds: string[], visible: Prisma.ProductWhereInput): Promise<ProductListRowBase[]> {
  if (rankedIds.length === 0) return [];
  const rows: ProductListRowBase[] = await db.product.findMany({
    where: { ...visible, id: { in: rankedIds } },
    take: rankedIds.length,
    include: PRODUCT_LIST_INCLUDE,
  });
  return orderRowsByIds(rows, rankedIds);
}

function withRatings(rows: ProductListRowBase[], ratingById: ReadonlyMap<string, ProductRating | null>): ProductListRow[] {
  return rows.map((row) => ({ ...row, rating: ratingById.get(row.id) ?? null }));
}

/** The most recent CO_PURCHASE_LINE_POOL co-purchase lines for these anchors, attributed to a buyer. */
async function fetchCoPurchaseLines(anchorIds: string[], visible: Prisma.ProductWhereInput): Promise<CoPurchaseLine[]> {
  if (anchorIds.length === 0) return [];
  const lines = await db.orderItem.findMany({
    where: coPurchaseLineWhere(anchorIds, visible),
    select: { productId: true, order: { select: { userId: true, companyId: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: CO_PURCHASE_LINE_POOL,
  });
  // A company is one buyer however many of its users place orders; a consumer
  // is one buyer. "Others" in "others also bought" means other parties.
  return lines.map((line) => ({ productId: line.productId, buyerId: line.order.companyId ?? line.order.userId }));
}

function validProductId(productId: string | null | undefined): string | null {
  const id = typeof productId === "string" ? productId.trim() : "";
  return id && PRODUCT_ID_SHAPE.test(id) ? id : null;
}

/**
 * The channel option every function here takes. THREE-STATE, and undefined
 * means BOTH channels — not B2C. No product in this catalogue has isB2CEnabled
 * set, so a default of true returns zero rows and presents an empty rail as
 * "nothing is related"; that defect has shipped twice already in neighbouring
 * modules. Callers pass a channel only when they genuinely mean to filter.
 */
interface ChannelOption {
  b2c?: boolean;
}

export interface RelatedProductsOptions extends ChannelOption {
  /** Rows in the rail. Clamped by sectionSize (1..24, default 8), like every rail. */
  limit?: number;
}

/**
 * "Related products" for a product page: catalogue neighbours ranked by
 * affinity, in the row shape `listProducts` returns so the existing tile
 * renders them.
 *
 * Empty — and meaning it — when the product does not exist, or shares neither
 * a category family nor a brand with any visible product. The anchor itself
 * need not be publicly visible (its page decided that); every candidate must be.
 *
 * Cost: four round trips, each bounded by the rail and not the catalogue — the
 * anchor's six columns; the three tier pools together; one review aggregate
 * over the pool; the winning rows. Cached 60s per (product, limit, channel).
 */
export async function getRelatedProducts(productId: string, opts: RelatedProductsOptions = {}): Promise<ProductListRow[]> {
  const id = validProductId(productId);
  if (!id) return [];
  const limit = sectionSize(opts.limit);
  const visible = publicProductWhere(opts.b2c);
  const cacheKey = `reco:related:${JSON.stringify({ id, limit, b2c: opts.b2c ?? null })}`;

  const { data } = await read(
    async () => {
      const anchorRow = await db.product.findFirst({ where: { id, deletedAt: null }, select: AFFINITY_SELECT });
      if (!anchorRow) return [] as ProductListRow[];
      const anchor = toAnchor(anchorRow);

      const pool = await fetchAffinityPool([anchor], visible);
      if (pool.length === 0) return [] as ProductListRow[];

      const ratingById = await fetchRatings(pool.map((row) => row.id));
      const rankedIds = rankRelated(
        anchor,
        pool.map((row) => toCandidate(row, ratingById)),
        limit,
      );
      if (rankedIds.length === 0) return [] as ProductListRow[];

      return withRatings(await fetchRankedRows(rankedIds, visible), ratingById);
    },
    { name: "recommendations.related", cache: { key: cacheKey, ttlMs: 60_000 } },
  );

  return data;
}

export interface BoughtTogetherOptions extends ChannelOption {
  /** Rows in the rail. Clamped by sectionSize. */
  limit?: number;
  /** Raise the per-product bar. Never silently lowered below 1. */
  minSupport?: number;
  /** Raise the quorum. Never silently lowered below 1. */
  minProducts?: number;
}

/**
 * "Others also bought": products that shared a paid basket with this one, by
 * at least MIN_CO_PURCHASE_SUPPORT distinct buyers, when at least
 * MIN_BOUGHT_TOGETHER_PRODUCTS products do. Otherwise [] — today, for almost
 * every product, since only three orders in the database hold more than one
 * product. THERE IS NO FALLBACK IN THIS FUNCTION. A caller that wants to fill
 * the space calls getRelatedProducts and labels the rail as related, because
 * that is what it would then be showing.
 *
 * Cost: one bounded join for the lines (the only query when the answer is
 * empty, which is the common case), the winning rows, and their ratings.
 * Cached 120s: purchase patterns move at the speed of orders, not page views.
 */
export async function getBoughtTogether(productId: string, opts: BoughtTogetherOptions = {}): Promise<ProductListRow[]> {
  const id = validProductId(productId);
  if (!id) return [];
  const limit = sectionSize(opts.limit);
  const minSupport = Math.max(1, Math.floor(opts.minSupport ?? MIN_CO_PURCHASE_SUPPORT));
  const minProducts = Math.max(1, Math.floor(opts.minProducts ?? MIN_BOUGHT_TOGETHER_PRODUCTS));
  const visible = publicProductWhere(opts.b2c);
  const cacheKey = `reco:boughtTogether:${JSON.stringify({ id, limit, minSupport, minProducts, b2c: opts.b2c ?? null })}`;

  const { data } = await read(
    async () => {
      const lines = await fetchCoPurchaseLines([id], visible);
      const rankedIds = rankCoPurchases(lines, { anchorIds: [id], minSupport, minProducts, limit });
      if (rankedIds.length === 0) return [] as ProductListRow[];
      return attachProductRatings(await fetchRankedRows(rankedIds, visible));
    },
    { name: "recommendations.boughtTogether", cache: { key: cacheKey, ttlMs: 120_000 } },
  );

  return data;
}

export interface CartCompletionsOptions extends ChannelOption {
  /** Rows in the rail. Clamped by sectionSize. */
  limit?: number;
  /** Raise the co-purchase bar. Never silently lowered below 1. */
  minSupport?: number;
}

/**
 * "Complete your order" for a basket: the union of catalogue affinity across
 * every basket item, plus co-purchase evidence where it exists, with the basket
 * itself excluded. Ranked by rankCartCompletions — co-purchase support first,
 * then how many basket items a candidate relates to, then how strongly.
 *
 * There is no quorum here: this rail's header claims neither a ranking nor a
 * purchase pattern, only that the products go with the basket, and a single
 * truthful suggestion is worth showing. The support threshold still applies —
 * one buyer's basket is not evidence — and below it a co-purchase contributes
 * nothing. Empty when the basket is empty or unknown and nothing is related.
 *
 * Cost: four round trips, all bounded — the basket's rows together with its
 * co-purchase lines; the three tier pools; rows for co-purchased products
 * outside the pool together with one review aggregate; the winners. There is
 * no per-item query: a basket of twenty costs the same round trips as a basket
 * of one. Cached 60s per (sorted basket, limit, channel, threshold).
 */
export async function getCartCompletions(productIds: string[], opts: CartCompletionsOptions = {}): Promise<ProductListRow[]> {
  const basketIds = normaliseBasket(productIds);
  if (basketIds.length === 0) return [];
  const limit = sectionSize(opts.limit);
  const minSupport = Math.max(1, Math.floor(opts.minSupport ?? MIN_CO_PURCHASE_SUPPORT));
  const visible = publicProductWhere(opts.b2c);
  const cacheKey = `reco:cart:${JSON.stringify({
    ids: [...basketIds].sort(),
    limit,
    minSupport,
    b2c: opts.b2c ?? null,
  })}`;

  const { data } = await read(
    async () => {
      const [anchorRows, lines] = await Promise.all([
        db.product.findMany({ where: { id: { in: basketIds }, deletedAt: null }, select: AFFINITY_SELECT }),
        fetchCoPurchaseLines(basketIds, visible),
      ]);
      const anchors = anchorRows.map(toAnchor);
      const support = coPurchaseSupport(lines, basketIds);
      const supportedIds = Array.from(support)
        .filter(([, buyers]) => buyers >= minSupport)
        .map(([supportedId]) => supportedId);

      const pool = await fetchAffinityPool(anchors, visible);
      const poolIds = new Set(pool.map((row) => row.id));
      // A co-purchased product outside the affinity pool still needs a row —
      // for its tiebreaks, and as proof it is visible right now.
      const unpooledIds = supportedIds.filter((supportedId) => !poolIds.has(supportedId));
      const [unpooledRows, ratingById] = await Promise.all([
        unpooledIds.length > 0
          ? db.product.findMany({ where: { ...visible, id: { in: unpooledIds } }, select: AFFINITY_SELECT })
          : Promise.resolve([] as AffinityRow[]),
        fetchRatings([...poolIds, ...unpooledIds]),
      ]);

      const rankedIds = rankCartCompletions(
        anchors,
        [...pool, ...unpooledRows].map((row) => toCandidate(row, ratingById)),
        support,
        { minSupport, limit },
      );
      if (rankedIds.length === 0) return [] as ProductListRow[];

      return withRatings(await fetchRankedRows(rankedIds, visible), ratingById);
    },
    { name: "recommendations.cart", cache: { key: cacheKey, ttlMs: 60_000 } },
  );

  return data;
}
