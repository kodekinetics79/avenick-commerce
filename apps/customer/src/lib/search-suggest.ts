import type { CatalogSearchOutcome, Prisma } from "@avenick/database";

/**
 * The /api/search/suggest contract and the pure parts of the route: what a
 * term may query, how product rows rank, and how the three sources are cut to
 * one short list. Type-only imports from the database package, so this module
 * is safe to share with the client-side hook and to test without a database.
 *
 * WHAT A SUGGESTION IS NOT: it carries no price, no stock, no seller and no
 * commercial metadata. A suggestion is a name and a place to go. Pricing stays
 * behind the catalogue DTOs and their channel rules.
 */

/** Shortest term the endpoint will look up at all — one character selects an arbitrary slice of the catalogue. */
export const SUGGEST_MIN_LENGTH = 2;
export const SUGGEST_LIMIT_DEFAULT = 8;
export const SUGGEST_LIMIT_MAX = 8;
/** Structured entries (categories, brands) reserved at the head of the list before products fill the rest. */
const STRUCTURED_BASE_PER_KIND = 2;

export type SuggestionKind = "category" | "brand" | "product";

export interface SearchSuggestion {
  kind: SuggestionKind;
  /** English label; `labelAr` is null when the record has no Arabic name. */
  label: string;
  labelAr: string | null;
  /** Where choosing the suggestion lands: a product page, or the catalogue filtered to the category or brand. */
  href: string;
  /** Products only. */
  sku?: string;
  /** Categories only: the parent's name, so "Bolts" under "Fasteners" is distinguishable from "Bolts" under "Anchors". */
  parent?: { label: string; labelAr: string | null } | null;
}

export type SuggestStatus = "none" | "too_short" | "ran";

export interface SuggestResponse {
  /** The term as the catalogue normalised it (whitespace-collapsed). */
  query: string;
  /**
   * "ran" — the sources were queried and `suggestions` is the answer;
   * "too_short" — nothing was queried (see `minLength`), so an empty list is
   * not a statement about the catalogue; "none" — no term was supplied.
   */
  status: SuggestStatus;
  /** The floor the term fell under, when status is "too_short". */
  minLength: number | null;
  suggestions: SearchSuggestion[];
}

export function parseSuggestLimit(raw: string | null): number {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) return SUGGEST_LIMIT_DEFAULT;
  return Math.min(parsed, SUGGEST_LIMIT_MAX);
}

/** The predicate families the catalogue applied to a term — its own vocabulary, restated so this module stays type-only on the database package. */
export type SuggestStrategy = "identifier" | "identifier+text" | "text";

export type SuggestOutcome =
  | { status: "none" }
  | { status: "too_short"; term: string; minLength: number }
  | { status: "ran"; term: string; strategy: SuggestStrategy };

/**
 * The catalogue's own classification with this endpoint's floor laid over it.
 *
 * The service will run a one-character identifier ("M") as an exact SKU match,
 * which is correct for a search a buyer submitted and useless for a list that
 * updates as they type. The floor reported back is whichever one the term fell
 * under, so a client can say so truthfully.
 */
export function suggestOutcome(outcome: CatalogSearchOutcome): SuggestOutcome {
  if (outcome.status === "none") return { status: "none" };
  if (outcome.status === "too_short") return { status: "too_short", term: outcome.term, minLength: outcome.minLength };
  if (outcome.term.length < SUGGEST_MIN_LENGTH) return { status: "too_short", term: outcome.term, minLength: SUGGEST_MIN_LENGTH };
  return { status: "ran", term: outcome.term, strategy: outcome.strategy };
}

/**
 * The same case foldings the catalogue tries for an identifier: the btree
 * indexes on SKU are case-sensitive, and testing a small literal set keeps the
 * lookup indexed while bridging what a buyer types and what a sheet loaded.
 */
export function identifierCandidates(term: string): string[] {
  return Array.from(new Set([term, term.toUpperCase(), term.toLowerCase()]));
}

/**
 * The product predicate for a term, by the strategy the catalogue assigned it.
 *
 * Below the trigram floor only an anchored SKU prefix is asked for — answered
 * from the btree, never a `%term%` scan on a public route. At three characters
 * and above the trigram-indexed columns (nameEn, nameAr, sku) are searched
 * unanchored. Part-number columns on the commercial metadata are left to the
 * full search: this is a typeahead over what a buyer can see on a tile.
 */
