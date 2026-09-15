/**
 * Invitation tokens — the credential a colleague follows to set a password and
 * become a real member of the company that invited them.
 *
 * The crypto lives in lib/signed-token; this file is the invitation's own
 * vocabulary over it, so a caller reads `mintInvitationToken` rather than a
 * generic mint with a purpose string and a TTL it has to know.
 *
 * WHY AN INVITATION IS NOT A PASSWORD RESET. The two look alike and are not the
 * same statement. A reset says "whoever owns this mailbox may replace the
 * password on an ACTIVE account". An invitation says "whoever owns this mailbox
 * may claim an account that has never been used, and in doing so ACTIVATE it".
 * The second grants standing the first never does, so it is signed under its
 * own domain tag and cannot be presented as the other in either direction.
 *
 * Single use comes from the fingerprint, not from a redeemed column: the token
 * is bound to the password hash the account had when it was issued — the
 * literal "none" for an invited member who has never had one — so setting a
 * password kills the link.
 *
 * node:crypto keeps this Node-runtime only.
 */
import {
  mintSignedToken,
  SignedTokenSecretMissingError,
  TOKEN_TTL_SECONDS,
  ttlLabel,
  verifySignedToken,
  type SignedTokenVerification,
} from "./signed-token";

export { fingerprintMatches } from "./signed-token";

/**
 * The error a caller catches to say "this member was created but can never be
 * activated". Aliased rather than re-thrown so `instanceof` keeps working
 * across both names.
 */
export { SignedTokenSecretMissingError as InvitationSecretMissingError };

export const INVITATION_TTL_SECONDS = TOKEN_TTL_SECONDS.invitation;

/** The TTL as the invitation email and the acceptance page both state it. */
export function invitationTtlLabel(ttlSeconds: number = INVITATION_TTL_SECONDS): string {
  return ttlLabel(ttlSeconds);
}

/**
 * Issue an invitation for `uid`, bound to the password hash the account has
 * right now — `null` for the freshly invited member this is normally called for.
 *
 * Throws {@link InvitationSecretMissingError} when the deployment has no
 * signing key. Callers must handle it: an unmintable invitation means a member
 * row that can never sign in, which is worse than a refused invite.
 */
export function mintInvitationToken(
  input: { uid: string; passwordHash: string | null },
  nowMs: number = Date.now(),
): string {
  return mintSignedToken(
    { purpose: "invitation", uid: input.uid, ttlSeconds: INVITATION_TTL_SECONDS, passwordHash: input.passwordHash },
    nowMs,
  );
}

/**
 * Check signature and expiry. Whether the account still exists, is still
 * PENDING and still has the fingerprinted hash needs the database and belongs
 * to the accept route.
 */
export function verifyInvitationToken(token: string, nowMs: number = Date.now()): SignedTokenVerification {
  return verifySignedToken("invitation", token, nowMs);
}
