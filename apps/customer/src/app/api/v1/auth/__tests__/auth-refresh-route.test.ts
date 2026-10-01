import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthRefreshResponseSchema, ErrorEnvelopeSchema } from "@avenick/contracts";

/**
 * POST /api/v1/auth/refresh — rotation, and the replay it exists to catch.
 *
 * These tests describe the one behaviour that makes a refresh token safer than
 * a long-lived one: a token is spendable exactly once, the spent row is KEPT,
 * and presenting it again ends the whole lineage instead of quietly failing.
 * Everything else here — expiry, device binding, the revocation cutoff — is a
 * variation on "reject, and revoke, before minting anything".
 */
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findUniqueToken: vi.fn(),
  createToken: vi.fn(),
  updateManyToken: vi.fn(),
  findUniqueUser: vi.fn(),
  transaction: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@/lib/auth-instance", () => ({ auth: mocks.auth }));
vi.mock("@avenick/auth/rate-limit", () => ({
  checkRateLimit: async () => ({ ok: true, count: 1, limit: 120, resetAt: Date.now() + 60_000 }),
  clientIpFrom: () => "203.0.113.7",
}));
vi.mock("@avenick/observability", () => {
  const log = {
    error: mocks.logError,
    info: mocks.logInfo,
    warn: mocks.logWarn,
    debug: vi.fn(),
    with: () => log,
  };
  return { log, instrumentRequest: () => ({ ctx: { log }, finish: vi.fn() }) };
});
vi.mock("@avenick/database", () => ({
  db: {
    refreshToken: {
      findUnique: mocks.findUniqueToken,
      create: mocks.createToken,
      updateMany: mocks.updateManyToken,
    },
    user: { findUnique: mocks.findUniqueUser },
    $transaction: mocks.transaction,
  },
  RefreshTokenRevokedReason: {
    ROTATED: "ROTATED",
    REUSE_DETECTED: "REUSE_DETECTED",
    SIGNED_OUT: "SIGNED_OUT",
    ALL_SESSIONS_REVOKED: "ALL_SESSIONS_REVOKED",
    PASSWORD_RESET: "PASSWORD_RESET",
    ADMIN_REVOKED: "ADMIN_REVOKED",
    USER_DEACTIVATED: "USER_DEACTIVATED",
  },
}));

import { POST } from "../refresh/route";

const PRESENTED = "presented-refresh-token-value";
const FAMILY_ORIGIN = new Date("2026-09-01T09:00:00.000Z");

const LIVE_ROW = {
  id: "rt_2",
  userId: "usr_1",
  familyId: "rt_root",
  deviceId: "dev_1",
  expiresAt: new Date("2026-11-01T09:00:00.000Z"),
  revokedAt: null as Date | null,
  revokedReason: null as string | null,
};

const USER = {
  id: "usr_1",
  email: "buyer@example.test",
  firstName: "Layla",
  lastName: "Haddad",
  role: "CONSUMER",
  language: "EN",
  status: "ACTIVE",
  deletedAt: null as Date | null,
  sessionsValidAfter: null as Date | null,
};

