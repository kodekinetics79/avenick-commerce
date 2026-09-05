/**
 * THE DISCOVERY RECOMMENDER — all of its reasoning, with no DOM, no React, no
 * network and no clock of its own.
 *
 * This module is the whole brain of the discovery panel. Everything it decides
 * is a pure function of (a) signals this browser recorded about itself, (b) rows
 * a server component handed down, and (c) a `now` passed in by the caller. That
 * is deliberate: a recommender that cannot be run in a test is a recommender
 * nobody can audit, and an unauditable suggestion on a trade platform is
 * indistinguishable from a random product.
 *
 * THREE RULES THIS FILE ENFORCES, because the UI cannot be trusted to remember
 * them:
 *
 *   1. NOTHING IS CLAIMED WITHOUT A BASIS. Every block the planner emits carries
 *      a `reason` describing the exact signal that produced it, and the counts
 *      in that reason are the counts that were actually scored. The panel is
 *      required to print it. There is no code path that produces a block with no
 *      reason, because the type does not allow one.
 *
 *   2. ONE DATA POINT IS NOT A PATTERN. A single product view does not license
 *      "you seem interested in Wiring Devices" — MIN_HITS_TO_CLAIM is the floor,
 *      and below it the planner reports `needsMoreSignal` and the panel says so
 *      plainly instead of padding itself out.
 *
 *   3. AN UNNAMEABLE THING IS NOT SHOWN. A category we hold a slug for but no
 *      display name, or a brand we hold a name for but no catalogue slug to
 *      filter on, produces NO block. Humanising "wiring-devices" into "Wiring
 *      Devices" would be a guess, and a link built from a guessed slug is a
 *      promise the catalogue has not agreed to keep.
 *
 * RECENCY. Interest decays with a half-life rather than being a raw tally, so a
 * category opened three times this morning outranks one opened four times last
 * week — which is the entire difference between "what you are buying today" and
 * "what you once bought".
 */

/** Products kept in the local trail. Twenty is a browsing session, not a dossier. */
export const VIEW_LIMIT = 20;
/** Category browse events kept. */
export const CATEGORY_VISIT_LIMIT = 40;
/** Distinct search terms kept. */
export const SEARCH_LIMIT = 5;

/** Signals older than this are dropped on every read and write. */
export const SIGNAL_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Interest halves every three days. Chosen, not tuned: a trade buyer's job
 * changes between weeks and not between hours, and a half-life much shorter
 * than this makes the panel lurch after a single stray click.
 */
export const HALF_LIFE_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * The same category or term arriving again inside this window is the same
 * visit — a filter change, a page-2 click, a back button — not a second
 * expression of interest. Without it, paginating a category would manufacture
 * a "dominant interest" out of one browse.
 */
export const VISIT_DEBOUNCE_MS = 5 * 60 * 1000;

/** Below this, an interest is a coincidence and is not claimed. */
export const MIN_HITS_TO_CLAIM = 2;

/** How many rows each block is allowed. A panel is not a category page. */
export const RECENTLY_VIEWED_SHOWN = 4;
export const TRENDING_SHOWN = 3;

/**
 * A bilingual name as the catalogue holds it. Kept as a pair rather than
 * resolved at capture time so that a trail recorded in English still reads as
 * Arabic when the visitor switches — the mistake the wishlist store had to be
 * corrected for.
 */
export interface NamePair {
  en: string;
  ar: string | null;
}

/** Display name for a locale. Arabic falls back to English when blank. */
export function localeName(name: NamePair, locale: string): string {
  return locale === "ar" && name.ar?.trim() ? name.ar : name.en;
}

export interface ViewedProduct {
  id: string;
  slug: string;
  name: NamePair;
  /** Straight from the catalogue's primary image, or null. Never a placeholder URL. */
  imageUrl: string | null;
  /** The one true identifier <ImageFrame> can show when there is no photograph. */
  sku: string | null;
  brand: NamePair | null;
  /**
   * The public product endpoint does not project a category, so this is null
   * for a view captured by the route recorder. It is populated when a caller
   * that already holds the row records the view itself (see recordProductView).
   * The planner reports the two bases with different words rather than merging
   * them into one unearned sentence.
   */
  category: { slug: string; name: NamePair } | null;
  at: number;
}

export interface CategoryVisit {
  /** The catalogue slug, straight off the URL the visitor was on. */
  slug: string;
  at: number;
}

