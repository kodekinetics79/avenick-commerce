import { OrderDetailSchema, OrderPathParamsSchema } from "@avenick/contracts";

import { publicOrigin } from "../../_lib/dto";
import { notFound } from "../../_lib/errors";
import { route } from "../../_lib/handler";
import { V1_RATE_LIMITS } from "../../_lib/rate-limit";
import { readOrderDetail } from "../order-read";

/**
 * GET /api/v1/orders/{id}
 *
 * ANOTHER ACCOUNT'S ORDER IS 404, NOT 403. `userId` is part of the lookup (see
 * `order-read.ts`), so an order that is not the caller's is indistinguishable
 * from one that does not exist — which is the point. A 403 would confirm that
 * the id names a real order, turning this endpoint into an oracle an attacker
 * can walk: order ids are cuids, but order NUMBERS are sequential-ish and
 * support tickets quote them. The checkout quote already answers a cart id
 * belonging to somebody else the same way.
 *
 * The openapi document lists both 403 and 404 for this path; 404 is the one
 * that is served, and 403 remains reachable through the principal (a suspended
 * or deleted account is refused before the query runs).
 */
export const GET = route({
  route: "/api/v1/orders/[id]",
  auth: "required",
  // The mobile client authenticates with a bearer token. Opt-in per route
  // and per verb, never inferred from the header: a token accepted on a
  // route that did not ask for one is how a cookie-only surface quietly
  // becomes token-accessible.
  allowBearer: true,
  params: OrderPathParamsSchema,
  response: OrderDetailSchema,
  rateLimit: { rule: V1_RATE_LIMITS.accountRead },
  handle: async (ctx) => {
    const order = await readOrderDetail({
      orderId: ctx.params.id,
      userId: ctx.principal!.userId,
      origin: publicOrigin(ctx.req),
    });
    if (!order) throw notFound("Order not found.");
    return { data: order };
  },
});

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