function post(body: unknown) {
  return new NextRequest("https://customer.test/api/v1/auth/refresh", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const GOOD_BODY = { refreshToken: PRESENTED, deviceId: "dev_1" };

async function errorOf(response: Response) {
  return ErrorEnvelopeSchema.parse(await response.json()).error;
}

/** The family root lookup is by primary key on `familyId`; the presented token is by hash. */
function tokenLookups(row: typeof LIVE_ROW | null, origin: Date | null = FAMILY_ORIGIN) {
  mocks.findUniqueToken.mockImplementation(async (args: { where: Record<string, unknown> }) => {
    if ("tokenHash" in args.where) return row;
    if ("id" in args.where) return origin ? { createdAt: origin } : null;
    return null;
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  process.env.AUTH_SECRET = "v1-auth-refresh-route-test-secret";
  mocks.findUniqueUser.mockResolvedValue({ ...USER });
  mocks.updateManyToken.mockResolvedValue({ count: 1 });
  mocks.createToken.mockResolvedValue({
    id: "rt_3",
    expiresAt: new Date("2026-11-08T12:00:00.000Z"),
  });
  // The route's transaction is a plain callback over the same client.
  mocks.transaction.mockImplementation(
    async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        refreshToken: {
          create: mocks.createToken,
          updateMany: mocks.updateManyToken,
          findUnique: mocks.findUniqueToken,
        },
        user: { findUnique: mocks.findUniqueUser },
      }),
  );
});

afterEach(() => {
  delete process.env.AUTH_SECRET;
});

describe("rotation", () => {
  it("looks the token up by HASH, never by its value", async () => {
    tokenLookups(LIVE_ROW);
    await POST(post(GOOD_BODY));
    const where = mocks.findUniqueToken.mock.calls[0]![0].where;
    expect(where.tokenHash).toBe(createHash("sha256").update(PRESENTED, "utf8").digest("hex"));
  });

  it("mints a successor in the SAME family and spends the presented token", async () => {
    tokenLookups(LIVE_ROW);
    const response = await POST(post(GOOD_BODY));
    expect(response.status).toBe(200);

    const created = mocks.createToken.mock.calls[0]![0].data;
    // Same lineage: one replayed token must be able to revoke everything
    // descended from the same sign-in.
    expect(created.familyId).toBe("rt_root");
    expect(created.tokenHash).toMatch(/^[0-9a-f]{64}$/);

    const spend = mocks.updateManyToken.mock.calls.at(-1)![0];
    expect(spend.where).toEqual({ id: "rt_2", revokedAt: null });
    expect(spend.data.revokedReason).toBe("ROTATED");
    // The lineage is recorded, which is what makes a replay identifiable later.
    expect(spend.data.replacedById).toBe("rt_3");
  });

  it("returns a NEW refresh token, because the old one is now dead", async () => {
    tokenLookups(LIVE_ROW);
    const response = await POST(post(GOOD_BODY));
    const { data } = AuthRefreshResponseSchema.parse(await response.json());
    expect(data.refreshToken).not.toBe(PRESENTED);
    expect(data.principal.id).toBe("usr_1");
  });

  it("spends the token CONDITIONALLY on it still being live", async () => {
    // Without `revokedAt: null` in the WHERE, two concurrent refreshes would
    // each mint a successor and each believe it won.
    tokenLookups(LIVE_ROW);
    await POST(post(GOOD_BODY));
    expect(mocks.updateManyToken.mock.calls.at(-1)![0].where).toHaveProperty("revokedAt", null);
  });
});

describe("reuse detection", () => {
  it("revokes the WHOLE family when an already-rotated token is replayed", async () => {
    tokenLookups({ ...LIVE_ROW, revokedAt: new Date("2026-09-08T11:00:00Z"), revokedReason: "ROTATED" });
    const response = await POST(post(GOOD_BODY));

    expect(response.status).toBe(401);
    expect((await errorOf(response)).code).toBe("unauthenticated");
    expect(mocks.updateManyToken).toHaveBeenCalledWith({
      where: { familyId: "rt_root", revokedAt: null },
      data: { revokedAt: expect.any(Date), revokedReason: "REUSE_DETECTED" },
    });
    // Nothing is minted for a replay.
    expect(mocks.createToken).not.toHaveBeenCalled();
  });

  it("only ever revokes rows that are still LIVE, so a REUSE_DETECTED stamp survives", async () => {
    // Re-revoking must not overwrite the one record that a replay happened.
    tokenLookups({ ...LIVE_ROW, revokedAt: new Date(), revokedReason: "REUSE_DETECTED" });
    await POST(post(GOOD_BODY));
    expect(mocks.updateManyToken.mock.calls[0]![0].where).toHaveProperty("revokedAt", null);
  });

  it("treats a lost rotation race as a replay", async () => {
    // The conditional update matched nothing: somebody else spent this token
    // between the read and the write.
    tokenLookups(LIVE_ROW);
    mocks.updateManyToken.mockImplementation(async (args: { where: Record<string, unknown> }) =>
      "id" in args.where ? { count: 0 } : { count: 2 },
    );
    const response = await POST(post(GOOD_BODY));
    expect(response.status).toBe(401);
    expect(mocks.updateManyToken).toHaveBeenCalledWith({
      where: { familyId: "rt_root", revokedAt: null },
      data: { revokedAt: expect.any(Date), revokedReason: "REUSE_DETECTED" },
    });
  });

  it("ends the family when the token arrives from a different installation", async () => {
    tokenLookups(LIVE_ROW);
    const response = await POST(post({ refreshToken: PRESENTED, deviceId: "dev_OTHER" }));
    expect(response.status).toBe(401);
    expect(mocks.updateManyToken.mock.calls[0]![0].data.revokedReason).toBe("REUSE_DETECTED");
    expect(mocks.createToken).not.toHaveBeenCalled();
  });

  it("answers an unknown token exactly as it answers a replayed one", async () => {
    tokenLookups(null);
    const response = await POST(post(GOOD_BODY));
    expect(response.status).toBe(401);
    expect((await errorOf(response)).message).toBe(
      "That session is no longer valid. Please sign in again.",
    );
    // Nothing to revoke: there is no family, and there is nothing to learn.
    expect(mocks.updateManyToken).not.toHaveBeenCalled();
  });
});

describe("the refresh path cannot outrun a revocation", () => {
  it("refuses and ends the family when the account's cutoff is after the sign-in", async () => {
    // A password reset moved sessionsValidAfter past the family's origin. The
    // sixty-day refresh token must not be able to mint a fresh access token.
    tokenLookups(LIVE_ROW);
    mocks.findUniqueUser.mockResolvedValue({
      ...USER,
      sessionsValidAfter: new Date("2026-09-05T09:00:00.000Z"),
    });
    const response = await POST(post(GOOD_BODY));

    expect(response.status).toBe(401);
    expect((await errorOf(response)).message).toMatch(/session has ended/i);
    expect(mocks.updateManyToken.mock.calls[0]![0].data.revokedReason).toBe("ALL_SESSIONS_REVOKED");
    expect(mocks.createToken).not.toHaveBeenCalled();
  });

  it("dates the session by the FAMILY's origin, not by the token being spent", async () => {
    // The successor was created after the cutoff; the family was not. Judging
    // by the newest token would let a session creep past its own revocation.
    tokenLookups({ ...LIVE_ROW }, new Date("2026-09-01T09:00:00.000Z"));
    mocks.findUniqueUser.mockResolvedValue({
      ...USER,
      sessionsValidAfter: new Date("2026-09-04T00:00:00.000Z"),
    });
    expect((await POST(post(GOOD_BODY))).status).toBe(401);
  });

  it("refuses when the family's first token is gone", async () => {
    tokenLookups(LIVE_ROW, null);
    const response = await POST(post(GOOD_BODY));
    expect(response.status).toBe(401);
    expect(mocks.createToken).not.toHaveBeenCalled();
  });

  it("ends the family for a deactivated account", async () => {
    tokenLookups(LIVE_ROW);
    mocks.findUniqueUser.mockResolvedValue({ ...USER, status: "SUSPENDED" });
    expect((await POST(post(GOOD_BODY))).status).toBe(401);
    expect(mocks.updateManyToken.mock.calls[0]![0].data.revokedReason).toBe("USER_DEACTIVATED");
  });

  it("refuses an expired token without accusing anyone", async () => {
    tokenLookups({ ...LIVE_ROW, expiresAt: new Date("2026-01-01T00:00:00.000Z") });
    expect((await POST(post(GOOD_BODY))).status).toBe(401);
    // Expiry is routine: the family dies with it, so nothing is revoked and no
    // warning is raised.
    expect(mocks.updateManyToken).not.toHaveBeenCalled();
  });
});

describe("logging", () => {
  it("never writes a token value to the log", async () => {
    tokenLookups(LIVE_ROW);
    const response = await POST(post(GOOD_BODY));
    const { data } = AuthRefreshResponseSchema.parse(await response.json());
    const logged = JSON.stringify([
      mocks.logInfo.mock.calls,
      mocks.logWarn.mock.calls,
      mocks.logError.mock.calls,
    ]);
    expect(logged).not.toContain(PRESENTED);
    expect(logged).not.toContain(data.refreshToken);
    expect(logged).not.toContain(data.accessToken);
  });

  it("raises a WARN naming the family when a replay is detected", async () => {
    tokenLookups({ ...LIVE_ROW, revokedAt: new Date(), revokedReason: "ROTATED" });
    await POST(post(GOOD_BODY));
    expect(mocks.logWarn).toHaveBeenCalledWith(
      expect.stringContaining("refresh family ended"),
      expect.objectContaining({ familyId: "rt_root", reason: "REUSE_DETECTED" }),
    );
  });
});
