/**
 * One signed statement, several purposes.
 *
 * A link mailed to somebody is a credential: "whoever holds this may do X to
 * account Y until Z". The platform now sends three of them — reset your
 * password, accept an invitation, confirm this is your address — and they must
 * never be interchangeable. A token that lets a stranger confirm an address
 * must not also let them claim the account.
 *
 * WHAT KEEPS THEM APART is the domain tag: the HMAC is taken over
 * `"avenick.<purpose>.v1:" || payload`, so a signature produced for one purpose
 * cannot verify under another even though every purpose signs with the same
 * deployment secret. Adding a purpose is adding a string; it is not adding a
 * key to rotate, and there is no configuration to get wrong.
 *
 *   base64url(payload) "." base64url(HMAC-SHA256(secret, tag || payload))
 *   payload = { v: 1, uid, exp (unix seconds), hf? }
 *
 * `hf` is optional and is what makes a token single-use WITHOUT a redeemed
 * column: a fingerprint of the password hash the token was issued against.
 * Redeeming writes a new hash, the fingerprint stops matching, and the token is
 * refused from then on. Purposes that do not change the password omit it and
 * rely on their own state machine instead — see the callers.
 *
 * lib/password-reset.ts predates this module and signs the BARE payload with no
 * tag. It is deliberately not folded in: its tokens are live in mailboxes right
 * now, and re-signing them would invalidate every reset link in flight for the
 * length of its TTL. Its absence of a tag is also harmless in exactly the way
 * that matters — an untagged signature can never collide with a tagged one.
 *
 * Nothing here touches the database, so it unit-tests without one. node:crypto
 * keeps it Node-runtime only: API routes and SERVER components, never
 * middleware, an edge route or a "use client" form.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { passwordHashFingerprint, resolvePasswordResetSecret } from "./password-reset";

export { passwordHashFingerprint };
export { fingerprintMatches } from "./password-reset";

/**
 * The deployment's app secret. Resolved by lib/password-reset because that is
 * where it was first spelled, and one deployment must have exactly one answer
 * to "what is the secret" — a second resolver is a second thing to misconfigure.
 */
export { resolvePasswordResetSecret as resolveTokenSecret };

/** Every kind of mailed credential this portal issues through this module. */
export type SignedTokenPurpose = "invitation" | "email-verification";

const PayloadSchema = z.object({
  v: z.literal(1),
  uid: z.string().min(1).max(64),
  exp: z.number().int().positive(),
  hf: z.string().regex(/^[0-9a-f]{16}$/).optional(),
});

export type SignedTokenPayload = z.infer<typeof PayloadSchema>;

export type SignedTokenRejection = "no-secret" | "malformed" | "signature" | "expired";

export type SignedTokenVerification =
  | { ok: true; payload: SignedTokenPayload }
  | { ok: false; reason: SignedTokenRejection };

/**
 * Thrown when there is no signing key.
 *
 * An HMAC under an empty key is a hash anyone can compute, so minting without a
 * secret hands out forgeable tokens. Refusing is the only safe answer; callers
 * turn this into a logged 500 or an honest "this could not be sent".
 */
export class SignedTokenSecretMissingError extends Error {
  constructor(purpose: SignedTokenPurpose) {
    super(`No signing secret for ${purpose} tokens (AUTH_SECRET or NEXTAUTH_SECRET)`);
    this.name = "SignedTokenSecretMissingError";
  }
}

function tagFor(purpose: SignedTokenPurpose): Buffer {
  return Buffer.from(`avenick.${purpose}.v1:`, "utf8");
}

function sign(secret: string, purpose: SignedTokenPurpose, payload: Buffer): Buffer {
  return createHmac("sha256", secret).update(tagFor(purpose)).update(payload).digest();
}

/**
 * Issue a token. `passwordHash` is only read when the purpose wants the
 * single-use fingerprint; pass it as `null` for an account that has never had a
 * password, which fingerprints as the literal "none".
 */
export function mintSignedToken(
  input: {
    purpose: SignedTokenPurpose;
    uid: string;
    ttlSeconds: number;
    passwordHash?: string | null;
  },
  nowMs: number = Date.now(),
): string {
  const secret = resolvePasswordResetSecret();
  if (!secret) throw new SignedTokenSecretMissingError(input.purpose);

  const payload: SignedTokenPayload = {
    v: 1,
    uid: input.uid,
    exp: Math.floor(nowMs / 1000) + input.ttlSeconds,
    ...(input.passwordHash === undefined ? {} : { hf: passwordHashFingerprint(input.passwordHash) }),
  };
  const payloadBytes = Buffer.from(JSON.stringify(payload), "utf8");
  return `${payloadBytes.toString("base64url")}.${sign(secret, input.purpose, payloadBytes).toString("base64url")}`;
}

/**
 * Check the signature (under this purpose's tag) and the expiry, and return
 * what the token claims.
 *
 * The signature is verified over the exact bytes that were signed BEFORE the
 * payload is parsed: nothing inside an unauthenticated token is trusted, not
 * even its JSON shape. Whether the account still exists and is still in a state
 * that can use the token needs the database, so it belongs to the caller.
 */
export function verifySignedToken(
  purpose: SignedTokenPurpose,
  token: string,
  nowMs: number = Date.now(),
): SignedTokenVerification {
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
  const expected = sign(secret, purpose, payloadBytes);
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

/** How long each kind of link is worth following, and why it is that long. */
export const TOKEN_TTL_SECONDS = {
  /**
   * Seven days. An invitation is read on somebody else's schedule: it lands in
   * an inbox the invitee did not ask for anything from, often on a Thursday
   * evening in a market whose weekend starts on Friday. Shorter, and the
   * ordinary case ("I opened it on Sunday") is a broken link and a support call.
   */
  invitation: 7 * 24 * 60 * 60,
  /**
   * Twenty-four hours. The applicant asked for this one and is waiting on it,
   * so it can be short — but it is the step before a human review that may take
   * a working day, and a link that dies over lunch sends them back to the start
   * of a form they have already filled in once.
   */
  "email-verification": 24 * 60 * 60,
} as const satisfies Record<SignedTokenPurpose, number>;

/** A TTL as a person reads it, so a promise in copy cannot drift from the code. */
export function ttlLabel(ttlSeconds: number): string {
  const unit = (count: number, name: string) => `${count} ${name}${count === 1 ? "" : "s"}`;
  if (ttlSeconds % 86400 === 0) return unit(ttlSeconds / 86400, "day");
  if (ttlSeconds % 3600 === 0) return unit(ttlSeconds / 3600, "hour");
  if (ttlSeconds % 60 === 0) return unit(ttlSeconds / 60, "minute");
  return unit(ttlSeconds, "second");
}
