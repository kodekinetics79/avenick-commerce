/**
 * Stateless password-reset tokens.
 *
 * There is no PasswordReset table and this module must not need one. A token
 * is a signed statement — "user `uid` may set a new password until `exp`" —
 * that the server can check without having stored anything when it was issued:
 *
 *   base64url(payload) "." base64url(HMAC-SHA256(secret, payload))
 *   payload = { v: 1, uid, exp (unix seconds), hf }
 *
 * `hf` is what makes the token single-use without a "redeemed" column: it is a
 * fingerprint of the password hash the token was issued against. Redeeming
 * writes a new hash, the fingerprint stops matching, and the same token is
 * refused from then on. A password changed by any other route has the same
 * effect, which is the behaviour a reset link should have anyway.
 *
 * Nothing here touches the database, so it unit-tests without one; the caller
 * loads the user and hands the current hash to `fingerprintMatches`.
 *
 * node:crypto keeps this module Node-runtime only. It is reached from the
 * password-reset API routes and from the two auth pages' SERVER components
 * (never their "use client" forms) — see the note in lib/email.ts: importing a
 * node:crypto module from middleware, an edge route or a client component
 * breaks the bundle. Keep this file off those paths.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

/** Reset links are short-lived: the mailbox is the proof, and proof goes stale. */
export const PASSWORD_RESET_TTL_SECONDS = 30 * 60;

/**
 * The TTL as a person reads it ("30 minutes"), derived from the constant above
 * so the promise printed in the form and the email can never drift from the
 * expiry `verifyPasswordResetToken` actually enforces. Whole hours and whole
 * minutes are named as such; anything else falls back to seconds rather than
 * rounding, because a rounded promise is a wrong one.
 */
export function passwordResetTtlLabel(ttlSeconds: number = PASSWORD_RESET_TTL_SECONDS): string {
  const unit = (count: number, name: string) => `${count} ${name}${count === 1 ? "" : "s"}`;
  if (ttlSeconds % 3600 === 0) return unit(ttlSeconds / 3600, "hour");
  if (ttlSeconds % 60 === 0) return unit(ttlSeconds / 60, "minute");
  return unit(ttlSeconds, "second");
}

/** Fingerprint length in hex characters: 64 bits is ample for "has it changed?". */
const FINGERPRINT_HEX_CHARS = 16;

const PayloadSchema = z.object({
  v: z.literal(1),
  uid: z.string().min(1).max(64),
  exp: z.number().int().positive(),
  hf: z.string().regex(new RegExp(`^[0-9a-f]{${FINGERPRINT_HEX_CHARS}}$`)),
});

export type PasswordResetPayload = z.infer<typeof PayloadSchema>;

export type PasswordResetRejection =
  | "no-secret"
  | "malformed"
  | "signature"
  | "expired";

export type PasswordResetVerification =
  | { ok: true; payload: PasswordResetPayload }
  | { ok: false; reason: PasswordResetRejection };

/**
 * Thrown by `mintPasswordResetToken` when there is no signing key.
 *
 * An HMAC over an empty key is a hash anyone can compute, so minting without
 * a secret would hand out tokens that anyone could forge. Refusing is the only
 * safe answer; the request route turns this into a logged 500.
 */
export class PasswordResetSecretMissingError extends Error {
  constructor() {
    super("Password reset signing secret is not configured (AUTH_SECRET or NEXTAUTH_SECRET)");
    this.name = "PasswordResetSecretMissingError";
  }
}

/**
 * The app secret, resolved the same way as `recipientRef` in lib/email.ts and
 * @avenick/auth `remote-session`, so one deployment has one answer to "what is
 * the secret". Whitespace-only counts as unset: a blank value is a
 * misconfiguration, not a key.
 */
export function resolvePasswordResetSecret(): string | undefined {
  return process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim() || undefined;
}

/**
 * A short fingerprint of a password hash — or of the literal "none" for an
 * account that has no password yet (an invited member who never set one).
 * The bcrypt hash itself is never placed in the token: the token travels by
 * email and through browser history, and a hash is a credential.
 */
export function passwordHashFingerprint(passwordHash: string | null | undefined): string {
  return createHash("sha256")
    .update(passwordHash ?? "none", "utf8")
    .digest("hex")
    .slice(0, FINGERPRINT_HEX_CHARS);
}

/**
 * Whether a token's fingerprint still describes the account's current hash.
 * Constant-time even though the fingerprint is not itself a secret — a cheap
 * habit that keeps this module free of any "was that compare safe?" question.
 */
export function fingerprintMatches(expected: string, passwordHash: string | null | undefined): boolean {
  const current = passwordHashFingerprint(passwordHash);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(current, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function sign(secret: string, payload: Buffer): Buffer {
  return createHmac("sha256", secret).update(payload).digest();
}

/**
 * Issue a token for `uid`, bound to the hash the account has right now.
 * `nowMs` is injectable for tests; production callers leave it at the clock.
 */
export function mintPasswordResetToken(
  input: { uid: string; passwordHash: string | null | undefined },
  nowMs: number = Date.now(),
): string {
  const secret = resolvePasswordResetSecret();
  if (!secret) throw new PasswordResetSecretMissingError();

  const payload: PasswordResetPayload = {
    v: 1,
    uid: input.uid,
    exp: Math.floor(nowMs / 1000) + PASSWORD_RESET_TTL_SECONDS,
    hf: passwordHashFingerprint(input.passwordHash),
  };
  const payloadBytes = Buffer.from(JSON.stringify(payload), "utf8");
  return `${payloadBytes.toString("base64url")}.${sign(secret, payloadBytes).toString("base64url")}`;
}

/**
 * Check signature and expiry, and return the statement the token makes.
 *
 * The signature is verified over the exact bytes that were signed, before the
 * payload is parsed: nothing inside an unauthenticated token is trusted, not
 * even its JSON shape. Expiry is checked here; whether the account still
 * exists, is active, and still has the fingerprinted hash is the caller's
 * job, because only the caller can load the account.
 */
export function verifyPasswordResetToken(token: string, nowMs: number = Date.now()): PasswordResetVerification {
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
