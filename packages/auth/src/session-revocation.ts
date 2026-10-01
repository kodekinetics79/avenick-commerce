/**
 * The one definition of "this session was issued before the account's cutoff".
 *
 * WHY THIS EXISTS. Web sessions are NextAuth JWTs (`strategy: "jwt"`,
 * `maxAge: 30 days` in config.ts). They carry no server-side row, so there has
 * never been anything to delete when a credential is invalidated: a cookie
 * stolen the day before a password reset kept working for the rest of that
 * month. `User.sessionsValidAfter` is the fix — one write revokes every session
 * the account holds — but a cutoff is only half of a comparison. The other half
 * is a trustworthy "when was this session issued", which is what this module
 * defines and `config.ts` puts into the token.
 *
 * NOT `iat`. NextAuth re-encodes the session JWT as it is read, so its own
 * `iat` slides forward with use and a stolen cookie would simply carry a fresh
 * one. `authAt` is stamped ONCE, at the moment a credential was actually
 * presented, and copied forward untouched by every later re-encode. It is the
 * only claim in the token that a cutoff can be compared against honestly.
 *
 * Deliberately free of Prisma, next-auth and node:crypto: it is imported by the
 * shared API guard, by the /api/v1 principal resolver and by the bearer path,
 * and none of them should inherit a dependency for a two-line comparison.
 */

/**
 * The claim name, used by the JWT callback that writes it, the session callback
 * that surfaces it, and the access-token minter that copies it.
 */
export const SESSION_ISSUED_AT_CLAIM = "authAt";

/**
 * Unix SECONDS at which the credential behind this session was presented, or
 * null when the session predates the claim.
 *
 * Seconds rather than milliseconds because this value is carried inside a JWT
 * alongside `exp` and `iat`, and a mixed-unit token is how an expiry ends up
 * compared against the wrong magnitude.
 */
export function sessionIssuedAtSeconds(carrier: unknown): number | null {
  if (!carrier || typeof carrier !== "object") return null;
  const value = (carrier as Record<string, unknown>)[SESSION_ISSUED_AT_CLAIM];
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return Math.floor(value);
}

/**
 * Whether a session must be refused because the account has been signed out
 * since it was issued.
 *
 * Three rules, and the second and third are the ones that are easy to get
 * backwards:
 *
 *  1. No cutoff (NULL) means ALLOW. The column exists to revoke on demand, not
 *     to sign the entire userbase out on the day it was added — the schema
 *     comment on `User.sessionsValidAfter` says exactly this.
 *
 *  2. A cutoff IS set but the session cannot say when it was issued: REFUSE.
 *     A cookie minted before this claim shipped is precisely the cookie a reset
 *     is trying to kill, and "I cannot date it" must not be read as "it is
 *     fine". Sessions issued from now on always carry the claim, so this only
 *     ever costs a re-login to someone whose account was deliberately revoked.
 *
 *  3. Otherwise compare. `issuedAt` is whole seconds and the cutoff has
 *     millisecond precision, so a session issued in the same second as the
 *     cutoff is treated as older than it. That errs toward signing someone out
 *     a fraction of a second early, which is the harmless direction; rounding
 *     the other way would let the very session being revoked survive.
 */
export function isSessionRevoked(
  issuedAtSeconds: number | null,
  sessionsValidAfter: Date | string | null | undefined,
): boolean {
  if (sessionsValidAfter === null || sessionsValidAfter === undefined) return false;
  const cutoffMs =
    sessionsValidAfter instanceof Date ? sessionsValidAfter.getTime() : new Date(sessionsValidAfter).getTime();
  // An unparseable cutoff is a bug, not a revocation: refusing every request on
  // the account would be a self-inflicted outage. Log-free by design — this
  // module has no logger — the callers' live user read is the place that would
  // notice a corrupt row.
  if (!Number.isFinite(cutoffMs)) return false;
  if (issuedAtSeconds === null) return true;
  return issuedAtSeconds * 1000 < cutoffMs;
}
