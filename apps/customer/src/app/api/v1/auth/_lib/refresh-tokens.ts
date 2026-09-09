import { createHash, randomBytes, randomUUID } from "node:crypto";

import { mintAccessToken } from "@avenick/auth/access-token";
import { isSessionRevoked } from "@avenick/auth/session-revocation";
import type { AuthPrincipal, TokenPair } from "@avenick/contracts";
import type { Prisma, PrismaClient, RefreshTokenRevokedReason, UserRole } from "@avenick/database";

import { unauthenticated } from "../../_lib/errors";

/**
 * REFRESH TOKENS: issue, rotate, detect replay, revoke.
 *
 * The whole design is in `schema.prisma`'s comment on `model RefreshToken`; the
 * two rules that matter here are:
 *
 *   · a refresh token is spendable EXACTLY ONCE. Redeeming it mints a
 *     successor, stamps the spent row ROTATED and points `replacedById` at the
 *     successor;
 *   · the spent row is KEPT. That is what makes a replay distinguishable from a
 *     token that never existed — and a replay means an attacker holds a copy of
 *     something the real device already spent, so the answer is to revoke the
 *     whole `familyId` and force both of them to sign in again.
 *
 * Nothing in this module ever logs, returns or stores a token value. What is
 * stored is `sha256(value)`: a fast digest is right here and wrong for an OTP
 * code, because the input is 256 bits of randomness with no search space to
 * exhaust, and the refresh path needs an indexed exact-match lookup.
 */

/**
 * Sixty days. Long enough that a phone left in a drawer over a holiday still
 * opens without a sign-in, short enough to be a real bound on a token copied
 * off a device. The access token it mints lives fifteen minutes, so this is the
 * number that actually decides how long a stolen phone stays useful — which is
 * why `POST /v1/auth/revoke` and a password reset both end it early.
 */
export const REFRESH_TOKEN_TTL_SECONDS = 60 * 24 * 60 * 60;

/** 256 bits from the CSPRNG. base64url so it survives a JSON body untouched. */
const REFRESH_TOKEN_BYTES = 32;

/** Enough of a user agent to recognise a device in a session list, and no more. */
const USER_AGENT_MAX = 512;

/** The user columns this module needs to answer with a contract principal. */
export const PRINCIPAL_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  language: true,
  status: true,
  deletedAt: true,
  sessionsValidAfter: true,
} as const;

export interface PrincipalRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  language: string;
  status: string;
  deletedAt: Date | null;
  sessionsValidAfter: Date | null;
}

/**
 * The identity the app renders before it has called /v1/me.
 *
 * `AuthPrincipalSchema` caps firstName and lastName at 50 characters while the
 * column has no length limit, so a longer stored name would fail the wrapper's
 * response validation and turn a successful sign-in into a 500. Truncating is
 * the lesser evil: a header showing a clipped name is recoverable, being unable
 * to sign in at all is not. See the report — this is a real contract/schema
 * disagreement, not a defensive flourish.
 */
export function toAuthPrincipal(user: PrincipalRow): AuthPrincipal {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName.slice(0, 50),
    lastName: user.lastName.slice(0, 50),
    role: user.role,
    language: user.language,
  } as AuthPrincipal;
}

export function newRefreshTokenValue(): string {
  return randomBytes(REFRESH_TOKEN_BYTES).toString("base64url");
}

/** The stored form. 64 hex characters, which is what `tokenHash` is sized for. */
export function refreshTokenHash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function clampUserAgent(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, USER_AGENT_MAX) : null;
}

type Tx = PrismaClient | Prisma.TransactionClient;

export interface IssueContext {
  deviceId: string;
  ipAddress: string | null;
  userAgent: string | null;
}

/**
 * Start a NEW session: a fresh family, and the first token in it.
 *
 * `familyId` is set to the row's OWN id, which is why the id is generated here
 * instead of by `@default(cuid())`. The family's first token is the moment the
 * user actually authenticated, and `authAtSeconds` on every access token this
 * family ever mints is read from it — see `familyOriginSeconds`. Deriving it
 * from a rotation instead would let the value creep forward with every refresh,
 * and a value that creeps forward can creep PAST a revocation cutoff, which is
 * the one thing it exists to stay behind.
 */
export async function beginSession(
  tx: Tx,
  user: PrincipalRow,
  context: IssueContext,
  now: Date = new Date(),
): Promise<TokenPair> {
  const id = randomUUID();
  const value = newRefreshTokenValue();
  const row = await tx.refreshToken.create({
    data: {
      id,
      familyId: id,
      userId: user.id,
      tokenHash: refreshTokenHash(value),
      deviceId: context.deviceId,
      userAgent: context.userAgent,
      ipAddress: context.ipAddress,
      expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000),
    },
    select: { createdAt: true, expiresAt: true },
  });
  return composePair(user, value, row.createdAt, row.expiresAt, context.deviceId, now);
}