export function suggestProductWhere(term: string, strategy: SuggestStrategy): Prisma.ProductWhereInput {
  const clauses: Prisma.ProductWhereInput[] = [];
  if (strategy !== "text") {
    clauses.push(...identifierCandidates(term).map((value) => ({ sku: { startsWith: value } })));
  }
  if (strategy !== "identifier") {
    clauses.push(
      { nameEn: { contains: term, mode: "insensitive" } },
      { nameAr: { contains: term, mode: "insensitive" } },
      { sku: { contains: term, mode: "insensitive" } },
    );
  }
  return { OR: clauses };
}

export interface ProductSuggestRow {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  sku: string;
}

export interface CategorySuggestRow {
  slug: string;
  nameEn: string;
  nameAr: string;
  parent?: { nameEn: string; nameAr: string } | null;
}

export interface BrandSuggestRow {
  slug: string;
  nameEn: string;
  nameAr: string | null;
}

/**
 * Exact SKU first, then SKU prefix, then everything else — the same order the
 * full search ranks in, because a part number typed exactly is the highest-
 * intent query a B2B catalogue receives. Ties keep name order, then id, so the
 * list is stable between keystrokes. Duplicates (the exact row is fetched
 * separately) collapse on id.
 */
export function rankProductSuggestions(rows: ProductSuggestRow[], term: string): ProductSuggestRow[] {
  const folded = term.toLowerCase();
  const rank = (row: ProductSuggestRow) => {
    const sku = row.sku.toLowerCase();
    if (sku === folded) return 0;
    if (sku.startsWith(folded)) return 1;
    return 2;
  };
  const seen = new Set<string>();
  return rows
    .filter((row) => (seen.has(row.id) ? false : (seen.add(row.id), true)))
    .map((row, index) => ({ row, index, rank: rank(row) }))
    .sort((a, b) => a.rank - b.rank || a.row.nameEn.localeCompare(b.row.nameEn) || a.row.id.localeCompare(b.row.id) || a.index - b.index)
    .map(({ row }) => row);
}

export function productSuggestion(row: ProductSuggestRow): SearchSuggestion {
  return { kind: "product", label: row.nameEn, labelAr: row.nameAr || null, href: `/products/${encodeURIComponent(row.slug)}`, sku: row.sku };
}

export function categorySuggestion(row: CategorySuggestRow): SearchSuggestion {
  return {
    kind: "category",
    label: row.nameEn,
    labelAr: row.nameAr || null,
    href: `/products?category=${encodeURIComponent(row.slug)}`,
    parent: row.parent ? { label: row.parent.nameEn, labelAr: row.parent.nameAr || null } : null,
  };
}

export function brandSuggestion(row: BrandSuggestRow): SearchSuggestion {
  return { kind: "brand", label: row.nameEn, labelAr: row.nameAr?.trim() ? row.nameAr : null, href: `/products?brand=${encodeURIComponent(row.slug)}` };
}

/**
 * One list of at most `limit`, categories first, then brands, then products.
 *
 * Up to two of each structured kind are reserved at the head so a brand or a
 * category the buyer is clearly typing towards is never pushed out by eight
 * products that merely contain the letters. Products fill the rest; when there
 * are fewer products than slots, further categories and then brands take the
 * unused room. Nothing is padded: fewer real matches means a shorter list.
 */
export function assembleSuggestions(
  input: { products: ProductSuggestRow[]; categories: CategorySuggestRow[]; brands: BrandSuggestRow[] },
  limit = SUGGEST_LIMIT_DEFAULT,
): SearchSuggestion[] {
  const cap = Math.max(0, Math.min(limit, SUGGEST_LIMIT_MAX));
  const categoryBase = Math.min(input.categories.length, STRUCTURED_BASE_PER_KIND, cap);
  const brandBase = Math.min(input.brands.length, STRUCTURED_BASE_PER_KIND, Math.max(0, cap - categoryBase));
  const productCount = Math.min(input.products.length, Math.max(0, cap - categoryBase - brandBase));
  let spare = cap - categoryBase - brandBase - productCount;
  const categoryExtra = Math.min(input.categories.length - categoryBase, spare);
  spare -= categoryExtra;
  const brandExtra = Math.min(input.brands.length - brandBase, spare);
  return [
    ...input.categories.slice(0, categoryBase + categoryExtra).map(categorySuggestion),
    ...input.brands.slice(0, brandBase + brandExtra).map(brandSuggestion),
    ...input.products.slice(0, productCount).map(productSuggestion),
  ];
}
