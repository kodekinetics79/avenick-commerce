/**
 * Stateless invitation-acceptance tokens.
 *
 * An invited colleague used to be unreachable: `inviteMember` wrote a User with
 * `status: PENDING` and NO passwordHash, then mailed a link to
 * `/register?email=…` — an address in a query string, not a credential. Every
 * door was then correctly locked against them: /register refuses a taken email,
 * NextAuth refuses a null hash AND a non-ACTIVE status, and password-reset
 * refuses anything that is not already ACTIVE ("a mailbox proves ownership, not
 * standing"). None of those guards was wrong. What was missing was a door.
 *
 * This module is that door's key, and it is deliberately the SAME shape as
 * lib/password-reset.ts rather than a second scheme:
 *
 *   base64url(payload) "." base64url(HMAC-SHA256(inviteKey, payload))
 *   payload = { v: 1, p: "invite", uid, exp (unix seconds), hf }
 *
 * What each of the four properties an invite token needs actually rests on:
 *
 * - ENTROPY. The unguessable part is the MAC, not a random string in a column:
 *   forging one means forging HMAC-SHA256 under AUTH_SECRET, which deployments
 *   generate from a CSPRNG (`openssl rand`, see DEPLOYMENT.md). A stored random
 *   token would be *weaker* here, because it would also have to survive being
 *   at rest.
 * - AT REST. Nothing is stored, so a database read cannot mint a session — the
 *   strongest form of "hashed at rest" is "not there at all". There is no
 *   Invite table, no VerificationToken table, and this module must not need one.
 * - SINGLE USE. `hf` fingerprints the password hash the token was issued
 *   against — for an invitee that is the literal "none", the case
 *   `passwordHashFingerprint` was already written for. Accepting writes a real
 *   bcrypt hash, the fingerprint stops matching, and the link is dead. No
 *   "redeemed" column; the redeem transaction's CAS settles the race.
 * - EXPIRY. The signed `exp` claim, checked here.
 *
 * WHY A SEPARATE SIGNING KEY, and not just a `p: "invite"` field.
 *
 * password-reset.ts's PayloadSchema is a plain (non-strict) zod object, so it
 * IGNORES unknown keys: a token carrying `p: "invite"` would verify perfectly
 * well as a reset token, and vice versa. A claim only one side reads is not a
 * boundary. So the key itself is domain-separated — the invite key is
 * HMAC(appSecret, "avenick:invite-token:v1"), never the app secret directly —
 * and a token minted for one purpose fails the other's SIGNATURE check, before
 * anything inside it is parsed. The `p` claim is kept anyway, checked here, so
 * the payload says out loud what the key already enforces.
 *
 * Because of that key derivation, an invitation link CANNOT be verified by
 * `verifyPasswordResetToken`. Anything that preflights an invitation — the
 * acceptance page's server-side preview included — must call
 * `verifyInviteToken` here. The signature and the result shape are deliberately
 * identical to the reset verifier's, so that is a one-word change and never a
 * rewrite.
 *
 * node:crypto keeps this module Node-runtime only, exactly as password-reset.ts
 * and email.ts are: reaching it from middleware, an edge route or a client
 * component breaks the bundle. The API route pins `runtime = "nodejs"`.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { passwordHashFingerprint, resolvePasswordResetSecret } from "./password-reset";

/**
 * An invitation is not a reset. A reset link answers a request the person made
 * seconds ago, so 30 minutes is right; an invitation arrives unannounced in a
 * colleague's mailbox and may sit there over a weekend. Seven days is long
 * enough that "I opened it on Monday" works, short enough that a forwarded or
 * archived mail stops being a credential.
 */
export const INVITE_TTL_SECONDS = 7 * 24 * 60 * 60;

/** Where the acceptance form lives, so the mail and the page cannot disagree. */
export const INVITE_ACCEPT_PAGE_PATH = "/auth/accept-invite";

/**
 * The TTL as a person reads it ("7 days"), derived from the constant above for
 * the same reason `passwordResetTtlLabel` derives its sentence: the promise
 * printed in the mail can then never drift from the expiry actually enforced.
 * Whole units are named as such; anything else falls back rather than rounding,
 * because a rounded promise is a wrong one.
 */
export function inviteTtlLabel(ttlSeconds: number = INVITE_TTL_SECONDS): string {
  const unit = (count: number, name: string) => `${count} ${name}${count === 1 ? "" : "s"}`;
  if (ttlSeconds % 86_400 === 0) return unit(ttlSeconds / 86_400, "day");
  if (ttlSeconds % 3600 === 0) return unit(ttlSeconds / 3600, "hour");
  if (ttlSeconds % 60 === 0) return unit(ttlSeconds / 60, "minute");
  return unit(ttlSeconds, "second");
}

