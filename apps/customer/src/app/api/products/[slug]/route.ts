import { NextRequest, NextResponse } from "next/server";
import { getProductBySlug, type Currency } from "@avenick/database";
import { resolveCatalogChannel } from "@/lib/catalog-channel";
import { toCatalogDetailDto } from "@/lib/catalog-detail-dto";
import { catalogThrottle } from "@/lib/catalog-throttle";

const CURRENCIES = new Set<Currency>(["AED", "SAR", "QAR", "KWD", "OMR", "BHD", "USD"]);

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const throttled = await catalogThrottle(req.headers);
    if (throttled) return throttled;

    const wantsB2B = req.nextUrl.searchParams.get("b2b") === "true";
    const currencyParam = req.nextUrl.searchParams.get("currency")?.toUpperCase() as Currency | undefined;
    if (currencyParam && !CURRENCIES.has(currencyParam)) {
      return NextResponse.json({ success: false, error: "Unsupported currency" }, { status: 400 });
    }

    const resolved = await resolveCatalogChannel(wantsB2B);
    if (!resolved.ok) return resolved.response;
    const channel = resolved.channel;
    const product = await getProductBySlug(params.slug, channel, currencyParam);
    if (!product || product.status !== "ACTIVE") {
      return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 });
    }
    if (wantsB2B && !product.isB2BEnabled) {
      return NextResponse.json({ success: false, error: "Product not available for B2B ordering" }, { status: 404 });
    }
    if (!wantsB2B && !product.isPubliclyDiscoverable) {
      return NextResponse.json({ success: false, error: "Product not available for public discovery" }, { status: 404 });
    }

    return NextResponse.json(
      { success: true, data: toCatalogDetailDto(product, channel) },
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
    return NextResponse.json({ success: false, error: "Failed to fetch product" }, { status: 500 });
  }
}
