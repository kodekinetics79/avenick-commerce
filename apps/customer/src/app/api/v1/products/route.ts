import { ProductCardSchema, ProductListQuerySchema } from "@avenick/contracts";

import { publicOrigin } from "../_lib/dto";
import { forbidden, unauthenticated } from "../_lib/errors";
import { route } from "../_lib/handler";
import { V1_RATE_LIMITS } from "../_lib/rate-limit";
import { readCataloguePage } from "./product-page";

/**
 * GET /api/v1/products
 *
 * Public, because a catalogue a phone cannot browse before signing in is a
 * catalogue nobody signs in for. The one exception is the B2B channel: business
 * prices are contract prices, so `channel=B2B` needs a live company membership
 * and is refused without one — the same boundary `/api/products` draws with
 * `getServerB2BContext`, and the same one the checkout quote draws.
 *
 * The page is cursor-paginated with no `count()` anywhere on the plain browse
 * path. See `product-page.ts` for the two paths and why the ranked one still
 * delegates.
 */
export const GET = route({
  route: "/api/v1/products",
  // "optional", not "none": a signed-in caller's company membership decides
  // whether B2B pricing may be quoted, and a session naming a revoked account
  // must still be refused rather than quietly degraded to a guest.
  auth: "optional",
  query: ProductListQuerySchema,
  response: ProductCardSchema.array(),
  rateLimit: { rule: V1_RATE_LIMITS.catalogueRead },
  handle: async (ctx) => {
    if (ctx.query.channel === "B2B") {
      if (!ctx.principal) throw unauthenticated("Sign in to see business pricing.");
      if (!ctx.principal.companyId) {
        throw forbidden("An active company account is required for business pricing.");
      }
    }

    const page = await readCataloguePage({
      query: ctx.query,
      principal: ctx.principal,
      origin: publicOrigin(ctx.req),
    });
    return { data: page.data, meta: page.meta };
  },
});

/** Catalogue rows change when a seller publishes, not when this app is built. */
export const dynamic = "force-dynamic";
/** Prisma is Node-only; never bundle this for edge. */
export const runtime = "nodejs";
