/**
 * Email-confirmation tokens — the link an applicant follows to prove they read
 * mail at the address they typed.
 *
 * This is the step that makes a company-domain check mean anything. Matching
 * "@aramco.com" proves only that somebody TYPED an Aramco address; following a
 * link sent to it proves they RECEIVE at it. Without the second half, the
 * domain gate is a text field, and the approval queue a company admin is asked
 * to read would be full of unverified claims.
 *
 * NO FINGERPRINT, deliberately. The other purposes bind a token to the account's
 * password hash so that using it kills it. An applicant here already has a
 * password (they chose one when they applied), so a hash fingerprint would never
 * change and would buy nothing. Single use comes from the state machine
 * instead: the route only acts on a request in PENDING_EMAIL_VERIFICATION and
 * moves it out, so a replayed link finds nothing left to do. That is the correct
 * guarantee anyway — confirming an address twice is not a security event.
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

export { SignedTokenSecretMissingError as EmailVerificationSecretMissingError };

export const EMAIL_VERIFICATION_TTL_SECONDS = TOKEN_TTL_SECONDS["email-verification"];

/** The TTL as the confirmation email and the landing page both state it. */
export function emailVerificationTtlLabel(ttlSeconds: number = EMAIL_VERIFICATION_TTL_SECONDS): string {
  return ttlLabel(ttlSeconds);
}

/**
 * Issue a confirmation link for `uid`.
 *
 * Throws {@link EmailVerificationSecretMissingError} when the deployment has no
 * signing key — which the join route turns into a refusal, because an
 * application nobody can confirm is an application that dies silently.
 */
export function mintEmailVerificationToken(uid: string, nowMs: number = Date.now()): string {
  return mintSignedToken(
    { purpose: "email-verification", uid, ttlSeconds: EMAIL_VERIFICATION_TTL_SECONDS },
    nowMs,
  );
}

/**
 * Check signature and expiry. Whether a join request still exists for this user
 * and is still awaiting confirmation needs the database, and belongs to the
 * verify route.
 */
export function verifyEmailVerificationToken(token: string, nowMs: number = Date.now()): SignedTokenVerification {
  return verifySignedToken("email-verification", token, nowMs);
}
