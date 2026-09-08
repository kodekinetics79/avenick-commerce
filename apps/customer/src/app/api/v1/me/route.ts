import { MeSchema } from "@avenick/contracts";
import { db } from "@avenick/database";

import { publicOrigin } from "../_lib/dto";
import { forbidden } from "../_lib/errors";
import { route } from "../_lib/handler";
import { V1_RATE_LIMITS } from "../_lib/rate-limit";
import { contractPhone, toMe } from "./me-projection";

/**
 * GET /api/v1/me — who is calling.
 *
 * No role restriction: every account has an identity, and refusing a seller or
 * an admin their own profile would break the one screen every app needs before
 * it can draw any other.
 *
 * The principal is already a live Postgres read (see `_lib/principal.ts`), so
 * the row below is a second read of the same user by primary key. It is a
 * separate query rather than a widened one because the principal's `select` is
 * the revocation check — role, status, deletedAt — and widening it would put
 * the profile's columns on the hot path of every authenticated request on this
 * surface.
 */
export const GET = route({
  route: "/api/v1/me",
  auth: "required",
  response: MeSchema,
  rateLimit: { rule: V1_RATE_LIMITS.accountRead },
  handle: async (ctx) => {
    const user = await db.user.findUnique({
      where: { id: ctx.principal!.userId },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        firstNameAr: true,
        lastNameAr: true,
        avatar: true,
        role: true,
        status: true,
        language: true,
        emailVerified: true,
        phoneVerified: true,
        createdAt: true,
        companyMember: {
          select: {
            companyId: true,
            role: true,
            isActive: true,
            company: {
              select: { nameEn: true, nameAr: true, country: true, status: true, deletedAt: true },
            },
          },
        },
      },
    });

    // Unreachable through `resolvePrincipal`, which read this same row a moment
    // ago — unless the account was deleted between the two queries, in which
    // case refusing is the right answer and inventing an empty profile is not.
    if (!user) throw forbidden("This account is not permitted to use this API.");

    if (contractPhone(user.phone).dropped) {
      ctx.log.warn("v1 me: stored phone does not match the contract's format, reported as absent", {
        userId: user.id,
      });
    }

    return { data: toMe(user, publicOrigin(ctx.req)) };
  },
});

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
