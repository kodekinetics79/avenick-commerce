import { db, type UserRole } from "@avenick/database";

import { auth } from "@/lib/auth-instance";

import { forbidden } from "./errors";

/**
 * Who is calling, re-read from Postgres on every request.
 *
 * This is the reason the v1 surface lives inside `apps/customer` and shares
 * `@avenick/database` in-process rather than sitting behind an HTTP hop.
 * `guarded()` in `packages/auth/src/api.ts` re-reads `role`, `status` and
 * `deletedAt` per request (api.ts:129-137) because that live read IS the
 * revocation mechanism: a suspended seller, a deleted account or a demoted
 * admin stops being able to act on the very next request, not when some token
 * happens to expire. A cached claim in a JWT cannot do that, so v1 does the
 * same read.
 *
 * NOTE FOR THE BACKEND: the contract describes /v1 as a bearer-token surface
 * (`packages/contracts/src/auth.ts`), but nothing stores a refresh token yet —
 * `Session` holds an opaque token with an `expiresAt` and no device, rotation
 * lineage or revocation reason. Until `POST /v1/auth/token` exists, the
 * principal is resolved from the portal session, which is what the phone gets
 * through the web view today. The live re-read below is unaffected by which
 * credential named the user, so swapping the credential later changes this
 * function's first three lines and nothing else.
 */
export interface Principal {
  userId: string;
  role: UserRole;
  /** The caller's ACTIVE company membership, or null. B2B pricing needs one. */
  companyId: string | null;
}

/** Buyer roles. Mirrors the check `createOrder` performs inside its transaction. */
export const BUYER_ROLES: readonly UserRole[] = [
  "CONSUMER",
  "COMPANY_ADMIN",
  "COMPANY_BUYER",
  "COMPANY_APPROVER",
];

/**
 * Resolve the caller, or null when there is no session at all.
 *
 * A session that names a user who is no longer permitted does NOT come back as
 * null. Degrading a suspended account to "guest" would quietly re-admit it
 * everywhere the endpoint is willing to serve a guest, which is the opposite
 * of a revocation. It throws `forbidden` instead — the same answer
 * `guarded()` gives, and the same one the contract describes for a valid
 * credential that is not allowed to act.
 */
export async function resolvePrincipal(): Promise<Principal | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      status: true,
      deletedAt: true,
      companyMember: {
        select: {
          companyId: true,
          isActive: true,
          company: { select: { status: true, deletedAt: true } },
        },
      },
    },
  });
  if (!user || user.status !== "ACTIVE" || user.deletedAt) {
    throw forbidden("This account is not permitted to use this API.");
  }

  const member = user.companyMember;
  const companyActive =
    !!member && member.isActive && member.company.status === "ACTIVE" && !member.company.deletedAt;

  return { userId, role: user.role, companyId: companyActive ? member.companyId : null };
}