export interface SearchVisit {
  term: string;
  at: number;
}

export interface DiscoveryHistory {
  views: ViewedProduct[];
  categoryVisits: CategoryVisit[];
  searches: SearchVisit[];
}

export function emptyHistory(): DiscoveryHistory {
  return { views: [], categoryVisits: [], searches: [] };
}

export function isEmptyHistory(history: DiscoveryHistory): boolean {
  return history.views.length === 0 && history.categoryVisits.length === 0 && history.searches.length === 0;
}

/**
 * A trending row, as narrow as the panel actually renders.
 *
 * Structurally a subset of what `toCatalogListDto` returns, so a server
 * component can pass catalogue rows straight through with no adapter — and a
 * client component still never imports the catalogue service.
 */
export interface TrendingProduct {
  id: string;
  slug: string;
  nameEn: string;
  nameAr?: string | null;
  sku?: string | null;
  images?: Array<{ url: string; altText?: string | null }> | null;
  brand?: { nameEn: string; nameAr?: string | null } | null;
  category?: { nameEn: string; nameAr?: string | null; slug: string } | null;
}

/* ── Recency weighting ───────────────────────────────────────────────────── */

/** Exponential decay by half-life. A signal from the future weighs 1, not more. */
export function recencyWeight(at: number, now: number, halfLifeMs = HALF_LIFE_MS): number {
  const age = now - at;
  if (!Number.isFinite(age) || age <= 0) return 1;
  return Math.pow(0.5, age / halfLifeMs);
}

function isFresh(at: number, now: number): boolean {
  return Number.isFinite(at) && now - at < SIGNAL_TTL_MS;
}

/* ── Recording ───────────────────────────────────────────────────────────── */

export function pruneHistory(history: DiscoveryHistory, now: number): DiscoveryHistory {
  return {
    views: history.views.filter((view) => isFresh(view.at, now)).slice(0, VIEW_LIMIT),
    categoryVisits: history.categoryVisits.filter((visit) => isFresh(visit.at, now)).slice(0, CATEGORY_VISIT_LIMIT),
    searches: history.searches.filter((search) => isFresh(search.at, now)).slice(0, SEARCH_LIMIT),
  };
}

/**
 * Record a product view. Re-opening a product moves it to the front and keeps
 * ONE entry: a trail that lists the same pump four times is a trail that has
 * stopped being a trail.
 */
export function recordView(history: DiscoveryHistory, view: ViewedProduct, now: number): DiscoveryHistory {
  const rest = history.views.filter((existing) => existing.id !== view.id);
  return pruneHistory({ ...history, views: [{ ...view, at: now }, ...rest] }, now);
}

/**
 * Record a category browse. Repeated visits ARE the signal, so they accumulate
 * — but only outside the debounce window, so paging through one category is one
 * visit and not eleven.
 */
export function recordCategoryVisit(history: DiscoveryHistory, slug: string, now: number): DiscoveryHistory {
  const trimmed = slug.trim();
  if (!trimmed) return history;
  const lastForSlug = history.categoryVisits.find((visit) => visit.slug === trimmed);
  if (lastForSlug && now - lastForSlug.at < VISIT_DEBOUNCE_MS) return history;
  return pruneHistory({ ...history, categoryVisits: [{ slug: trimmed, at: now }, ...history.categoryVisits] }, now);
}

/** Record a search. One entry per distinct term, newest first. */
export function recordSearch(history: DiscoveryHistory, term: string, now: number): DiscoveryHistory {
  const trimmed = term.trim();
  if (!trimmed) return history;
  const rest = history.searches.filter((search) => search.term.toLowerCase() !== trimmed.toLowerCase());
  return pruneHistory({ ...history, searches: [{ term: trimmed, at: now }, ...rest] }, now);
}

/* ── Ranking ─────────────────────────────────────────────────────────────── */

export interface CategoryInterest {
  slug: string;
  /** Times the visitor browsed the category itself. */
  browseCount: number;
  /** Products opened that the caller told us belong to this category. */
  viewCount: number;
  score: number;
  lastAt: number;
}

export interface BrandInterest {
  /** Lowercased English name — the join key, never displayed. */
  key: string;
  name: NamePair;
  viewCount: number;
  score: number;
  lastAt: number;
}

/**
 * Deterministic ordering: score, then recency, then key. A tie that resolves
 * differently on two renders is a panel that reorders itself under the reader
 * for no reason they can see.
 */