/**
 * Continue an existing session: a successor in the same family, carrying the
 * family's original authentication instant.
 */
export async function continueSession(
  tx: Tx,
  user: PrincipalRow,
  familyId: string,
  familyOriginAt: Date,
  context: IssueContext,
  now: Date = new Date(),
): Promise<{ pair: TokenPair; successorId: string }> {
  const value = newRefreshTokenValue();
  const row = await tx.refreshToken.create({
    data: {
      familyId,
      userId: user.id,
      tokenHash: refreshTokenHash(value),
      deviceId: context.deviceId,
      userAgent: context.userAgent,
      ipAddress: context.ipAddress,
      expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000),
    },
    select: { id: true, expiresAt: true },
  });
  return {
    pair: composePair(user, value, familyOriginAt, row.expiresAt, context.deviceId, now),
    successorId: row.id,
  };
}

function composePair(
  user: PrincipalRow,
  refreshValue: string,
  authAt: Date,
  refreshExpiresAt: Date,
  deviceId: string,
  now: Date,
): TokenPair {
  const access = mintAccessToken(
    {
      userId: user.id,
      role: user.role,
      language: user.language,
      deviceId,
      authAtSeconds: Math.floor(authAt.getTime() / 1000),
    },
    now.getTime(),
  );
  return {
    tokenType: "Bearer",
    accessToken: access.token,
    expiresIn: access.expiresIn,
    refreshToken: refreshValue,
    // Seconds from NOW, not an absolute instant: a phone with a skewed clock
    // reading an absolute expiry either refreshes constantly or never. The
    // contract says so explicitly, and requires a POSITIVE integer — a token
    // that has somehow already expired would fail response validation rather
    // than being handed to a client that cannot use it.
    refreshExpiresIn: Math.max(1, Math.round((refreshExpiresAt.getTime() - now.getTime()) / 1000)),
    principal: toAuthPrincipal(user),
  };
}

/**
 * Revoke every LIVE token in a lineage.
 *
 * Scoped to `revokedAt: null` so an existing REUSE_DETECTED is never
 * overwritten by a later routine reason: that stamp is the only record that a
 * replay happened, and a support engineer reading the row weeks later needs it
 * to still say so.
 */
export async function revokeFamily(
  tx: Tx,
  familyId: string,
  reason: RefreshTokenRevokedReason,
  now: Date = new Date(),
): Promise<number> {
  const { count } = await tx.refreshToken.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: now, revokedReason: reason },
  });
  return count;
}

/** Revoke every live token on an account — "sign out of all devices". */
export async function revokeAllForUser(
  tx: Tx,
  userId: string,
  reason: RefreshTokenRevokedReason,
  now: Date = new Date(),
): Promise<number> {
  const { count } = await tx.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: now, revokedReason: reason },
  });
  return count;
}

/**
 * When the family's first token was created — the instant the user actually
 * authenticated.
 *
 * `familyId` is the root token's id (see `beginSession`), so this is a primary
 * key lookup rather than a scan and sort over a lineage that can hold thousands
 * of rows after sixty days of refreshing.
 *
 * A missing root means the row has been pruned, which can only happen once the
 * family is older than the retention window. Refusing is the right answer and
 * inventing a later origin is not: an invented origin is one that might sit
 * AFTER a revocation cutoff, which is exactly the credential this whole
 * mechanism is meant to reject.
 */
export async function familyOriginAt(tx: Tx, familyId: string): Promise<Date | null> {
  const root = await tx.refreshToken.findUnique({
    where: { id: familyId },
    select: { createdAt: true },
  });
  return root?.createdAt ?? null;
}

/**
 * The account checks every token-issuing path repeats.
 *
 * `unauthenticated` and not `forbidden`: these routes answer a credential
 * exchange, where the client's only useful next move is to present a different
 * credential. They are also deliberately indistinguishable from a wrong
 * password — a suspended account that says "suspended" to an unauthenticated
 * caller is an account-state oracle.
 */
export function assertUsable(user: PrincipalRow | null, authAt: Date): asserts user is PrincipalRow {
  if (!user || user.status !== "ACTIVE" || user.deletedAt) {
    throw unauthenticated("Those credentials are not valid.");
  }
  if (isSessionRevoked(Math.floor(authAt.getTime() / 1000), user.sessionsValidAfter)) {
    throw unauthenticated("Your session has ended. Please sign in again.");
  }
}
