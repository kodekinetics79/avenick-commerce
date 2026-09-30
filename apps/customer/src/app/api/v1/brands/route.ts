import { BrandListQuerySchema, BrandSchema } from "@avenick/contracts";
import { PUBLIC_CATALOG_SELLER, db } from "@avenick/database";

import { publicOrigin, toImage } from "../_lib/dto";
import { route } from "../_lib/handler";
import { keysetCursorKey, parseCursor } from "../_lib/keyset";
import { paginate } from "../_lib/pagination";
import { V1_RATE_LIMITS } from "../_lib/rate-limit";

/**
 * GET /api/v1/brands
 *
 * Cursor-paginated on (nameEn, id). `nameEn` is not unique — a catalogue that
 * has been imported twice under two spellings routinely has ties — so the id
 * tiebreak is what stops a brand appearing on two pages or on none.
 *
 * Only brands that lead somewhere are listed. `/api/brands` returns every
 * active brand row with a product count beside it, so the storefront's brand
 * strip advertises brands whose count is zero; every one of those is a tile
 * that lands on an empty listing. The `some` predicate below uses the same
 * seller and discoverability rules the product listing does, so a brand is
 * present here exactly when its listing has something in it.
 */
const HAS_LISTABLE_PRODUCTS = {
  status: "ACTIVE",
  deletedAt: null,
  isPubliclyDiscoverable: true,
  seller: PUBLIC_CATALOG_SELLER,
} as const;

export const GET = route({
  route: "/api/v1/brands",
  auth: "none",
  // The mobile client authenticates with a bearer token. Opt-in per route
  // and per verb, never inferred from the header: a token accepted on a
  // route that did not ask for one is how a cookie-only surface quietly
  // becomes token-accessible.
  allowBearer: true,
  query: BrandListQuerySchema,
  response: BrandSchema.array(),
  rateLimit: { rule: V1_RATE_LIMITS.catalogueRead },
  handle: async (ctx) => {
    const cursor = parseCursor(ctx.query.cursor, "keyset");
    const origin = publicOrigin(ctx.req);

    const rows = await db.brand.findMany({
      where: {
        isActive: true,
        products: { some: HAS_LISTABLE_PRODUCTS },
        ...(cursor?.mode === "keyset" && {
          AND: [
            {
              OR: [
                { nameEn: { gt: cursor.key } },
                { nameEn: cursor.key, id: { gt: cursor.id } },
              ],
            },
          ],
        }),
      },
      orderBy: [{ nameEn: "asc" }, { id: "asc" }],
      // limit + 1: the extra row is never returned; its existence IS `hasMore`.
      take: ctx.query.limit + 1,
      include: { _count: { select: { products: { where: HAS_LISTABLE_PRODUCTS } } } },
    });

    const page = paginate(rows, ctx.query.limit, (row) => keysetCursorKey(row.nameEn, row.id));
    return {
      data: page.data.map((brand) => ({
        id: brand.id,
        slug: brand.slug,
        nameEn: brand.nameEn,
        nameAr: brand.nameAr,
        logo: toImage({ url: brand.logoUrl, alt: brand.nameEn }, origin),
        productCount: brand._count.products,
      })),
      meta: page.meta,
    };
  },
});

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