/** Same width as the reset fingerprint: 64 bits is ample for "has it changed?". */
const FINGERPRINT_HEX_CHARS = 16;

/** Domain separation for the derived key, so this use can never collide with another. */
const KEY_DOMAIN = "avenick:invite-token:v1";

const PayloadSchema = z.object({
  v: z.literal(1),
  p: z.literal("invite"),
  uid: z.string().min(1).max(64),
  exp: z.number().int().positive(),
  hf: z.string().regex(new RegExp(`^[0-9a-f]{${FINGERPRINT_HEX_CHARS}}$`)),
});

export type InvitePayload = z.infer<typeof PayloadSchema>;

export type InviteTokenRejection = "no-secret" | "malformed" | "signature" | "expired";

export type InviteTokenVerification =
  | { ok: true; payload: InvitePayload }
  | { ok: false; reason: InviteTokenRejection };

/**
 * Thrown by `mintInviteToken` when there is no signing key.
 *
 * An HMAC over an empty key is a hash anyone can compute, so minting without a
 * secret would hand out invitations anyone could forge into an active account.
 * Refusing is the only safe answer; the mail layer turns this into a logged
 * skip and the invite simply is not sent.
 */
export class InviteTokenSecretMissingError extends Error {
  constructor() {
    super("Invite signing secret is not configured (AUTH_SECRET or NEXTAUTH_SECRET)");
    this.name = "InviteTokenSecretMissingError";
  }
}

/**
 * The invite signing key: the app secret run once through HMAC with a fixed
 * domain string. Deriving rather than reusing is what makes an invite token and
 * a password-reset token non-interchangeable even though both are minted from
 * the same deployment secret — see the header.
 */
function inviteSigningKey(secret: string): Buffer {
  return createHmac("sha256", secret).update(KEY_DOMAIN, "utf8").digest();
}

function sign(secret: string, payload: Buffer): Buffer {
  return createHmac("sha256", inviteSigningKey(secret)).update(payload).digest();
}

/**
 * Issue an acceptance token for `uid`, bound to the hash the account has right
 * now — which for a genuine invitee is null, so `hf` fingerprints "none" and
 * the first password written kills the link. `nowMs` is injectable for tests.
 */
export function mintInviteToken(
  input: { uid: string; passwordHash: string | null | undefined },
  nowMs: number = Date.now(),
): string {
  const secret = resolvePasswordResetSecret();
  if (!secret) throw new InviteTokenSecretMissingError();

  const payload: InvitePayload = {
    v: 1,
    p: "invite",
    uid: input.uid,
    exp: Math.floor(nowMs / 1000) + INVITE_TTL_SECONDS,
    hf: passwordHashFingerprint(input.passwordHash),
  };
  const payloadBytes = Buffer.from(JSON.stringify(payload), "utf8");
  return `${payloadBytes.toString("base64url")}.${sign(secret, payloadBytes).toString("base64url")}`;
}

/**
 * Check signature, purpose and expiry, and return the statement the token makes.
 *
 * The signature is verified over the exact bytes that were signed, BEFORE the
 * payload is parsed: nothing inside an unauthenticated token is trusted, not
 * even its JSON shape. Whether the account still exists, is still PENDING,
 * still has no password, and still has a live membership is the caller's job,
 * because only the caller can load it — that re-read at redemption is what
 * makes a stateless token revocable.
 */
export function verifyInviteToken(token: string, nowMs: number = Date.now()): InviteTokenVerification {
  const secret = resolvePasswordResetSecret();
  if (!secret) return { ok: false, reason: "no-secret" };

  if (typeof token !== "string" || token.length > 4096) return { ok: false, reason: "malformed" };
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, reason: "malformed" };
  if (!/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[A-Za-z0-9_-]+$/.test(parts[1])) {
    return { ok: false, reason: "malformed" };
  }

  const payloadBytes = Buffer.from(parts[0], "base64url");
  const presented = Buffer.from(parts[1], "base64url");
  const expected = sign(secret, payloadBytes);
  // timingSafeEqual throws on unequal lengths, and a length mismatch is itself
  // a forged or truncated signature, so answer "signature" rather than throw.
  if (presented.length !== expected.length || !timingSafeEqual(presented, expected)) {
    return { ok: false, reason: "signature" };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(payloadBytes.toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }
  const parsed = PayloadSchema.safeParse(parsedJson);
  if (!parsed.success) return { ok: false, reason: "malformed" };

  if (parsed.data.exp <= Math.floor(nowMs / 1000)) return { ok: false, reason: "expired" };

  return { ok: true, payload: parsed.data };
}
