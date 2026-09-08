import { RfqDecisionRequestSchema, RfqDetailSchema, RfqPathParamsSchema } from "@avenick/contracts";
import { decideRFQ } from "@avenick/database";

import { V1Error, conflict, notFound } from "../../../_lib/errors";
import { route } from "../../../_lib/handler";
import { V1_RATE_LIMITS } from "../../../_lib/rate-limit";
import { readRfqDetail } from "../../rfq-service";

/**
 * POST /api/v1/rfqs/{id}/decision — accept or reject a supplier's quote.
 *
 * This is where the quote journey terminates, and it is the one write on this
 * surface with an OPTIMISTIC CONCURRENCY CHECK the client must participate in.
 * `decideRFQ` compares `expectedQuoteVersion` against the stored version inside
 * a transaction holding the RFQ's advisory lock, and refuses when they differ —
 * so a buyer who opened a quote, went to lunch and tapped Accept after the
 * supplier revised the price is told the quote moved instead of being bound to
 * a number they never saw. That is why the field is required rather than
 * optional: an optional one is an optional guarantee.
 *
 * A separate path rather than a PATCH on the RFQ because it is not a field
 * edit. `/api/b2b/rfqs/[id]` models it as PATCH and answers every failure with
 * one 409; here the three distinguishable outcomes stay distinguishable.
 */
const NOT_FOUND = /not found/i;
const STATE_CONFLICT = /only quoted|changed since|changed concurrently|required/i;

export const POST = route({
  route: "/api/v1/rfqs/[id]/decision",
  auth: "required",
  params: RfqPathParamsSchema,
  body: RfqDecisionRequestSchema,
  response: RfqDetailSchema,
  rateLimit: { rule: V1_RATE_LIMITS.rfqWrite },
  handle: async (ctx) => {
    const principal = ctx.principal!;
    try {
      await decideRFQ({
        rfqId: ctx.params.id,
        buyerId: principal.userId,
        // The service builds the visibility predicate from these two, so a
        // decision on somebody else's RFQ is refused by the same rule that
        // hides it from the read.
        ...(principal.companyId ? { companyId: principal.companyId } : {}),
        decision: ctx.body.decision,
        expectedQuoteVersion: ctx.body.expectedQuoteVersion,
      });
    } catch (error) {
      if (error instanceof V1Error) throw error;
      const message = error instanceof Error ? error.message : "";
      // 404 for an RFQ that is not this buyer's, exactly as the read answers:
      // a 403 would confirm the id names a real request.
      if (NOT_FOUND.test(message)) throw notFound("Request for quote not found.");
      // The buyer's decision contradicts the request's current state — it is
      // not quoted, or the quote moved. The message names which.
      if (STATE_CONFLICT.test(message)) throw conflict(message);
      throw error;
    }

    const rfq = await readRfqDetail({ rfqId: ctx.params.id, principal });
    if (!rfq) throw notFound("Request for quote not found.");
    return { data: rfq };
  },
});

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
