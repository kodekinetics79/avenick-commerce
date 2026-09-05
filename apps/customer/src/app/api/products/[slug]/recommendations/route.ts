import { NextRequest, NextResponse } from "next/server";
import {
  getBoughtTogether,
  getProductBySlug,
  getRelatedProducts,
  getTrendingProducts,
  type Currency,
} from "@avenick/database";
import { toCatalogListDto } from "@/lib/catalog-list-dto";
import { resolveCatalogChannel } from "@/lib/catalog-channel";

export const dynamic = "force-dynamic";

const CURRENCIES = new Set<Currency>(["AED", "SAR", "QAR", "KWD", "OMR", "BHD", "USD"]);

/**
 * The selling rails for one product page, in one round trip.
 *
 * Three lists, three DIFFERENT claims, kept apart on purpose so the UI can
 * label each truthfully:
 *
 *   related        — catalogue affinity (category, brand, tags). Real today.
 *   boughtTogether — order co-occurrence with a minimum support and a quorum.
 *                    Empty until enough real orders exist; the service never
 *                    substitutes "related" under this name, and neither does
 *                    this route. A rail called "others also bought" that shows
 *                    products nobody bought together is the kind of claim a
 *                    procurement buyer eventually checks.
 *   trending       — the view signal, with its own quorum. Empty until fed.
 *
 * Every row goes through toCatalogListDto with the viewer's channel and
 * currency, exactly as /api/products does. That is where price privacy lives:
 * an anonymous visitor must not be handed a B2B price through a side door
 * called "recommendations". `rating` is re-attached after the DTO because the
 * DTO builds a fresh object and knows nothing about reviews.
 */
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const wantsB2B = req.nextUrl.searchParams.get("b2b") === "true";
    const currencyParam = req.nextUrl.searchParams.get("currency")?.toUpperCase() as Currency | undefined;
    if (currencyParam && !CURRENCIES.has(currencyParam)) {
      return NextResponse.json({ success: false, error: "Unsupported currency" }, { status: 400 });
    }
    // A flag is a request; only the session can grant the channel.
    const resolved = await resolveCatalogChannel(wantsB2B);
    if (!resolved.ok) return resolved.response;
    const channel = resolved.channel;

    const product = await getProductBySlug(params.slug, channel, currencyParam);
    if (!product || (!wantsB2B && !product.isPubliclyDiscoverable)) {
      return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 });
    }

    const [related, boughtTogether, trending] = await Promise.all([
      getRelatedProducts(product.id, { limit: 10 }),
      getBoughtTogether(product.id, { limit: 5 }),
      getTrendingProducts({ limit: 5 }),
    ]);

    const shape = (rows: Array<Record<string, any>>) =>
      rows
        .filter((row) => row["id"] !== product.id)
        .map((row) => ({ ...toCatalogListDto(row as any, channel, currencyParam), rating: row["rating"] ?? null }));

    return NextResponse.json(
      { success: true, data: { related: shape(related), boughtTogether: shape(boughtTogether), trending: shape(trending) } },
      {
        headers: {
          // Affinity changes with the catalogue, not per visitor; a minute at
          // the edge is plenty. B2B pricing varies by viewer and is never
          // shared-cached.
          "Cache-Control": wantsB2B ? "private, no-store" : "public, s-maxage=60, stale-while-revalidate=300",
          Vary: wantsB2B ? "Cookie, Authorization" : "Accept-Encoding",
        },
      },
    );
  } catch {
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}
