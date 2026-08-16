import { NextRequest, NextResponse } from "next/server";
import { listProducts } from "@avenick/database";
import type { Currency, ProductStatus } from "@avenick/database";
import { getServerB2BContext } from "@/lib/b2b-server";
import { toCatalogListDto } from "@/lib/catalog-list-dto";

const CURRENCIES = new Set<Currency>(["AED", "SAR", "QAR", "KWD", "OMR", "BHD", "USD"]);

function boundedInt(value: string | null, fallback: number, max: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

export async function GET(req: NextRequest) {
  try {
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
