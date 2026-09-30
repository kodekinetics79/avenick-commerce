import { z } from "zod";

import { LanguageSchema, UserRoleSchema } from "./enums";
import { EmailSchema, IdSchema, PhoneSchema, TimestampSchema } from "./primitives";
import { successEnvelope } from "./envelope";

/**
 * Bearer tokens for the mobile surface.
 *
 * The web apps authenticate with a NextAuth cookie session. A Flutter client
 * cannot participate in that: it has no cookie jar shared with a browser, it
 * backgrounds for days, and it must be able to revoke one device without
 * signing the account out everywhere. So /v1 issues a short-lived access token
 * and a rotating refresh token.
 *
 * STORAGE, AS OF THE MOBILE IDENTITY MIGRATIONS. This note used to say that
 * nothing in `schema.prisma` stored a refresh token. It does now: `RefreshToken`
 * carries the hash, the `familyId` rotation lineage and a revocation reason, and
 * `OtpChallenge` holds the in-flight phone challenge. The old `Session` table is
 * unrelated to both and remains unused by the JWT web sessions.
 *
 * The endpoints below are implemented in
 * `apps/customer/src/app/api/v1/auth/`. Two things this contract does NOT
 * describe, and which therefore do not exist: phone-first REGISTRATION (a
 * verified number with no account behind it can only be refused, because
 * `OtpVerifyResponseSchema` returns a token pair and nothing else), and any
 * signal that an SMS was actually dispatched — with no provider wired, the
 * request endpoint answers 503 `upstream_unavailable`, which is the status this
 * contract already lists for it.
 */

/** The password grant. `deviceId` binds the refresh token to one installation. */
export const AuthTokenRequestSchema = z
  .object({
    email: EmailSchema,
    /**
     * Capped at 128 like every other password field in this repository:
     * bcrypt hashes only the first 72 bytes, so anything longer silently
     * stops mattering, and hashing cost scales with input length.
     */
    password: z.string().min(8).max(128),
    deviceId: IdSchema,
  })
  .strict();

export type AuthTokenRequest = z.infer<typeof AuthTokenRequestSchema>;

/**
 * The identity the app renders before it has called /v1/me. Deliberately the
 * few fields a header needs — the full profile is one request away and does
 * not belong inside a token response.
 */
export const AuthPrincipalSchema = z
  .object({
    id: IdSchema,
    email: EmailSchema,
    firstName: z.string().min(1).max(50),
    lastName: z.string().min(1).max(50),
    role: UserRoleSchema,
    language: LanguageSchema,
  })
  .strict();

export type AuthPrincipal = z.infer<typeof AuthPrincipalSchema>;

/**
 * A token pair.
 *
 * `expiresIn` is seconds from issue, not an absolute instant: a phone with a
 * skewed clock reading an absolute expiry either refreshes constantly or never.
 * `refreshToken` is returned on EVERY successful exchange because refresh
 * tokens rotate — the app must replace what it stored, and a response that
 * omits it on refresh is how a client ends up pinned to a token that is about
 * to be invalidated.
 */
export const TokenPairSchema = z
  .object({
    tokenType: z.literal("Bearer"),
    accessToken: z.string().min(1).max(4096),
    expiresIn: z.number().int().positive().max(86_400),
    refreshToken: z.string().min(1).max(4096),
    refreshExpiresIn: z.number().int().positive().max(31_536_000),
    principal: AuthPrincipalSchema,
  })
  .strict();

export type TokenPair = z.infer<typeof TokenPairSchema>;

export const AuthTokenResponseSchema = successEnvelope(TokenPairSchema);

export const AuthRefreshRequestSchema = z
  .object({
    refreshToken: z.string().min(1).max(4096),
    deviceId: IdSchema,
  })
  .strict();

export const AuthRefreshResponseSchema = successEnvelope(TokenPairSchema);

/**
 * Revocation. Either one refresh token, or every session on the account —
 * the "sign out of all devices" a stolen phone needs. Exactly one of the two
 * must be asked for, because a request that names neither is ambiguous
 * between "do nothing" and "sign me out everywhere".
 */
export const AuthRevokeRequestSchema = z
  .object({
    refreshToken: z.string().min(1).max(4096).optional(),
    allSessions: z.boolean().default(false),
  })
  .strict()
  .refine((body) => Boolean(body.refreshToken) !== body.allSessions, {
    message: "Provide either refreshToken or allSessions: true, not both and not neither",
  });

export const RevocationSchema = z
  .object({
    /** How many refresh tokens stopped working. Zero is a valid, honest answer. */
    revokedCount: z.number().int().min(0),
  })
  .strict();

export const AuthRevokeResponseSchema = successEnvelope(RevocationSchema);

/** OTP sign-in by phone, the flow a GCC consumer app is expected to lead with. */
export const OtpRequestSchema = z
  .object({
    phone: PhoneSchema,
    deviceId: IdSchema,
    /** Which language to send the SMS in. Defaults to the account's, then AR. */
    language: LanguageSchema.optional(),
  })
  .strict();

/**
 * The challenge, with no hint about whether the number is registered — an OTP
 * endpoint that answers differently for a known and an unknown phone is an
 * account-enumeration oracle.
 */
export const OtpChallengeSchema = z
  .object({
    challengeId: IdSchema,
    /** Digits the app should render input boxes for. */
    codeLength: z.number().int().min(4).max(8),
    expiresAt: TimestampSchema,
    /** Earliest instant a resend will be accepted; drives the countdown. */
    resendAfter: TimestampSchema,
  })
  .strict();

export const OtpRequestResponseSchema = successEnvelope(OtpChallengeSchema);

export const OtpVerifyRequestSchema = z
  .object({
    challengeId: IdSchema,
    code: z.string().regex(/^\d{4,8}$/, "The code is 4 to 8 digits"),
    deviceId: IdSchema,
  })
  .strict();

export const OtpVerifyResponseSchema = successEnvelope(TokenPairSchema);
