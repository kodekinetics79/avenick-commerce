import type { CatalogSearchOutcome } from "@avenick/database";
import type { PublicCategory } from "@/lib/catalog-categories";

/**
 * Zero-result recovery and result-page merchandising for /search.
 *
 * Everything in this module is pure: it decides WHAT to offer a buyer whose
 * query matched nothing (or matched something, and could pivot to structured
 * browsing), but it never decides that something exists. Existence is settled
 * by the caller against the real catalogue — the category tree that
 * /api/categories already filters to populated branches, a brand count from
 * /api/products, a relaxed search that was actually run — and handed back in
 * through `assembleRecoveryLadder`. A rung this module cannot back with real
 * data is omitted, not padded.
 *
 * The honesty rules this encodes:
 *  · a "did you mean" category is a category from the live tree, at any depth;
 *  · a "did you mean" brand carries the count of listings the link lands on,
 *    and is dropped when that count is zero;
 *  · the part-number rung appears only when the service itself reports that it
 *    ran the identifier tiers and matched nothing — the outcome's `strategy`,
 *    not a regex re-implemented here;
 *  · the relaxed search is offered only after it was run and returned rows.
 */

// ─── NORMALISATION ───────────────────────────────────────────────────────────

/**
 * Arabic combining marks (tashkeel), the Quranic annotation range, and tatweel
 * — none of which a buyer types consistently and none of which change what a
 * category is called.
 */
const ARABIC_MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;

/** Characters that separate words in a name, a slug or a typed query. */
const SEPARATORS = /[\s\-_/.,،]+/g;

/**
 * One comparable form for a query, a category name, a brand name or a slug.
 *
 * Case-folded, separator-collapsed, and Arabic-folded: the alef variants, the
 * final ya/alef-maqsura and the ta-marbuta/ha pairs are the spellings a buyer
 * varies between without noticing, so they must compare equal.
 */
export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(ARABIC_MARKS, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .toLowerCase()
    .replace(SEPARATORS, " ")
    .trim();
}

interface QueryShape {
  text: string;
  tokens: string[];
}

function shapeQuery(query: string): QueryShape {
  const text = normalizeSearchText(query);
  return { text, tokens: text ? text.split(" ") : [] };
}

/** Shortest token that may match on its own; below this "of", "in" and "من" would match everything. */
const MIN_TOKEN_LENGTH = 3;
/** Shortest stem that may match as a prefix of a longer one ("fast" → "fasteners"). */
const MIN_PREFIX_LENGTH = 4;

/**
 * A light stem for token comparison: the Arabic definite article is dropped
 * ("المضخات" ↔ "مضخات"), and a Latin plural loses its trailing "s" ("bolts" ↔
 * "bolt"). Deliberately no real stemmer — anything cleverer starts producing
 * matches a buyer cannot see the reason for.
 */
function stem(token: string): string {
  let stemmed = token;
  if (stemmed.startsWith("ال") && stemmed.length > 4) stemmed = stemmed.slice(2);
  if (/^[a-z0-9]+$/.test(stemmed) && stemmed.length > 3 && stemmed.endsWith("s")) stemmed = stemmed.slice(0, -1);
  return stemmed;
}

function tokensMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const stemA = stem(a);
  const stemB = stem(b);
  if (stemA === stemB) return true;
  const [shorter, longer] = stemA.length <= stemB.length ? [stemA, stemB] : [stemB, stemA];
  return shorter.length >= MIN_PREFIX_LENGTH && longer.startsWith(shorter);
}

/**
 * How well a name answers a query, highest first:
 *   4 — the name IS the query ("3M", "Power Tools");
 *   3 — the name contains the query ("bolt" → "Hex Bolts");
 *   2 — the query contains the whole name ("bosch drill bits" → "Drill Bits");
 *   1 — a query word matches a name word ("steel bolts m6" → "Bolts").
 * 0 means no relation this module is willing to claim.
 */
function nameScore(name: string | null | undefined, query: QueryShape): number {
  if (!name) return 0;
  const normalized = normalizeSearchText(name);
  if (!normalized || !query.text) return 0;
  if (normalized === query.text) return 4;
  // A one- or two-character query may only match a whole word: "m6" is a size
  // code and "3m" is a brand, but neither may claim "some 6 mm" by substring.
  const contains = query.text.length >= MIN_TOKEN_LENGTH
    ? normalized.includes(query.text)
    : ` ${normalized} `.includes(` ${query.text} `);
  if (contains) return 3;
  if (normalized.length >= MIN_TOKEN_LENGTH && ` ${query.text} `.includes(` ${normalized} `)) return 2;
  const nameTokens = normalized.split(" ");
  const overlaps = query.tokens.some(
    (token) => token.length >= MIN_TOKEN_LENGTH && nameTokens.some((nameToken) => tokensMatch(token, nameToken)),
  );
  return overlaps ? 1 : 0;
}

