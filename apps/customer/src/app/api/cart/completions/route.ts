import { NextRequest, NextResponse } from "next/server";
import { getCartCompletions, type Currency } from "@avenick/database";
import { checkRateLimit, clientIpFrom, type RateLimitRule } from "@avenick/auth/rate-limit";
import { toCatalogListDto } from "@/lib/catalog-list-dto";

export const dynamic = "force-dynamic";

const CURRENCIES = new Set<Currency>(["AED", "SAR", "QAR", "KWD", "OMR", "BHD", "USD"]);
const MAX_BASKET_IDS = 50;
const CUID = /^c[a-z0-9]{20,32}$/;

/**
 * Public and anonymous, like the catalogue: the cart is client state, so most
 * baskets belong to nobody the server can name. Rate-limited to the catalogue
 * read cap so a basket cannot be used to enumerate affinities faster than the
 * product pages that produce them.
 */
const COMPLETIONS_LIMIT: RateLimitRule = { name: "cart-completions", limit: 120, windowMs: 60_000 };

/**
 * "Complete your order" for a basket.
 *
 * POST, because the basket travels in the body: a GET with fifty ids in the
 * query string is a cache key nobody wants and a URL length nobody promised.
 * The ids are validated for shape and capped, so a hostile body cannot turn
 * into a wide scan.
 *
 * Every row goes through toCatalogListDto with the viewer's channel and
 * currency — price privacy lives there, and a basket is not a side door to B2B
 * pricing. `rating` is re-attached after the DTO. Rows already in the basket
 * are excluded by the service and again here, because a "you might also need"
 * that suggests what you already have is the fastest way to teach a buyer the
 * rail is noise.
 */
export async function POST(req: NextRequest) {
  try {
    const rl = await checkRateLimit(COMPLETIONS_LIMIT, clientIpFrom(req.headers));
    if (!rl.ok) {
      return NextResponse.json(
        { success: false, error: "Too many requests." },
        { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))), "Cache-Control": "no-store" } },
      );
    }

    const body = (await req.json().catch(() => null)) as { productIds?: unknown; b2b?: unknown; currency?: unknown } | null;
    const ids = Array.isArray(body?.productIds)
      ? [...new Set(body!.productIds.filter((v): v is string => typeof v === "string" && CUID.test(v)))].slice(0, MAX_BASKET_IDS)
      : [];
    if (ids.length === 0) {
      return NextResponse.json({ success: true, data: [] }, { headers: { "Cache-Control": "no-store" } });
    }

    const wantsB2B = body?.b2b === true;
    const currencyParam = typeof body?.currency === "string" ? (body.currency.toUpperCase() as Currency) : undefined;
    if (currencyParam && !CURRENCIES.has(currencyParam)) {
      return NextResponse.json({ success: false, error: "Unsupported currency" }, { status: 400 });
    }
    const channel = wantsB2B ? "B2B" : "B2C";
    const inBasket = new Set(ids);

    const rows = await getCartCompletions(ids, { limit: 8 });
    const data = rows
      .filter((row) => !inBasket.has(row.id))
      .map((row) => ({ ...toCatalogListDto(row as any, channel, currencyParam), rating: (row as any).rating ?? null }));

    return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}