function byScoreThenRecency<T extends { score: number; lastAt: number }>(tieKey: (item: T) => string) {
  return (a: T, b: T) => b.score - a.score || b.lastAt - a.lastAt || tieKey(a).localeCompare(tieKey(b));
}

export function rankCategories(history: DiscoveryHistory, now: number): CategoryInterest[] {
  const bySlug = new Map<string, CategoryInterest>();
  const bump = (slug: string, at: number, kind: "browse" | "view") => {
    const entry = bySlug.get(slug) ?? { slug, browseCount: 0, viewCount: 0, score: 0, lastAt: 0 };
    entry.score += recencyWeight(at, now);
    entry.lastAt = Math.max(entry.lastAt, at);
    if (kind === "browse") entry.browseCount += 1;
    else entry.viewCount += 1;
    bySlug.set(slug, entry);
  };
  for (const visit of history.categoryVisits) if (isFresh(visit.at, now)) bump(visit.slug, visit.at, "browse");
  for (const view of history.views) {
    if (view.category && isFresh(view.at, now)) bump(view.category.slug, view.at, "view");
  }
  return [...bySlug.values()].sort(byScoreThenRecency((entry) => entry.slug));
}

export function rankBrands(history: DiscoveryHistory, now: number): BrandInterest[] {
  const byKey = new Map<string, BrandInterest>();
  for (const view of history.views) {
    if (!view.brand || !view.brand.en.trim() || !isFresh(view.at, now)) continue;
    const key = view.brand.en.trim().toLowerCase();
    const entry = byKey.get(key) ?? { key, name: view.brand, viewCount: 0, score: 0, lastAt: 0 };
    entry.score += recencyWeight(view.at, now);
    entry.viewCount += 1;
    // Keep the spelling from the most recent view — which is also the most
    // recent Arabic name the catalogue gave us. Compared BEFORE lastAt moves,
    // or every entry would trivially satisfy the test.
    if (view.at >= entry.lastAt) entry.name = view.brand;
    entry.lastAt = Math.max(entry.lastAt, view.at);
    byKey.set(key, entry);
  }
  return [...byKey.values()].sort(byScoreThenRecency((entry) => entry.key));
}

/* ── The plan ────────────────────────────────────────────────────────────── */

/**
 * Why a block is on screen. The panel renders one of these beside every
 * suggestion; there is no block type without one.
 */
export type DiscoveryReason =
  | { kind: "recentViews"; count: number }
  | { kind: "categoryBrowsed"; category: NamePair; count: number }
  | { kind: "categoryViewed"; category: NamePair; count: number }
  | { kind: "categoryBoth"; category: NamePair; browseCount: number; viewCount: number }
  | { kind: "brandViewed"; brand: NamePair; count: number }
  | { kind: "lastSearch"; term: string }
  | { kind: "catalogueActivity" };

export type DiscoveryBlock =
  | { kind: "recentlyViewed"; products: ViewedProduct[]; reason: DiscoveryReason }
  | { kind: "categoryJump"; slug: string; name: NamePair; href: string; inStockHref: string; reason: DiscoveryReason }
  | { kind: "brandJump"; slug: string; name: NamePair; href: string; reason: DiscoveryReason }
  | { kind: "resumeSearch"; term: string; href: string; reason: DiscoveryReason }
  | { kind: "trending"; products: TrendingProduct[]; reason: DiscoveryReason };

export interface DiscoveryPlan {
  blocks: DiscoveryBlock[];
  /**
   * There is a trail, but nothing in it is strong enough to name a category or
   * a brand yet. The panel prints this as a sentence. It is NOT an error and it
   * is NOT a reason to invent a block.
   */
  needsMoreSignal: boolean;
  /** What the panel is reasoning from, so it can state its own basis. */
  basis: { views: number; categoryVisits: number; searches: number };
}

export interface DiscoveryPlanInput {
  history: DiscoveryHistory;
  /** Rows from getTrendingProducts(), passed down by a server component. May be empty — that is normal. */
  trending: TrendingProduct[];
  now: number;
  /**
   * slug → display name, from the public category tree. A category we cannot
   * name is a category we do not offer, so an absent entry silently removes the
   * block rather than printing a slug at the visitor.
   */
  categoryNames?: Record<string, NamePair>;
  /**
   * Lowercased brand name → catalogue brand slug. The catalogue filters brands
   * by slug and searches them by slug; a brand we hold only a NAME for cannot be
   * turned into a link that is guaranteed to resolve, so it produces no block.
   */
  brandSlugs?: Record<string, string>;
}

