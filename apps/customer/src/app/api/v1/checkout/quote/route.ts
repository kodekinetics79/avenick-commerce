import { CheckoutQuoteRequestSchema, CheckoutQuoteSchema } from "@avenick/contracts";

import { route } from "../../_lib/handler";
import { BUYER_ROLES } from "../../_lib/principal";
import { V1_RATE_LIMITS } from "../../_lib/rate-limit";
import { buildCheckoutQuote } from "./quote-service";

/**
 * POST /api/v1/checkout/quote
 *
 * The route file holds no logic on purpose: the wrapper owns the envelope, the
 * validation and the error mapping, and `quote-service.ts` owns the money. All
 * that is decided here is the endpoint's policy.
 *
 * AUTHENTICATION — a deliberate divergence from the published document, and a
 * decision that needs confirming rather than assuming:
 *
 * `packages/contracts/src/openapi/document.ts` registers this path with
 * `security` (bearer required) and lists a 401, while it registers
 * `GET /v1/products` with `security: []`. Read literally, a guest may browse
 * but may not be told what their basket costs — so the app would have to
 * demand a sign-in before it can show a total, which is the single most
 * reliable way to lose a first-time buyer.
 *
 * This route serves a guest. It is stated here, in the code that diverges,
 * because the fix belongs in the contract: the path should be registered as
 * `security: [{ bearerAuth: [] }, {}]` — bearer OPTIONAL — so the generated
 * Dart client knows a guest call is legitimate. Until that lands the server is
 * more permissive than its own document, which is the wrong way round.
 *
 * A guest is not quoted the same way a signed-in buyer is, and the difference
 * is real: promotions are skipped entirely (see `quote-service.ts`), so a guest
 * total can only come DOWN on sign-in, never up.
 */
export const POST = route({
  route: "/api/v1/checkout/quote",
  auth: "optional",
  // The mobile client authenticates with a bearer token. Opt-in per route
  // and per verb, never inferred from the header: a token accepted on a
  // route that did not ask for one is how a cookie-only surface quietly
  // becomes token-accessible.
  allowBearer: true,
  // Applies only when somebody IS signed in. A seller or an admin account has
  // no consumer basket, and `createOrder` refuses them inside its transaction;
  // refusing here means the app finds out before the buyer fills a form.
  roles: BUYER_ROLES,
  body: CheckoutQuoteRequestSchema,
  response: CheckoutQuoteSchema,
  rateLimit: { rule: V1_RATE_LIMITS.checkoutQuote },
  handle: async (ctx) => ({
    data: await buildCheckoutQuote({
      request: ctx.body,
      principal: ctx.principal,
      requestId: ctx.requestId,
      log: ctx.log,
    }),
  }),
});

/**
 * Every figure in the answer is read live — prices, promotions, tariffs, the
 * caller's own account. Nothing about it may be cached or prerendered.
 */
export const dynamic = "force-dynamic";
/** Prisma and the promotions engine are Node-only; never bundle this for edge. */
export const runtime = "nodejs";