// ─── CATEGORIES ──────────────────────────────────────────────────────────────

export interface CategoryRef {
  slug: string;
  nameEn: string;
  nameAr: string;
}

export interface CategoryMatch extends CategoryRef {
  /** Ancestors, root first, excluding the category itself. Empty for a root. */
  trail: CategoryRef[];
  score: number;
}

export const MAX_CATEGORY_MATCHES = 6;

/**
 * Categories anywhere in the tree whose name relates to the query.
 *
 * The tree is /api/categories' own, which is already pruned to branches that
 * lead to a publicly discoverable product — so every match here is a link
 * that lands on listings. Walked to any depth, because imported catalogues
 * put products on the leaf and the leaf is where the specific name lives.
 * Ordered by how strongly the name matched, then by the tree's own order.
 */
export function matchCategories(tree: PublicCategory[], query: string, limit = MAX_CATEGORY_MATCHES): CategoryMatch[] {
  const shape = shapeQuery(query);
  if (!shape.text) return [];
  const found: Array<CategoryMatch & { order: number }> = [];
  const seen = new Set<string>();
  let order = 0;
  const walk = (nodes: PublicCategory[], trail: CategoryRef[]) => {
    for (const node of nodes) {
      const position = order++;
      const ref: CategoryRef = { slug: node.slug, nameEn: node.nameEn, nameAr: node.nameAr };
      const score = Math.max(nameScore(node.nameEn, shape), nameScore(node.nameAr, shape));
      if (score > 0 && !seen.has(node.slug)) {
        seen.add(node.slug);
        found.push({ ...ref, trail, score, order: position });
      }
      walk(node.children ?? [], [...trail, ref]);
    }
  };
  walk(tree, []);
  return found
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, Math.max(0, limit))
    .map(({ order: _order, ...match }) => match);
}

// ─── BRANDS ──────────────────────────────────────────────────────────────────

/** A brand as /api/brands returns it, reduced to what matching needs. */
export interface RecoveryBrand {
  slug: string;
  nameEn: string;
  nameAr?: string | null;
  /**
   * /api/brands' `_count.products`: ACTIVE, non-deleted listings with no
   * discoverability or seller predicate. A zero here is a certain dead end and
   * is dropped; a positive count is only a CANDIDATE, because the link lands on
   * the public catalogue's narrower rule — the caller verifies it there.
   */
  productCount?: number | null;
}

export interface BrandMatch {
  slug: string;
  nameEn: string;
  nameAr: string | null;
  score: number;
}

export interface VerifiedBrandMatch extends BrandMatch {
  /** Listings the brand link actually lands on, as the catalogue API counted them. */
  total: number;
}

export const MAX_BRAND_CANDIDATES = 3;

export function matchBrands(brands: RecoveryBrand[], query: string, limit = MAX_BRAND_CANDIDATES): BrandMatch[] {
  const shape = shapeQuery(query);
  if (!shape.text) return [];
  const seen = new Set<string>();
  return brands
    .flatMap((brand) => {
      if (!brand.slug || seen.has(brand.slug)) return [];
      if (brand.productCount != null && brand.productCount <= 0) return [];
      const score = Math.max(nameScore(brand.nameEn, shape), nameScore(brand.nameAr, shape), nameScore(brand.slug, shape));
      if (score === 0) return [];
      seen.add(brand.slug);
      return [{ slug: brand.slug, nameEn: brand.nameEn, nameAr: brand.nameAr ?? null, score }];
    })
    .sort((a, b) => b.score - a.score || a.nameEn.localeCompare(b.nameEn))
    .slice(0, Math.max(0, limit));
}

/**
 * Keep only the candidates the catalogue confirmed, carrying the confirmed
 * count. A candidate with no entry was not verified (the check failed or was
 * never made) and is treated exactly like a zero: not shown.
 */
export function verifiedBrandMatches(candidates: BrandMatch[], brandTotals: ReadonlyMap<string, number>): VerifiedBrandMatch[] {
  return candidates.flatMap((brand) => {
    const total = brandTotals.get(brand.slug);
    return total != null && total > 0 ? [{ ...brand, total }] : [];
  });
}

/** Display name for the visitor's locale; Arabic falls back to English when the Arabic name is blank. */
export function brandLabel(brand: Pick<BrandMatch, "nameEn" | "nameAr">, locale: string): string {
  return locale === "ar" && brand.nameAr?.trim() ? brand.nameAr : brand.nameEn;
}

// ─── RELAXED SEARCH ──────────────────────────────────────────────────────────

