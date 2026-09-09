import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { Session } from "next-auth";
import type { UserRole } from "@avenick/database";
import { z } from "zod";

import { KEY_PURPOSE, deriveKey, requireKey } from "./app-secret";
import { isUserRole } from "./remote-session";
import { SESSION_ISSUED_AT_CLAIM } from "./session-revocation";

/**
 * The bearer access token for /api/v1 — the credential a Flutter client can
 * actually hold.
 *
 * WHY A SECOND TOKEN FORMAT EXISTS AT ALL. The web portals authenticate with a
 * NextAuth session cookie, and a phone cannot participate in that: it has no
 * cookie jar shared with a browser, it backgrounds for days, and it must be
 * able to sign one device out without ending every session on the account.
 * `packages/contracts/src/auth.ts` therefore specifies a short-lived access
 * token plus a rotating refresh token, and this module is the access half.
 *
 * WHY NOT REUSE THE NEXTAUTH JWT. Its lifetime is thirty days, it is minted by
 * the cookie machinery, and next-auth re-encodes it as it is read. A credential
 * a phone stores on disk needs the opposite properties: a fifteen-minute life
 * so a leaked copy dies on its own, and an immutable body so it can be checked
 * without a round trip.
 *
 * WHAT THIS TOKEN IS NOT. It is not an authorisation decision. `role` travels
 * in it only so a client can draw the right screen before /v1/me returns; every
 * guarded request still re-reads `role`, `status` and `deletedAt` from Postgres,
 * because a fifteen-minute cached claim is fifteen minutes of a demoted admin
 * still being an admin. The one thing the token is authoritative about is
 * `authAt` — when the credential behind it was presented — which is the value
 * `User.sessionsValidAfter` is compared against.
 *
 * node:crypto makes this module Node-runtime only.
 */

/**
 * Fifteen minutes: long enough that a phone on a bad connection is not
 * re-authenticating mid-scroll, short enough that a token lifted off a device
 * is useless before anyone reads the alert. The rotating refresh token is what
 * keeps a session alive beyond it, and that one CAN be revoked.
 */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

/** Tolerance for a client or server clock that is a little ahead. */
const CLOCK_SKEW_SECONDS = 60;

/**
 * Marks the token as an access token and nothing else.
 *
 * The key is already derived per purpose (`KEY_PURPOSE.accessToken`), so a
 * password-reset token can never verify here. This claim guards the remaining
 * case: a future token minted under the SAME key for a different job — a
 * one-time upload grant, say — being replayed as a session.
 */
const TOKEN_TYPE = "avenick.access";

const HEADER = { alg: "HS256", typ: "JWT" } as const;

const ClaimsSchema = z
  .object({
    typ: z.literal(TOKEN_TYPE),
    /** The user id. Named `sub` because this is a JWT and that is its name. */
    sub: z.string().min(1).max(128),
    role: z.string().refine(isUserRole, "unknown role"),
    lang: z.string().min(2).max(8),
    /** The installation the token was issued to; echoed for device-scoped logs. */
    did: z.string().min(1).max(128),
    /**
     * When the credential behind this token was presented, in unix seconds.
     * For a password grant that is the sign-in; for a refreshed token it is the
     * creation of the refresh token that minted it — which cannot predate a
     * password reset, because a reset revokes every refresh token the account
     * holds. See `isSessionRevoked`.
     */
    authAt: z.number().int().positive(),
    iat: z.number().int().positive(),
    exp: z.number().int().positive(),
    /** Unique per token, so a log can name one without printing it. */
    jti: z.string().min(1).max(128),
  })
  .strict();

export type AccessTokenClaims = z.infer<typeof ClaimsSchema> & { role: UserRole };

export type AccessTokenRejection =
  | "no-secret"
  | "malformed"
  | "signature"
  | "expired"
  | "not-yet-valid";

export type AccessTokenVerification =
  | { ok: true; claims: AccessTokenClaims }
  | { ok: false; reason: AccessTokenRejection };

function b64url(value: Buffer | string): string {
  return (typeof value === "string" ? Buffer.from(value, "utf8") : value).toString("base64url");
}

function sign(key: Buffer, signingInput: string): Buffer {
  return createHmac("sha256", key).update(signingInput, "utf8").digest();
}

export interface MintAccessTokenInput {
  userId: string;
  role: UserRole;
  language: string;
  deviceId: string;
  /** Unix seconds. Never "now" by default — the caller owns this fact. */
  authAtSeconds: number;
}

