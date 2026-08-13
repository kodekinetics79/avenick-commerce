import { NextRequest, NextResponse } from "next/server";
import { getProductBySlug, type Currency } from "@avenick/database";
import { getServerB2BContext } from "@/lib/b2b-server";

const CURRENCIES = new Set<Currency>(["AED", "SAR", "QAR", "KWD", "OMR", "BHD", "USD"]);

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const wantsB2B = req.nextUrl.searchParams.get("b2b") === "true";
    const currencyParam = req.nextUrl.searchParams.get("currency")?.toUpperCase() as Currency | undefined;
    if (currencyParam && !CURRENCIES.has(currencyParam)) {
      return NextResponse.json({ success: false, error: "Unsupported currency" }, { status: 400 });
    }

    if (wantsB2B) {
      const ctx = await getServerB2BContext();
      if (!ctx) {
        return NextResponse.json({ success: false, error: "Active company account required for B2B pricing" }, { status: 401 });
      }
    }

    const channel = wantsB2B ? "B2B" : "B2C";
    const product = await getProductBySlug(params.slug, channel, currencyParam);
    if (!product || product.status !== "ACTIVE") {
      return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 });
    }
    if (wantsB2B && !product.isB2BEnabled) {
      return NextResponse.json({ success: false, error: "Product not available for B2B ordering" }, { status: 404 });
    }
    if (!wantsB2B && !product.isB2CEnabled) {
      return NextResponse.json({ success: false, error: "Product not available for public ordering" }, { status: 404 });
    }

    return NextResponse.json(
      { success: true, data: product },
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
