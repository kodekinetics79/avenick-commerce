import {
  AddressSchema,
  CreateAddressRequestSchema,
} from "@avenick/contracts";
import { db } from "@avenick/database";

import { route } from "../_lib/handler";
import { V1_RATE_LIMITS } from "../_lib/rate-limit";
import { ADDRESS_SELECT, toAddress } from "./address-projection";

/**
 * The account's address book.
 *
 * OWNER SCOPING IS THE PREDICATE. `userId` is part of every `where` on this
 * surface, including the writes, so another account's address is never read and
 * never updated — there is no ownership branch that could be reordered away.
 *
 * COMPANY ADDRESSES ARE NOT LISTED HERE. `Address` carries both `userId` and
 * `companyId`, and a company's shared addresses belong to the company rather
 * than to whoever happens to be signed in; the contract has no field that could
 * tell the two apart, so exposing them would make a colleague's edit look like
 * the caller's own. Flagged in the report — the fix is a field on the contract,
 * not a wider query here.
 */

/** The contract caps the list at 100. An account with more has a different problem. */
const MAX_ADDRESSES = 100;

export const GET = route({
  route: "/api/v1/addresses",
  auth: "required",
  // Returned whole, not cursored: an account holds a handful of addresses, and
  // paginating five rows costs a round trip to learn there is no second page.
  response: AddressSchema.array().max(MAX_ADDRESSES),
  rateLimit: { rule: V1_RATE_LIMITS.accountRead },
  handle: async (ctx) => {
    const rows = await db.address.findMany({
      where: { userId: ctx.principal!.userId },
      // The default first, so the checkout screen's preselection is the first
      // row rather than a search through the list.
      orderBy: [{ isDefault: "desc" }, { label: "asc" }, { id: "asc" }],
      take: MAX_ADDRESSES,
      select: ADDRESS_SELECT,
    });
    return { data: rows.map(toAddress) };
  },
});

/**
 * POST /api/v1/addresses
 *
 * `isDefault: true` clears the flag on every other address the account holds,
 * inside one transaction. Two default addresses is a state no client should be
 * able to create, and doing it as two round trips from the app would leave
 * exactly that state behind whenever the second one failed.
 *
 * The flag is honoured LITERALLY: an account whose first address arrives with
 * `isDefault: false` ends up with no default, and the server does not promote
 * it. Promotion would be a rule the contract does not describe, and a client
 * that reads back `isDefault: false` after sending it would be right to call
 * that a bug.
 */
export const POST = route({
  route: "/api/v1/addresses",
  auth: "required",
  body: CreateAddressRequestSchema,
  response: AddressSchema,
  rateLimit: { rule: V1_RATE_LIMITS.addressWrite },
  handle: async (ctx) => {
    const userId = ctx.principal!.userId;
    const body = ctx.body;

    const created = await db.$transaction(async (tx) => {
      if (body.isDefault) {
        await tx.address.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.address.create({
        data: {
          userId,
          label: body.label,
          line1: body.line1,
          line2: body.line2 ?? null,
          city: body.city,
          country: body.country,
          postalCode: body.postalCode ?? null,
          lat: body.latitude ?? null,
          lng: body.longitude ?? null,
          isDefault: body.isDefault,
        },
        select: ADDRESS_SELECT,
      });
    });

    return { data: toAddress(created) };
  },
});

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