/**
 * Issue an access token. Throws `AppSecretMissingError` when unconfigured,
 * rather than signing with an empty key that anyone could forge against.
 */
export function mintAccessToken(
  input: MintAccessTokenInput,
  nowMs: number = Date.now(),
): { token: string; expiresIn: number; jti: string; expiresAt: Date } {
  const key = requireKey(KEY_PURPOSE.accessToken, "Issuing a v1 access token");
  const iat = Math.floor(nowMs / 1000);
  const exp = iat + ACCESS_TOKEN_TTL_SECONDS;
  const jti = randomUUID();
  const claims = {
    typ: TOKEN_TYPE,
    sub: input.userId,
    role: input.role,
    lang: input.language,
    did: input.deviceId,
    authAt: Math.floor(input.authAtSeconds),
    iat,
    exp,
    jti,
  };
  const signingInput = `${b64url(JSON.stringify(HEADER))}.${b64url(JSON.stringify(claims))}`;
  return {
    token: `${signingInput}.${b64url(sign(key, signingInput))}`,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    jti,
    expiresAt: new Date(exp * 1000),
  };
}

/**
 * Check the signature, the type and the window — and nothing else.
 *
 * Deliberately no database access: this runs on every bearer request and the
 * live account read that follows it is the guard's job, not this function's.
 */
export function verifyAccessToken(token: string, nowMs: number = Date.now()): AccessTokenVerification {
  const key = deriveKey(KEY_PURPOSE.accessToken);
  if (!key) return { ok: false, reason: "no-secret" };

  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed" };
  const [headerPart, payloadPart, signaturePart] = parts as [string, string, string];

  let header: unknown;
  try {
    header = JSON.parse(Buffer.from(headerPart, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }
  // `alg` is read from the token, so it is attacker-controlled: accepting
  // whatever it names is the "alg: none" family of forgeries. Only the one
  // algorithm this module signs with is allowed, and it is checked BEFORE the
  // signature so nothing else can dispatch on it.
  if (
    !header ||
    typeof header !== "object" ||
    (header as Record<string, unknown>)["alg"] !== HEADER.alg
  ) {
    return { ok: false, reason: "malformed" };
  }

  const expected = sign(key, `${headerPart}.${payloadPart}`);
  const presented = Buffer.from(signaturePart, "base64url");
  // timingSafeEqual throws on a length mismatch, which a forged token can
  // trivially cause; treat it as a failed signature rather than a 500.
  if (presented.length !== expected.length || !timingSafeEqual(presented, expected)) {
    return { ok: false, reason: "signature" };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }
  const parsed = ClaimsSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, reason: "malformed" };

  const nowSeconds = Math.floor(nowMs / 1000);
  if (parsed.data.exp <= nowSeconds) return { ok: false, reason: "expired" };
  if (parsed.data.iat > nowSeconds + CLOCK_SKEW_SECONDS) return { ok: false, reason: "not-yet-valid" };

  return { ok: true, claims: parsed.data as AccessTokenClaims };
}

/**
 * The bearer token from an Authorization header, or null.
 *
 * The scheme is matched case-insensitively (RFC 6750 says it is a token, and
 * Dart's http client has shipped "bearer" before) but a second credential in
 * the same header, or anything with whitespace inside it, is refused rather
 * than guessed at.
 */
export function bearerTokenFrom(headers: Headers): string | null {
  const header = headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer[ \t]+([A-Za-z0-9._~+/-]+=*)$/i.exec(header.trim());
  return match ? match[1]! : null;
}

/**
 * A `Session` shaped exactly like the cookie path's, so everything downstream
 * of the auth seam — the live user re-read, the role check, the revocation
 * comparison — runs one code path for both credentials rather than two.
 *
 * `expires` is the ACCESS token's expiry, not the refresh token's: it is what
 * this credential is good for, and inflating it would tell a caller the
 * session outlives the token in its hand.
 */
export function sessionFromAccessToken(claims: AccessTokenClaims): Session {
  return {
    user: {
      id: claims.sub,
      // Null, not the account's address: an email in the token would be a
      // fifteen-minute-stale copy of a mutable column, and the device already
      // knows it from the sign-in response. A handler that needs the address
      // reads it from the database, the same as /v1/me does.
      email: null,
      name: null,
      image: null,
      role: claims.role,
      language: claims.lang,
    } as Session["user"],
    expires: new Date(claims.exp * 1000).toISOString(),
    [SESSION_ISSUED_AT_CLAIM]: claims.authAt,
  } as Session;
}