function categoryReason(interest: CategoryInterest, name: NamePair): DiscoveryReason {
  if (interest.browseCount > 0 && interest.viewCount > 0) {
    return { kind: "categoryBoth", category: name, browseCount: interest.browseCount, viewCount: interest.viewCount };
  }
  if (interest.viewCount > 0) return { kind: "categoryViewed", category: name, count: interest.viewCount };
  return { kind: "categoryBrowsed", category: name, count: interest.browseCount };
}

export function buildDiscoveryPlan({
  history,
  trending,
  now,
  categoryNames = {},
  brandSlugs = {},
}: DiscoveryPlanInput): DiscoveryPlan {
  const pruned = pruneHistory(history, now);
  const blocks: DiscoveryBlock[] = [];

  // 1. The trail itself. The most useful and the most honest thing the panel
  //    has, because it is a record of what the visitor did rather than an
  //    inference about what they want.
  if (pruned.views.length > 0) {
    blocks.push({
      kind: "recentlyViewed",
      products: pruned.views.slice(0, RECENTLY_VIEWED_SHOWN),
      reason: { kind: "recentViews", count: pruned.views.length },
    });
  }

  // 2. The dominant category — claimed only above the floor, and only if the
  //    catalogue has given us a name for it.
  const topCategory = rankCategories(pruned, now)[0];
  const categoryHits = topCategory ? topCategory.browseCount + topCategory.viewCount : 0;
  const categoryName = topCategory ? categoryNames[topCategory.slug] : undefined;
  let derivedSomething = false;
  if (topCategory && categoryName && categoryHits >= MIN_HITS_TO_CLAIM) {
    const slug = encodeURIComponent(topCategory.slug);
    blocks.push({
      kind: "categoryJump",
      slug: topCategory.slug,
      name: categoryName,
      href: `/products?category=${slug}`,
      // The catalogue's own in-stock parameter. See apps/customer/src/app/products/page.tsx.
      inStockHref: `/products?category=${slug}&inStock=1`,
      reason: categoryReason(topCategory, categoryName),
    });
    derivedSomething = true;
  }

  // 3. The dominant brand, from products actually opened.
  const topBrand = rankBrands(pruned, now)[0];
  const brandSlug = topBrand ? brandSlugs[topBrand.key] : undefined;
  if (topBrand && brandSlug && topBrand.viewCount >= MIN_HITS_TO_CLAIM) {
    blocks.push({
      kind: "brandJump",
      slug: brandSlug,
      name: topBrand.name,
      href: `/products?brand=${encodeURIComponent(brandSlug)}`,
      reason: { kind: "brandViewed", brand: topBrand.name, count: topBrand.viewCount },
    });
    derivedSomething = true;
  }

  // 4. The last search. One signal is enough here because it is not an
  //    inference — it is the visitor's own sentence, handed back to them.
  const lastSearch = pruned.searches[0];
  if (lastSearch) {
    blocks.push({
      kind: "resumeSearch",
      term: lastSearch.term,
      href: `/search?q=${encodeURIComponent(lastSearch.term)}`,
      reason: { kind: "lastSearch", term: lastSearch.term },
    });
    derivedSomething = true;
  }

  // 5. Trending, if the signals service found any. Empty is the normal case,
  //    not a failure, and it is never padded with arbitrary rows.
  if (trending.length > 0) {
    blocks.push({
      kind: "trending",
      products: trending.slice(0, TRENDING_SHOWN),
      reason: { kind: "catalogueActivity" },
    });
  }

  return {
    blocks,
    needsMoreSignal: !isEmptyHistory(pruned) && !derivedSomething,
    basis: {
      views: pruned.views.length,
      categoryVisits: pruned.categoryVisits.length,
      searches: pruned.searches.length,
    },
  };
}

/**
 * Whether the panel should exist on screen at all.
 *
 * Nothing to say means no launcher, no chrome and no "we're learning about
 * you!" placeholder. A helper with nothing to offer is an advertisement for
 * itself.
 */
export function hasSomethingToSay(plan: DiscoveryPlan): boolean {
  return plan.blocks.length > 0;
}
