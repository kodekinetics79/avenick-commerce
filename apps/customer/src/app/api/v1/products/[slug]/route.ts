import {
  ProductBySlugPathParamsSchema,
  ProductBySlugQuerySchema,
  ProductDetailSchema,
} from "@avenick/contracts";
import { attachProductRatings, getProductBySlug } from "@avenick/database";

import { publicOrigin } from "../../_lib/dto";
import { forbidden, notFound, unauthenticated } from "../../_lib/errors";
import { route } from "../../_lib/handler";
import { V1_RATE_LIMITS } from "../../_lib/rate-limit";
import { toProductDetail, type ProductDetailSource } from "../product-projection";

/**
 * GET /api/v1/products/{slug}
 *
 * The fat DTO: everything a product page draws, in one request. Reviews are
 * deliberately NOT inlined — `/api/products/[slug]` returns the newest twenty
 * review bodies inside the payload, which is a page of user-generated text
 * nobody has scrolled to yet.
 *
 * WHAT IS REACHABLE HERE IS EXACTLY WHAT IS LISTABLE, which after the
 * channel-awareness change means: publicly discoverable, ACTIVE, behind a live
 * seller. That is the argument `getProductBySlug` already makes about withdrawn
 * sellers — an indexed URL that outlives its listing lands on an item checkout
 * will refuse — applied to the listing this endpoint backs.
 *
 * IT NO LONGER 404s AN UNSELLABLE PRODUCT. It used to require `isB2CEnabled`,
 * which made every card in a quote-only catalogue tap through to a not-found
 * screen. The detail now answers for anything the listing shows and states
 * `sellableInChannel`, so the page renders either Add to Cart or Request a
 * Quote. `secureCreateOrder` is still the thing that refuses an order for a
 * false one, so nothing unsellable becomes buyable — it becomes VISIBLE, which
 * is the difference between a catalogue and an empty screen.
 */
export const GET = route({
  route: "/api/v1/products/[slug]",
  auth: "optional",
  // The mobile client authenticates with a bearer token. Opt-in per route
  // and per verb, never inferred from the header: a token accepted on a
  // route that did not ask for one is how a cookie-only surface quietly
  // becomes token-accessible.
  allowBearer: true,
  params: ProductBySlugPathParamsSchema,
  query: ProductBySlugQuerySchema,
  response: ProductDetailSchema,
  rateLimit: { rule: V1_RATE_LIMITS.catalogueRead },
  handle: async (ctx) => {
    const { channel, currency } = ctx.query;
    if (channel === "B2B") {
      if (!ctx.principal) throw unauthenticated("Sign in to see business pricing.");
      if (!ctx.principal.companyId) {
        throw forbidden("An active company account is required for business pricing.");
      }
    }

    // The service applies the seller predicate and filters price bands to the
    // channel and currency. Nothing about the money is re-derived here.
    const product = await getProductBySlug(ctx.params.slug, channel, currency);
    if (!product || product.status !== "ACTIVE") throw notFound("Product not found.");
    // The listing's own predicate, and nothing more. Whether the product can be
    // ORDERED is answered by `sellableInChannel` on the payload, not by hiding
    // the page.
    if (!product.isPubliclyDiscoverable) throw notFound("Product not found.");

    // The product's OWN standing, through the service's grouped aggregate.
    // `getProductBySlug` returns the seller's average and the newest twenty
    // review bodies, but not this product's average — and averaging the twenty
    // it loaded would be a different number from the one the tile prints.
    const [rated] = await attachProductRatings([{ id: product.id }]);

    return {
      data: toProductDetail(
        product as unknown as ProductDetailSource,
        rated?.rating ?? null,
        channel,
        publicOrigin(ctx.req),
      ),
    };
  },
});

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
