/**
 * Email-confirmation tokens — the link an applicant follows to prove they read
 * mail at the address they typed when applying to join a company.
 *
 * This is the step that makes the company-domain check mean anything. Matching
 * "@aramco.com" proves only that somebody TYPED an Aramco address; following a
 * link sent to it proves they RECEIVE at one. Without the second half, the
 * domain gate is a text field, and the approval queue a company administrator
 * is asked to read would be full of unverified claims.
 *
 * DELIBERATELY A SIBLING OF invite-token.ts, NOT A GENERALISATION OF IT.
 *
 * The two modules are the same shape and that is on purpose. Folding them into
 * one `mint(purpose, ...)` helper would put the domain string on the CALL side,
 * where a copy-pasted call site silently gets the wrong key and the tokens
 * become interchangeable again — the precise failure the derived key exists to
 * prevent. Keeping the domain constant next to the only functions that may use
 * it means a purpose cannot be passed in wrongly, because it cannot be passed
 * in at all. Two short files with one key each beats one file with a key
 * parameter.
 *
 * WHY A SEPARATE SIGNING KEY, and not just a `p` field: see the long note in
 * invite-token.ts. Short version — password-reset.ts's PayloadSchema is a
 * non-strict zod object and ignores unknown keys, so a claim only one side
 * reads is not a boundary. The key itself is domain-separated, and the `p`
 * claim is checked here anyway so the payload says out loud what the key
 * already enforces.
 *
 * NO FINGERPRINT, and this is where it genuinely differs from an invitation.
 * An invite binds to the account's password hash so that accepting kills the
 * link. An applicant here already HAS a password — they chose one when they
 * applied — so a hash fingerprint would never change and would buy nothing.
 * Single use comes from the request's own state machine instead: the verify
 * route acts only on PENDING_EMAIL_VERIFICATION and moves it out, so a replayed
 * link finds nothing left to do. That is the right guarantee anyway; confirming
 * an address twice is not a security event.
 *
 * node:crypto keeps this module Node-runtime only, exactly as invite-token.ts,
 * password-reset.ts and email.ts are.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { resolvePasswordResetSecret } from "./password-reset";

/**
 * Twenty-four hours. The applicant asked for this link and is waiting on it, so
 * it can be short — but it is the step before a human review that may take a
 * working day, and a link that dies over lunch sends them back to the start of
 * a form they have already filled in once.
 */
export const EMAIL_VERIFICATION_TTL_SECONDS = 24 * 60 * 60;

/** Where the confirmation lands, so the mail and the page cannot disagree. */
export const EMAIL_VERIFICATION_PAGE_PATH = "/auth/confirm-email";

/**
 * The TTL as a person reads it, derived from the constant the verifier actually
 * enforces so the promise printed in the mail can never drift from the expiry.
 */
export function emailVerificationTtlLabel(ttlSeconds: number = EMAIL_VERIFICATION_TTL_SECONDS): string {
  const unit = (count: number, name: string) => `${count} ${name}${count === 1 ? "" : "s"}`;
  if (ttlSeconds % 86400 === 0) return unit(ttlSeconds / 86400, "day");
  if (ttlSeconds % 3600 === 0) return unit(ttlSeconds / 3600, "hour");
  if (ttlSeconds % 60 === 0) return unit(ttlSeconds / 60, "minute");
  return unit(ttlSeconds, "second");
}

const KEY_DOMAIN = "avenick:email-verification:v1";

const PayloadSchema = z.object({
  v: z.literal(1),
  p: z.literal("email-verification"),
  uid: z.string().min(1).max(64),
  exp: z.number().int().positive(),
});

export type EmailVerificationPayload = z.infer<typeof PayloadSchema>;

export type EmailVerificationRejection = "no-secret" | "malformed" | "signature" | "expired";

export type EmailVerificationVerification =
  | { ok: true; payload: EmailVerificationPayload }
  | { ok: false; reason: EmailVerificationRejection };

/**
 * Thrown by `mintEmailVerificationToken` when there is no signing key.
 *
 * An HMAC over an empty key is a hash anyone can compute. The join route turns
 * this into a refusal BEFORE it writes anything, because an application whose
 * confirmation link can never be signed is an account stuck at
 * PENDING_EMAIL_VERIFICATION forever behind a cheerful "check your email".
 */
export class EmailVerificationSecretMissingError extends Error {
  constructor() {
    super("Email-verification signing secret is not configured (AUTH_SECRET or NEXTAUTH_SECRET)");
    this.name = "EmailVerificationSecretMissingError";
  }
}

/** The app secret run once through HMAC with this purpose's domain string. */
function verificationSigningKey(secret: string): Buffer {
  return createHmac("sha256", secret).update(KEY_DOMAIN, "utf8").digest();
}

function sign(secret: string, payload: Buffer): Buffer {
  return createHmac("sha256", verificationSigningKey(secret)).update(payload).digest();
}

/** Issue a confirmation token for `uid`. `nowMs` is injectable for tests. */
export function mintEmailVerificationToken(uid: string, nowMs: number = Date.now()): string {
  const secret = resolvePasswordResetSecret();
  if (!secret) throw new EmailVerificationSecretMissingError();

  const payload: EmailVerificationPayload = {
    v: 1,
    p: "email-verification",
    uid,
    exp: Math.floor(nowMs / 1000) + EMAIL_VERIFICATION_TTL_SECONDS,
  };
  const payloadBytes = Buffer.from(JSON.stringify(payload), "utf8");
  return `${payloadBytes.toString("base64url")}.${sign(secret, payloadBytes).toString("base64url")}`;
}

/**
 * Check signature, purpose and expiry, and return what the token claims.
 *
 * The signature is verified over the exact bytes that were signed, BEFORE the
 * payload is parsed: nothing inside an unauthenticated token is trusted, not
 * even its JSON shape. Whether a join request still exists for this user and is
 * still awaiting confirmation needs the database, and belongs to the caller.
 */
export function verifyEmailVerificationToken(
  token: string,
  nowMs: number = Date.now(),
): EmailVerificationVerification {
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
