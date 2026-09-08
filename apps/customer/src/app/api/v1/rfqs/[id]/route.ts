import { RfqDetailSchema, RfqPathParamsSchema } from "@avenick/contracts";

import { notFound } from "../../_lib/errors";
import { route } from "../../_lib/handler";
import { V1_RATE_LIMITS } from "../../_lib/rate-limit";
import { readRfqDetail } from "../rfq-service";

/**
 * GET /api/v1/rfqs/{id} — one request, with its quoted lines.
 *
 * OWNER SCOPING IS THE SERVICE'S. `getRFQForBuyer` builds the predicate
 * `buyerId = me` (widened to `OR companyId = mine` when the caller holds an
 * active membership) into the query itself, so another buyer's RFQ is never
 * read — and the answer is 404, indistinguishable from one that does not
 * exist, for the same reason the order detail gives it.
 *
 * ONE RFQ CARRIES AT MOST ONE SUPPLIER'S PRICES. `RFQRequest.sellerId` is a
 * single nullable column and `submitQuote` is its only writer — the first
 * seller to quote claims the request under an advisory lock. There is no
 * comparison of competing quotes to return here, and the contract does not
 * describe one; see the note on `RfqDetailSchema`.
 */
export const GET = route({
  route: "/api/v1/rfqs/[id]",
  auth: "required",
  // The mobile client authenticates with a bearer token. Opt-in per route
  // and per verb, never inferred from the header: a token accepted on a
  // route that did not ask for one is how a cookie-only surface quietly
  // becomes token-accessible.
  allowBearer: true,
  params: RfqPathParamsSchema,
  response: RfqDetailSchema,
  rateLimit: { rule: V1_RATE_LIMITS.accountRead },
  handle: async (ctx) => {
    const rfq = await readRfqDetail({ rfqId: ctx.params.id, principal: ctx.principal! });
    if (!rfq) throw notFound("Request for quote not found.");
    return { data: rfq };
  },
});

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
