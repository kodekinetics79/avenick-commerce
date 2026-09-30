import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

import { KEY_PURPOSE, requireKey } from "@avenick/auth/app-secret";
import type { OtpPurpose } from "@avenick/database";

/**
 * ONE-TIME CODES: generation, storage form, and comparison.
 *
 * THE HASHING RULE, WHICH IS THE WHOLE POINT OF THIS FILE. `schema.prisma` says
 * it on `OtpChallenge.codeHash` and it bears repeating: a six-digit code has a
 * search space of one million. Under SHA-256 that space is exhausted in
 * milliseconds by anyone who can read the table — a read replica, a backup, a
 * support engineer, an SQL injection elsewhere in the app — so a bare digest
 * stores the code in all but name. The code is therefore kept under an HMAC
 * with a server-side key, which an attacker with table access does not have.
 *
 * The key is derived per purpose from `AUTH_SECRET` (see
 * `@avenick/auth/app-secret`), so a leak of the OTP key is not a leak of the
 * session-cookie key.
 *
 * The HMAC input is bound to the PHONE and the PURPOSE as well as the code, so
 * a `codeHash` copied from one row to another verifies for neither. That costs
 * nothing and removes a class of bug where a challenge row is cloned or a
 * VERIFY_PHONE challenge is answered as a SIGN_IN.
 */

/** Six digits: the length every GCC bank app has trained users to expect. */
export const OTP_CODE_LENGTH = 6;

/** Five minutes. A code is a credential; proof of a number goes stale fast. */
export const OTP_TTL_SECONDS = 5 * 60;

/**
 * The countdown the contract's `resendAfter` drives. Long enough that a user
 * waits for the SMS instead of tapping resend, short enough that a genuinely
 * lost message is not a minute-long dead end.
 */
export const OTP_RESEND_INTERVAL_SECONDS = 60;

/**
 * Guesses allowed against ONE challenge before it is spent.
 *
 * This is the cap that stops a million-guess walk of a six-digit code. It is
 * not sufficient on its own — an attacker would simply request a fresh
 * challenge per guess — which is why the per-phone and per-IP request limits in
 * `V1_RATE_LIMITS` exist alongside it. Both, or neither works.
 */
export const OTP_MAX_ATTEMPTS = 5;

/**
 * A uniformly random code.
 *
 * `randomInt` is the CSPRNG with rejection sampling, not `Math.random()` scaled
 * — a modulo of a weak generator is how a code space collapses to a few
 * thousand values. Leading zeros are preserved by padding, so "000123" is a
 * code and the space really is 10^6.
 */
export function generateOtpCode(length: number = OTP_CODE_LENGTH): string {
  const max = 10 ** length;
  return String(randomInt(0, max)).padStart(length, "0");
}

function hmacInput(phone: string, purpose: OtpPurpose, code: string): string {
  return `${phone} ${purpose} ${code}`;
}

/** The stored form: 64 hex characters of keyed digest, never the code itself. */
export function hashOtpCode(phone: string, purpose: OtpPurpose, code: string): string {
  const key = requireKey(KEY_PURPOSE.otpCode, "Storing a one-time code");
  return createHmac("sha256", key).update(hmacInput(phone, purpose, code), "utf8").digest("hex");
}

/**
 * Constant-time comparison.
 *
 * A byte-by-byte comparison of a hex digest leaks, through timing, how many
 * leading characters were right — which for an attacker who can make thousands
 * of attempts is a way to recover the digest one nibble at a time. The attempt
 * cap makes that impractical here; comparing safely anyway costs nothing and
 * removes the need to reason about it.
 */
export function otpCodeMatches(
  phone: string,
  purpose: OtpPurpose,
  code: string,
  storedHash: string,
): boolean {
  const expected = Buffer.from(hashOtpCode(phone, purpose, code), "utf8");
  const stored = Buffer.from(storedHash, "utf8");
  if (expected.length !== stored.length) return false;
  return timingSafeEqual(expected, stored);
}

/**
 * The message body. English only, deliberately: this repository is English-only
 * until the localisation system is built, and a half-translated security
 * message is worse than an untranslated one. `OtpRequestSchema.language` is
 * accepted and recorded in the log rather than silently ignored.
 */
export function otpMessageBody(code: string, platformName = "Avenick"): string {
  return `${code} is your ${platformName} verification code. It expires in ${Math.round(
    OTP_TTL_SECONDS / 60,
  )} minutes. Never share it with anyone.`;
}
