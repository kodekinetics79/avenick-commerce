import { NextRequest, NextResponse } from "next/server";
import { listProducts } from "@avenick/database";
import type { Currency, ProductStatus } from "@avenick/database";
// Narrow subpath on purpose: the package barrel pulls in next-auth, which is
// unnecessary here and breaks tests that never touch authentication.
import { checkRateLimit, clientIpFrom, RATE_LIMITS } from "@avenick/auth/rate-limit";
import { getServerB2BContext } from "@/lib/b2b-server";
import { toCatalogListDto } from "@/lib/catalog-list-dto";

const CURRENCIES = new Set<Currency>(["AED", "SAR", "QAR", "KWD", "OMR", "BHD", "USD"]);

function boundedInt(value: string | null, fallback: number, max: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

/**
 * The sorts the catalog query can actually perform across the WHOLE result set.
 *
 * An unknown value falls back to "newest" rather than erroring, which is the
 * behaviour this route already had — a sort is a presentation choice and a bad
 * one cannot misrepresent what the catalogue contains. The filters below are
 * different and are rejected instead: silently dropping "rated 4 and up" would
 * answer a narrower question with the whole catalogue under the caller's
 * heading.
 */
const SORTS = new Set(["newest", "name_asc", "moq_asc", "rating"]);

/**
 * A numeric filter bound, or a stated refusal.
 *
 * `null` means the parameter was absent. `false` means it was present and
 * malformed — the caller asked for a filter this route could not apply, and it
 * says so with a 400 instead of returning an unfiltered catalogue that looks
 * like a filtered one.
 */
function filterNumber(
  value: string | null,
  { min, max, integer }: { min: number; max: number; integer: boolean },
): number | null | false {
  if (value == null || value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return false;
  if (integer && !Number.isInteger(parsed)) return false;
  return parsed;
}

/** MOQ is an Int column; nothing in a catalogue needs a bound above this. */
const MAX_MOQ_BOUND = 1_000_000;

// Catalogue data changes when a seller publishes, not when this app is built.
// /api/categories already declares this; without it a route handler can be
// evaluated once and serve a build-time snapshot, so a newly published listing
// would not appear until the next deploy. The Cache-Control header below still
// gives a CDN its own short window, which is where caching belongs.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // This route is public and runs an unbounded count() next to the page
    // query, so it is the cheapest external way to load the database — and
    // checkout transactions queue behind the same pool. Throttle per client IP.
    const rl = await checkRateLimit(RATE_LIMITS.catalogRead, clientIpFrom(req.headers));
    if (!rl.ok) {
      return NextResponse.json(
        { success: false, error: "Too many catalog requests. Please slow down." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
        },
      );
    }

    const { searchParams } = new URL(req.url);
    const wantsB2B = searchParams.get("b2b") === "true";
    /*
      `b2c` is READ now. It never was: this route parsed `b2b` only, so every
      caller that sent `?b2c=true` — the home page, /deals, /search and the
      category pages, since each was written — was handed the entire catalogue
      while believing it had asked for the consumer slice. A filter that is
      silently ignored is the worst kind of defect, because the caller's code
      reads as if the restriction is in force and every reviewer since has read
      it that way too.

      Honouring it is a real behaviour change and the callers were corrected in
      the same commit: not one product in this catalogue has isB2CEnabled set,
      so a page that genuinely asked for B2C would now render empty. Those pages
      never wanted a channel restriction — they want the public catalogue — so
      they no longer send one. The parameter now means what it says, and it will
      do the right thing the day B2C pricing is switched on.
    */
    const b2cParam = searchParams.get("b2c");
    const b2c = b2cParam === "true" ? true : b2cParam === "false" ? false : undefined;
    const currencyParam = searchParams.get("currency")?.toUpperCase() as Currency | undefined;
    if (currencyParam && !CURRENCIES.has(currencyParam)) {
      return NextResponse.json({ success: false, error: "Unsupported currency" }, { status: 400 });
    }

    // B2B catalog and prices are never public-cacheable. This is the boundary
    // that future ERP/account-specific pricing will also sit behind.
    if (wantsB2B) {
      const ctx = await getServerB2BContext();
      if (!ctx) {
        return NextResponse.json({ success: false, error: "Active company account required for B2B pricing" }, { status: 401 });
      }
    }

    const categorySlug = searchParams.get("categorySlug") ?? undefined;
    const categoryId = searchParams.get("categoryId") ?? undefined;

    // Ratings are 1–5 integers, so an average is a real number in [1, 5]. A
    // floor of 1 is not a filter (every rated product clears it) but it is not
    // malformed either, so it is accepted and simply means "reviewed".
    const minRating = filterNumber(searchParams.get("minRating"), { min: 1, max: 5, integer: false });
    const moqMin = filterNumber(searchParams.get("moqMin"), { min: 1, max: MAX_MOQ_BOUND, integer: true });
    const moqMax = filterNumber(searchParams.get("moqMax"), { min: 1, max: MAX_MOQ_BOUND, integer: true });
    if (minRating === false || moqMin === false || moqMax === false) {
      return NextResponse.json(
        { success: false, error: "minRating must be between 1 and 5; moqMin and moqMax must be whole numbers of 1 or more" },
        { status: 400 },
      );
    }
    // An empty window is a caller error, not a catalogue with nothing in it: it
    // would return zero rows under a filter the buyer would read as reasonable.
    if (moqMin != null && moqMax != null && moqMin > moqMax) {
      return NextResponse.json(
        { success: false, error: "moqMin cannot exceed moqMax" },
        { status: 400 },
      );
    }

    const sortParam = searchParams.get("sort");
    const result = await listProducts({
      page: boundedInt(searchParams.get("page"), 1, 100000),
      limit: boundedInt(searchParams.get("limit"), 24, 100),
      search: searchParams.get("search")?.slice(0, 160) || undefined,
      categoryId,
      categorySlug,
      status: "ACTIVE" as ProductStatus,
      // Discovery is intentionally independent from B2C checkout eligibility.
      publiclyDiscoverable: wantsB2B ? undefined : true,
      b2b: wantsB2B ? true : undefined,
      inStock: searchParams.get("inStock") === "true",
      b2c,
      // Bounded like every other free-text parameter here: a brand slug is a
      // short identifier, and an unbounded one becomes a query the index
      // cannot serve.
      brandSlug: searchParams.get("brand")?.slice(0, 120) || undefined,
      minRating: minRating ?? undefined,
      moqMin: moqMin ?? undefined,
      moqMax: moqMax ?? undefined,
      sort: sortParam && SORTS.has(sortParam) ? (sortParam as "newest" | "name_asc" | "moq_asc" | "rating") : "newest",
    });

    const channel = wantsB2B ? "B2B" : "B2C";
    const products = result.products.map((product) => toCatalogListDto(product, channel, currencyParam));

    return NextResponse.json(
      { success: true, ...result, products },
      {
        headers: {
          "Cache-Control": wantsB2B
            ? "private, no-store"
            : "public, s-maxage=60, stale-while-revalidate=300",
          "Vary": wantsB2B ? "Cookie, Authorization" : "Accept-Encoding",
        },
      },
    );
  } catch {
    return NextResponse.json({ success: false, error: "Failed to fetch products" }, { status: 500 });
  }
}