/**
 * The query with its last word dropped, or null when there is no such query
 * worth running.
 *
 * `isRunnable` is the catalogue's own classification (classifyCatalogSearch →
 * status "ran"), passed in rather than re-implemented so the rule cannot
 * drift: a relaxed term the service would refuse is not offered, because the
 * offer would land on the "search not run" plate.
 */
export function relaxedSearchCandidate(query: string, isRunnable: (term: string) => boolean): string | null {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return null;
  const relaxed = tokens.slice(0, -1).join(" ");
  return relaxed && isRunnable(relaxed) ? relaxed : null;
}

// ─── HREFS ───────────────────────────────────────────────────────────────────

export function categoryBrowseHref(slug: string): string {
  return `/products?category=${encodeURIComponent(slug)}`;
}

export function brandBrowseHref(slug: string): string {
  return `/products?brand=${encodeURIComponent(slug)}`;
}

export function searchHref(query: string): string {
  return `/search?q=${encodeURIComponent(query)}`;
}

/**
 * The RFQ form, carrying the term the buyer searched for. The form does not
 * yet read `query` (it prefills `supplier` and `product` only), so today this
 * lands on a blank form; the parameter is the contract for when it does.
 */
export function rfqHref(query: string): string {
  return `/b2b/rfq/new?query=${encodeURIComponent(query)}`;
}

// ─── PLAN → VERIFY → ASSEMBLE ────────────────────────────────────────────────

export interface SearchRecoveryPlan {
  /** Real categories whose names relate to the query; also the result-page pivot chips. */
  categories: CategoryMatch[];
  /** Brand CANDIDATES — unverified until the caller counts their public listings. */
  brandCandidates: BrandMatch[];
  /**
   * The term to offer an RFQ for. Set only when the catalogue reports that it
   * ran the identifier tiers (SKU, part numbers, ERP codes, brand codes) for
   * this term and nothing matched — the one case where "no listing carries
   * this part number" is a statement the data supports.
   */
  identifier: string | null;
  /** A shorter query to verify, or null. Never shown until it has been run. */
  relaxedCandidate: string | null;
}

export function planSearchRecovery(input: {
  query: string;
  search: CatalogSearchOutcome;
  total: number;
  categories: PublicCategory[];
  brands: RecoveryBrand[];
  isRunnable: (term: string) => boolean;
}): SearchRecoveryPlan {
  const { query, search, total } = input;
  const nothingFound = total <= 0;
  const identifierTierMissed = nothingFound && search.status === "ran" && search.strategy !== "text";
  return {
    categories: matchCategories(input.categories, query),
    brandCandidates: matchBrands(input.brands, query),
    identifier: identifierTierMissed && search.status === "ran" ? search.term : null,
    // Planned whenever nothing was found, refused outcomes included, so there
    // is one rule rather than a special case. In practice a refused term is a
    // single short token — any two words are already at the three-character
    // floor and run as text — so relaxing it yields nothing to offer.
    relaxedCandidate: nothingFound ? relaxedSearchCandidate(query, input.isRunnable) : null,
  };
}

export interface RecoveryVerification {
  /** Public-catalogue listing count per verified brand slug. */
  brandTotals: ReadonlyMap<string, number>;
  /** What happened when the relaxed candidate was actually run, or null if it was not. */
  relaxed: { status: CatalogSearchOutcome["status"]; total: number } | null;
}

export type RecoveryRung =
  | { kind: "categories"; items: CategoryMatch[] }
  | { kind: "brands"; items: VerifiedBrandMatch[] }
  | { kind: "identifier"; term: string; href: string }
  | { kind: "relaxed"; term: string; total: number; href: string };

/**
 * The ladder, in the order a buyer should read it: categories, brands, the
 * part-number route, then the shorter search. Every rung is backed by data the
 * caller verified; a rung with nothing real behind it does not appear.
 */
export function assembleRecoveryLadder(plan: SearchRecoveryPlan, verification: RecoveryVerification): RecoveryRung[] {
  const rungs: RecoveryRung[] = [];
  if (plan.categories.length > 0) rungs.push({ kind: "categories", items: plan.categories });
  const brands = verifiedBrandMatches(plan.brandCandidates, verification.brandTotals);
  if (brands.length > 0) rungs.push({ kind: "brands", items: brands });
  if (plan.identifier) rungs.push({ kind: "identifier", term: plan.identifier, href: rfqHref(plan.identifier) });
  const relaxed = verification.relaxed;
  if (plan.relaxedCandidate && relaxed && relaxed.status === "ran" && relaxed.total > 0) {
    rungs.push({ kind: "relaxed", term: plan.relaxedCandidate, total: relaxed.total, href: searchHref(plan.relaxedCandidate) });
  }
  return rungs;
}
