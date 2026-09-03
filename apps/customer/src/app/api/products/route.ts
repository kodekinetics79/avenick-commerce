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
      sort: searchParams.get("sort") === "name_asc" ? "name_asc" : "newest",
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
