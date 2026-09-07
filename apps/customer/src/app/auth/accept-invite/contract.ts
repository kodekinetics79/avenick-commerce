/**
 * The two facts the invitation-acceptance PAGE and the invitation-acceptance
 * ENDPOINT must agree on, in one place that neither of them owns.
 *
 * The page is a Server Component that reads the database directly; the form is a
 * browser island that POSTs. They cannot share a module that imports Prisma —
 * dragging @avenick/database into the client bundle is the barrel trap this
 * repo already has two written warnings about — so the path and the response
 * shape live here, in a module with NO imports at all, and both sides import it.
 *
 * If the endpoint moves, exactly one line below changes and both sides follow.
 * That is the point: the previous invitation flow broke because the email, the
 * page and the credential each had their own idea of where an invitee should
 * end up, and nothing in the type system connected them.
 */

/** Where the acceptance form posts. Must match the redeem route's own path. */
export const INVITE_REDEEM_ENDPOINT = "/api/auth/invite/redeem";

/** The query parameter the invitation email puts the token in. */
export const INVITE_TOKEN_PARAM = "token";

/**
 * What the redeem route answers.
 *
 * `code: "invalid-token"` is the ONE code for every dead end — expired, already
 * redeemed, membership withdrawn, account no longer pending — mirroring
 * `invalidToken()` in the password-reset redeem route. Distinguishing them would
 * let whoever holds a token probe the state of an account they may not own.
 */
export interface InviteRedeemResponse {
  success?: boolean;
  code?: string;
  error?: string;
}
