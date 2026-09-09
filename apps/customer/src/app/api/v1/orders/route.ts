import {
  OrderCardSchema,
  OrderListQuerySchema,
  PlaceOrderRequestSchema,
  PlacedOrderSchema,
} from "@avenick/contracts";
import { RATE_LIMITS } from "@avenick/auth/rate-limit";
import { db } from "@avenick/database";

import { publicOrigin } from "../_lib/dto";
import { route } from "../_lib/handler";
import { keysetCursorKey, parseCursor } from "../_lib/keyset";
import { paginate } from "../_lib/pagination";
import { BUYER_ROLES } from "../_lib/principal";
import { V1_RATE_LIMITS } from "../_lib/rate-limit";
import { THUMBNAIL_ITEM_SCAN, toOrderCard } from "./order-projection";
import { placeOrder } from "./place-order";

/**
 * GET /api/v1/orders — the signed-in account's orders, newest first.
 *
 * OWNER SCOPING IS THE PREDICATE, NOT A CHECK. `userId` is part of the `where`,
 * so there is no branch that could be reordered, short-circuited or forgotten:
 * a row belonging to another account is not filtered out after being read, it
 * is never read. `Order` is indexed on `[userId, status]`, so the scoping is
 * also what makes the query cheap.
 *
 * No role restriction. This is an account reading its own records; a seller or
 * an admin who has also bought something has orders here, and refusing them
 * would hide a buyer's own history behind the hat they happen to be wearing.
 *
 * Cursor-paginated on (createdAt, id) — `/api/orders` returns EVERY order the
 * account has ever placed, with all of its items, unpaginated.
 */
export const GET = route({
  route: "/api/v1/orders",
  auth: "required",
  // The mobile client authenticates with a bearer token. Opt-in per route
  // and per verb, never inferred from the header: a token accepted on a
  // route that did not ask for one is how a cookie-only surface quietly
  // becomes token-accessible.
  allowBearer: true,
  query: OrderListQuerySchema,
  response: OrderCardSchema.array(),
  rateLimit: { rule: V1_RATE_LIMITS.accountRead },
  handle: async (ctx) => {
    const cursor = parseCursor(ctx.query.cursor, "keyset");
    const placedBefore = cursor?.mode === "keyset" ? new Date(cursor.key) : null;

    const rows = await db.order.findMany({
      where: {
        userId: ctx.principal!.userId,
        ...(ctx.query.status && { status: ctx.query.status }),
        // Two orders placed in the same millisecond — a retry, an import — are
        // separated by id, so neither is shown twice nor skipped.
        ...(cursor?.mode === "keyset" && placedBefore && !Number.isNaN(placedBefore.getTime()) && {
          AND: [
            {
              OR: [
                { createdAt: { lt: placedBefore } },
                { createdAt: placedBefore, id: { gt: cursor.id } },
              ],
            },
          ],
        }),
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      // limit + 1: the extra row is never returned; its existence IS `hasMore`.
      take: ctx.query.limit + 1,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        type: true,
        currency: true,
        total: true,
        createdAt: true,
        // The true line count, independent of the thumbnail window below.
        _count: { select: { items: true } },
        items: {
          take: THUMBNAIL_ITEM_SCAN,
          orderBy: { id: "asc" },
          select: {
            product: {
              select: { images: { where: { isPrimary: true }, take: 1, select: { url: true, altEn: true } } },
            },
          },
        },
      },
    });

    const origin = publicOrigin(ctx.req);
    const page = paginate(rows, ctx.query.limit, (row) =>
      keysetCursorKey(row.createdAt.toISOString(), row.id));

    return {
      data: page.data.map((order) => toOrderCard(order, origin)),
      meta: page.meta,
    };
  },
});

/**
 * POST /api/v1/orders — the write the app could not previously make at all.
 *
 * The policy lives in `place-order.ts`; what is decided here is who may reach
 * it and how often.
 *
 * ROLES. `secureCreateOrder` refuses a seller or an admin account inside its
 * transaction ("This account is not permitted to place customer orders").
 * Refusing here too means the app finds out before the buyer fills in a form,
 * and it is the same list the checkout quote applies.
 *
 * RATE LIMIT. `RATE_LIMITS.orderCreate` — the SHARED rule, not a v1-local one,
 * because this is not a v1-shaped cost. It is the same transaction, taking the
 * same stock locks against the same pool, as the web checkout; two independent
 * budgets for one write is how a client that is throttled on one surface
 * discovers it can keep going on the other.
 */
export const POST = route({
  route: "/api/v1/orders",
  auth: "required",
  // The mobile client authenticates with a bearer token. Opt-in per route
  // and per verb, never inferred from the header: a token accepted on a
  // route that did not ask for one is how a cookie-only surface quietly
  // becomes token-accessible.
  allowBearer: true,
  roles: BUYER_ROLES,
  body: PlaceOrderRequestSchema,
  response: PlacedOrderSchema,
  rateLimit: { rule: RATE_LIMITS.orderCreate },
  handle: async (ctx) => ({
    data: await placeOrder({
      request: ctx.body,
      principal: ctx.principal!,
      // Read from the header rather than the body: a key inside the payload is
      // one a client regenerates along with the payload, and a retry that
      // changes its key is not a retry.
      idempotencyKeyHeader: ctx.req.headers.get("idempotency-key"),
      origin: publicOrigin(ctx.req),
    }),
  }),
});

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
