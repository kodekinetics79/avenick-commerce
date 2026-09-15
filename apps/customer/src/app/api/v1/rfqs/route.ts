import { CreateRfqRequestSchema, RFQ_LIST_MAX, RfqCardSchema, RfqDetailSchema } from "@avenick/contracts";
import { getRFQsForBuyer } from "@avenick/database";

import { route } from "../_lib/handler";
import { V1_RATE_LIMITS } from "../_lib/rate-limit";
import { toRfqCard, type RfqCardRow } from "./rfq-projection";
import { createRfqForBuyer } from "./rfq-service";

/**
 * /api/v1/rfqs — "Request a quote", which for this catalogue is the primary
 * buying action rather than a B2B side-door.
 *
 * NOT GATED ON A COMPANY, and this is a deliberate divergence from
 * `/api/b2b/rfqs`, which refuses anyone without an active company membership.
 * The app now shows "Request a Quote" wherever a product is not consumer-
 * sellable — which today is the whole catalogue — so gating on a company would
 * make that button dead for every consumer who taps it. `createRFQ` takes
 * `companyId` as OPTIONAL and the seed itself holds a personal RFQ with no
 * company, so a buyer-owned request is a state the data models and the service
 * already supports. A membership widens who else can see the request; it is not
 * the price of raising one.
 */
export const GET = route({
  route: "/api/v1/rfqs",
  auth: "required",
  // The mobile client authenticates with a bearer token. Opt-in per route
  // and per verb, never inferred from the header: a token accepted on a
  // route that did not ask for one is how a cookie-only surface quietly
  // becomes token-accessible.
  allowBearer: true,
  /**
   * Returned whole, not cursored. `getRFQsForBuyer` reads a fixed `take: 50`
   * with no cursor support, so promising a page this endpoint cannot produce
   * would be worse than stating the bound — a buyer with more than fifty
   * requests cannot reach the rest, which is flagged in the report rather than
   * hidden behind a `hasMore` that is always false.
   */
  response: RfqCardSchema.array().max(RFQ_LIST_MAX),
  rateLimit: { rule: V1_RATE_LIMITS.accountRead },
  handle: async (ctx) => {
    const rfqs = await getRFQsForBuyer({
      buyerId: ctx.principal!.userId,
      // Widens visibility to the company's requests. The service builds the
      // predicate; this endpoint never restates it.
      ...(ctx.principal!.companyId ? { companyId: ctx.principal!.companyId } : {}),
    });
    return { data: (rfqs as unknown as RfqCardRow[]).map(toRfqCard) };
  },
});

export const POST = route({
  route: "/api/v1/rfqs",
  auth: "required",
  // The mobile client authenticates with a bearer token. Opt-in per route
  // and per verb, never inferred from the header: a token accepted on a
  // route that did not ask for one is how a cookie-only surface quietly
  // becomes token-accessible.
  allowBearer: true,
  body: CreateRfqRequestSchema,
  response: RfqDetailSchema,
  rateLimit: { rule: V1_RATE_LIMITS.rfqWrite },
  handle: async (ctx) => ({
    data: await createRfqForBuyer({ request: ctx.body, principal: ctx.principal! }),
  }),
});

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
