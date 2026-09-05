import { NextRequest, NextResponse } from "next/server";
import { classifyCatalogSearch, db, publicProductWhere } from "@avenick/database";
// Narrow subpath on purpose: the package barrel pulls in next-auth, which is
// unnecessary here and breaks tests that never touch authentication.
import { checkRateLimit, clientIpFrom, type RateLimitRule } from "@avenick/auth/rate-limit";
import {
  assembleSuggestions,
  identifierCandidates,
  parseSuggestLimit,
  rankProductSuggestions,
  suggestOutcome,
  suggestProductWhere,
  type ProductSuggestRow,
  type SuggestResponse,
} from "@/lib/search-suggest";

// Catalogue data changes when a seller publishes, not when this app is built.
export const dynamic = "force-dynamic";

/**
 * Its own bucket, not `catalogRead`.
 *
 * A typeahead fires on keystrokes; sharing the catalogue's 120/min would let a
 * buyer typing three queries spend the budget that /products and /search then
 * need to render, and answer their submitted search with a 429. Three a second
 * sustained is more than a debounced field produces and less than a scraper
 * wants, and it is the same limiter every other public route uses.
 */
const SEARCH_SUGGEST_RATE_LIMIT: RateLimitRule = { name: "search-suggest", limit: 180, windowMs: 60_000 };

/** Up to this many of each structured kind are read; assembleSuggestions decides how many are shown. */
const STRUCTURED_TAKE = 4;

const PRODUCT_SELECT = { id: true, slug: true, nameEn: true, nameAr: true, sku: true } as const;

function nameContains(term: string) {
  return [
    { nameEn: { contains: term, mode: "insensitive" as const } },
    { nameAr: { contains: term, mode: "insensitive" as const } },
  ];
}

function respond(data: SuggestResponse) {
  return NextResponse.json(
    { success: true, data },
    // No auth, no pricing, no per-viewer state: public and edge-cacheable for
    // the same short window as the catalogue listing it mirrors.
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300", Vary: "Accept-Encoding" } },
  );
}

/**
 * GET /api/search/suggest?q=<term>&limit=<1..8>
 *
 * Up to eight matches across categories, brands and products for a term as it
 * is typed. Products match on name (trigram) or SKU (anchored prefix below the
 * trigram floor); categories and brands match on name, and a brand also on its
 * slug prefix so "3m" finds 3M. Every source is restricted to what a member of
 * the public can reach: ACTIVE, discoverable, non-deleted products behind an
 * ACTIVE seller, and only categories and brands that directly hold one. A
 * parent category whose listings all sit on child leaves is therefore not
 * suggested — conservative by design, since a suggestion is a promise that the
 * link lands on something.
 *
 * Response: { success, data: SuggestResponse } — see lib/search-suggest.ts.
 * A term below the floor answers `status: "too_short"` with the floor in
 * `minLength` and an empty list, so a client never renders "no matches" for a
 * lookup that did not run.
 */
export async function GET(req: NextRequest) {
  try {
    const rl = await checkRateLimit(SEARCH_SUGGEST_RATE_LIMIT, clientIpFrom(req.headers));
    if (!rl.ok) {
      return NextResponse.json(
        { success: false, error: "Too many suggestion requests. Please slow down." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
      );
    }

    const { searchParams } = new URL(req.url);
    // Bounded like the catalogue's own search parameter.
    const raw = (searchParams.get("q") ?? "").slice(0, 160);
    const limit = parseSuggestLimit(searchParams.get("limit"));
    const outcome = suggestOutcome(classifyCatalogSearch(raw));

    if (outcome.status === "none") return respond({ query: "", status: "none", minLength: null, suggestions: [] });
    if (outcome.status === "too_short") {
      return respond({ query: outcome.term, status: "too_short", minLength: outcome.minLength, suggestions: [] });
    }

    const { term, strategy } = outcome;
    const visible = publicProductWhere(undefined);

    const [exact, rows, categories, brands] = await Promise.all([
      // The rank-1 tier of the full search, read on its own so an exact part
      // number is never crowded out of a name-ordered page by lookalikes.
      strategy !== "text"
        ? db.product.findFirst({ where: { ...visible, sku: { in: identifierCandidates(term) } }, select: PRODUCT_SELECT })
        : Promise.resolve(null),
      db.product.findMany({
        where: { ...visible, AND: [suggestProductWhere(term, strategy)] },
        select: PRODUCT_SELECT,
        orderBy: [{ nameEn: "asc" }, { id: "asc" }],
        take: limit,
      }),
      // Category and Brand are small tables with no name index; an unanchored
      // match on them is a scan of a few hundred rows, not the seven-column,
      // two-table scan the catalogue's trigram floor exists to prevent.
      db.category.findMany({
        where: { isActive: true, OR: nameContains(term), products: { some: visible } },
        select: { slug: true, nameEn: true, nameAr: true, parent: { select: { nameEn: true, nameAr: true } } },
        orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
        take: STRUCTURED_TAKE,
      }),
      db.brand.findMany({
        where: { isActive: true, OR: [...nameContains(term), { slug: { startsWith: term.toLowerCase() } }], products: { some: visible } },
        select: { slug: true, nameEn: true, nameAr: true },
        orderBy: { nameEn: "asc" },
        take: STRUCTURED_TAKE,
      }),
    ]);

    const products = rankProductSuggestions([...(exact ? [exact] : []), ...rows] as ProductSuggestRow[], term);
    return respond({ query: term, status: "ran", minLength: null, suggestions: assembleSuggestions({ products, categories, brands }, limit) });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to load suggestions" }, { status: 500 });
  }
}
