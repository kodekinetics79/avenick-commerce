import { createHmac } from "node:crypto";

/**
 * The application signing secret, and per-purpose keys derived from it.
 *
 * WHY DERIVE RATHER THAN USE IT DIRECTLY. `AUTH_SECRET` already signs the
 * NextAuth session cookie, the password-reset token (`lib/password-reset.ts`)
 * and the invitation token. Adding two more consumers — the mobile access token
 * and the OTP code hash — to the same raw key means a flaw or a confusion in
 * any one of them is a flaw in all five: a value minted for one purpose that
 * happens to parse as another is accepted, because the signature genuinely
 * verifies. One HMAC over a fixed label gives each purpose its own
 * independent key at the cost of a few microseconds and no new environment
 * variable to lose in a deploy.
 *
 * node:crypto keeps this module Node-runtime only. Nothing on the edge path
 * (middleware, remote-session) may import it.
 */

/**
 * Resolved exactly the way `resolvePasswordResetSecret()` and
 * `remote-session.ts` resolve it, so one deployment has one answer to "what is
 * the secret". Whitespace-only counts as unset: a blank value is a
 * misconfiguration, not a key.
 */
export function resolveAppSecret(): string | undefined {
  return process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim() || undefined;
}

/**
 * Thrown rather than falling back to an empty key.
 *
 * An HMAC keyed on "" is a hash anyone can compute: access tokens would be
 * forgeable and OTP hashes would be a plain digest of a six-digit code, which
 * is the precise failure `OtpChallenge.codeHash`'s schema comment forbids.
 * Refusing loudly is the only safe answer, and the callers turn it into a
 * logged 500 or 503.
 */
export class AppSecretMissingError extends Error {
  constructor(purpose: string) {
    super(`${purpose} requires a signing secret (AUTH_SECRET or NEXTAUTH_SECRET) and none is set`);
    this.name = "AppSecretMissingError";
  }
}

/** Labels, in one place, so two purposes cannot accidentally share a key. */
export const KEY_PURPOSE = {
  /** HS256 key for the /api/v1 bearer access token. */
  accessToken: "avenick.v1.access-token",
  /** HMAC key under which a one-time code is stored. */
  otpCode: "avenick.v1.otp-code",
} as const;

export type KeyPurpose = (typeof KEY_PURPOSE)[keyof typeof KEY_PURPOSE];

/** A 256-bit key for one purpose, or `undefined` when nothing is configured. */
export function deriveKey(purpose: KeyPurpose): Buffer | undefined {
  const secret = resolveAppSecret();
  if (!secret) return undefined;
  return createHmac("sha256", secret).update(purpose, "utf8").digest();
}

/** `deriveKey`, refusing instead of returning undefined. */
export function requireKey(purpose: KeyPurpose, describedAs: string): Buffer {
  const key = deriveKey(purpose);
  if (!key) throw new AppSecretMissingError(describedAs);
  return key;
}
