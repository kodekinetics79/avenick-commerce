import {
  AddressDeletedSchema,
  AddressPathParamsSchema,
  AddressSchema,
  UpdateAddressRequestSchema,
} from "@avenick/contracts";
import { db } from "@avenick/database";

import { toNumber } from "../../_lib/dto";
import { conflict, notFound, validationFailed } from "../../_lib/errors";
import { route } from "../../_lib/handler";
import { V1_RATE_LIMITS } from "../../_lib/rate-limit";
import { ADDRESS_SELECT, toAddress } from "../address-projection";

/**
 * One address. Every handler here scopes by `userId` in the `where` itself, so
 * an address belonging to another account is 404 — the same answer as one that
 * does not exist, and for the same reason the order detail gives it: a 403
 * would confirm the id names a real row.
 */
export const GET = route({
  route: "/api/v1/addresses/[id]",
  auth: "required",
  // The mobile client authenticates with a bearer token. Opt-in per route
  // and per verb, never inferred from the header: a token accepted on a
  // route that did not ask for one is how a cookie-only surface quietly
  // becomes token-accessible.
  allowBearer: true,
  params: AddressPathParamsSchema,
  response: AddressSchema,
  rateLimit: { rule: V1_RATE_LIMITS.accountRead },
  handle: async (ctx) => {
    const address = await db.address.findFirst({
      where: { id: ctx.params.id, userId: ctx.principal!.userId },
      select: ADDRESS_SELECT,
    });
    if (!address) throw notFound("Address not found.");
    return { data: toAddress(address) };
  },
});

/**
 * PATCH /api/v1/addresses/{id}
 *
 * A COORDINATE IS A PAIR. `CreateAddressRequestSchema` refuses a latitude with
 * no longitude; `UpdateAddressRequestSchema` does NOT — it has no such
 * refinement, so a patch setting one alone is a request the published contract
 * accepts. It is refused here anyway, against the MERGED row rather than
 * against the patch: half a coordinate is not a location, it is a point on the
 * equator or the prime meridian, and a delivery app that navigates to it goes
 * somewhere real and wrong. Flagged in the report — the refinement belongs on
 * the update schema too.
 */
export const PATCH = route({
  route: "/api/v1/addresses/[id]",
  auth: "required",
  // The mobile client authenticates with a bearer token. Opt-in per route
  // and per verb, never inferred from the header: a token accepted on a
  // route that did not ask for one is how a cookie-only surface quietly
  // becomes token-accessible.
  allowBearer: true,
  params: AddressPathParamsSchema,
  body: UpdateAddressRequestSchema,
  response: AddressSchema,
  rateLimit: { rule: V1_RATE_LIMITS.addressWrite },
  handle: async (ctx) => {
    const userId = ctx.principal!.userId;
    const patch = ctx.body;

    const updated = await db.$transaction(async (tx) => {
      const existing = await tx.address.findFirst({
        where: { id: ctx.params.id, userId },
        select: ADDRESS_SELECT,
      });
      if (!existing) throw notFound("Address not found.");

      const latitude = patch.latitude === undefined
        ? (existing.lat == null ? null : toNumber(existing.lat))
        : patch.latitude;
      const longitude = patch.longitude === undefined
        ? (existing.lng == null ? null : toNumber(existing.lng))
        : patch.longitude;
      if ((latitude == null) !== (longitude == null)) {
        throw validationFailed("An address carries both coordinates or neither.", {
          longitude: ["latitude and longitude are supplied together or not at all"],
        });
      }

      if (patch.isDefault === true) {
        await tx.address.updateMany({
          where: { userId, isDefault: true, id: { not: existing.id } },
          data: { isDefault: false },
        });
      }

      return tx.address.update({
        where: { id: existing.id },
        data: {
          ...(patch.label !== undefined && { label: patch.label }),
          ...(patch.line1 !== undefined && { line1: patch.line1 }),
          ...(patch.line2 !== undefined && { line2: patch.line2 }),
          ...(patch.city !== undefined && { city: patch.city }),
          ...(patch.country !== undefined && { country: patch.country }),
          ...(patch.postalCode !== undefined && { postalCode: patch.postalCode }),
          ...(patch.latitude !== undefined && { lat: patch.latitude }),
          ...(patch.longitude !== undefined && { lng: patch.longitude }),
          ...(patch.isDefault !== undefined && { isDefault: patch.isDefault }),
        },
        select: ADDRESS_SELECT,
      });
    });

    return { data: toAddress(updated) };
  },
});

/** Postgres foreign-key violation, as Prisma reports it. */
const FOREIGN_KEY_VIOLATION = "P2003";

/**
 * DELETE /api/v1/addresses/{id}
 *
 * A hard delete, because an order does not read this row: `createOrder` copies
 * the destination into `Order.shippingAddress` as JSON and leaves
 * `Order.addressId` null, so removing an address never rewrites history — which
 * is exactly what the contract promises.
 *
 * `Order.addressId` is nevertheless a real foreign key with no cascade, and
 * nothing stops a future writer setting it. If one has, the delete is refused
 * with 409 rather than surfacing as an unexplained 500: "this address is
 * attached to an order" is something a person can act on.
 */
export const DELETE = route({
  route: "/api/v1/addresses/[id]",
  auth: "required",
  // The mobile client authenticates with a bearer token. Opt-in per route
  // and per verb, never inferred from the header: a token accepted on a
  // route that did not ask for one is how a cookie-only surface quietly
  // becomes token-accessible.
  allowBearer: true,
  params: AddressPathParamsSchema,
  response: AddressDeletedSchema,
  rateLimit: { rule: V1_RATE_LIMITS.addressWrite },
  handle: async (ctx) => {
    try {
      // deleteMany, not delete: the userId predicate is part of the statement,
      // so another account's address is never deleted and the count tells us
      // whether anything matched — no read-then-write race in between.
      const removed = await db.address.deleteMany({
        where: { id: ctx.params.id, userId: ctx.principal!.userId },
      });
      if (removed.count === 0) throw notFound("Address not found.");
    } catch (error) {
      if ((error as { code?: unknown } | null)?.code === FOREIGN_KEY_VIOLATION) {
        throw conflict("This address is attached to an order and cannot be removed.");
      }
      throw error;
    }

    return { data: { id: ctx.params.id, deleted: true as const } };
  },
});

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
