import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthRevokeResponseSchema, ErrorEnvelopeSchema } from "@avenick/contracts";

/**
 * POST /api/v1/auth/revoke — sign out, and the /v1 half of the security fix.
 *
 * This is the only endpoint on the surface that both requires a credential and
 * accepts a bearer one, which makes it the place to prove three things at once:
 * that "sign out everywhere" ends WEB sessions as well as mobile ones, that the
 * /v1 principal resolver applies `sessionsValidAfter` to a cookie exactly as
 * `guarded()` does, and that a bearer token is accepted here because this route
 * opted in — not because a header was present.
 */
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findUniqueUser: vi.fn(),
  updateUser: vi.fn(),
  findUniqueToken: vi.fn(),
  updateManyToken: vi.fn(),
  transaction: vi.fn(),
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@/lib/auth-instance", () => ({ auth: mocks.auth }));
vi.mock("@avenick/auth/rate-limit", () => ({
  checkRateLimit: async () => ({ ok: true, count: 1, limit: 20, resetAt: Date.now() + 60_000 }),
  clientIpFrom: () => "203.0.113.7",
}));
vi.mock("@avenick/observability", () => {
  const log = { error: mocks.logError, info: mocks.logInfo, warn: vi.fn(), debug: vi.fn(), with: () => log };
  return { log, instrumentRequest: () => ({ ctx: { log }, finish: vi.fn() }) };
});
vi.mock("@avenick/database", () => ({
  db: {
    user: { findUnique: mocks.findUniqueUser, update: mocks.updateUser },
    refreshToken: { findUnique: mocks.findUniqueToken, updateMany: mocks.updateManyToken },
    $transaction: mocks.transaction,
  },
  RefreshTokenRevokedReason: {
    SIGNED_OUT: "SIGNED_OUT",
    ALL_SESSIONS_REVOKED: "ALL_SESSIONS_REVOKED",
  },
}));

const { mintAccessToken } = await import("@avenick/auth/access-token");
const { SESSION_ISSUED_AT_CLAIM } = await import("@avenick/auth/session-revocation");
const { POST } = await import("../revoke/route");

const SIGNED_IN_AT = Date.UTC(2026, 8, 1, 9, 0, 0);
const PRINCIPAL_ROW = {
  role: "CONSUMER",
  status: "ACTIVE",
  deletedAt: null as Date | null,
  sessionsValidAfter: null as Date | null,
  companyMember: null,
};

function post(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("https://customer.test/api/v1/auth/revoke", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function cookieSignedIn(issuedAtMs: number | null = SIGNED_IN_AT) {
  const session: Record<string, unknown> = { user: { id: "usr_1" } };
  if (issuedAtMs !== null) session[SESSION_ISSUED_AT_CLAIM] = Math.floor(issuedAtMs / 1000);
  mocks.auth.mockResolvedValue(session);
}

function bearer(authAtMs: number = SIGNED_IN_AT) {
  return `Bearer ${
    mintAccessToken(
      {
        userId: "usr_1",
        role: "CONSUMER",
        language: "EN",
        deviceId: "dev_1",
        authAtSeconds: Math.floor(authAtMs / 1000),
      },
      Date.now(),
    ).token
  }`;
}

async function errorOf(response: Response) {
  return ErrorEnvelopeSchema.parse(await response.json()).error;
}

beforeEach(() => {
  vi.resetAllMocks();
  process.env.AUTH_SECRET = "v1-auth-revoke-route-test-secret";
  mocks.auth.mockResolvedValue(null);
  mocks.findUniqueUser.mockResolvedValue({ ...PRINCIPAL_ROW });
  mocks.updateManyToken.mockResolvedValue({ count: 2 });
  mocks.updateUser.mockResolvedValue({});
  mocks.transaction.mockImplementation(
    async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        refreshToken: { updateMany: mocks.updateManyToken },
        user: { update: mocks.updateUser },
      }),
  );
});

afterEach(() => {
  delete process.env.AUTH_SECRET;
});

describe("sign out of all devices", () => {
  it("revokes every live refresh token AND stamps the web-session cutoff", async () => {
    cookieSignedIn();
    const response = await POST(post({ allSessions: true }));
    expect(response.status).toBe(200);

    const { data } = AuthRevokeResponseSchema.parse(await response.json());
    expect(data.revokedCount).toBe(2);

    expect(mocks.updateManyToken).toHaveBeenCalledWith({
      where: { userId: "usr_1", revokedAt: null },
      data: { revokedAt: expect.any(Date), revokedReason: "ALL_SESSIONS_REVOKED" },
    });
    // Without this, "sign out of all devices" would leave every browser session
    // running for the rest of its thirty days.
    expect(mocks.updateUser).toHaveBeenCalledWith({
      where: { id: "usr_1" },
      data: { sessionsValidAfter: expect.any(Date) },
    });
  });

  it("does both inside one transaction, so neither can land alone", async () => {
    cookieSignedIn();
    await POST(post({ allSessions: true }));
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });
});

describe("sign out this device", () => {
  const VALUE = "one-device-refresh-token";
  const HASH = createHash("sha256").update(VALUE, "utf8").digest("hex");

  it("revokes the token's whole family, not just the row presented", async () => {
    cookieSignedIn();
    mocks.findUniqueToken.mockResolvedValue({ familyId: "rt_root", userId: "usr_1" });
    const response = await POST(post({ refreshToken: VALUE }));

    expect(mocks.findUniqueToken).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tokenHash: HASH } }),
    );
    // The device holds only the newest token; leaving its predecessors live
    // would leave a session alive for whoever holds a copy.
    expect(mocks.updateManyToken).toHaveBeenCalledWith({
      where: { familyId: "rt_root", revokedAt: null },
      data: { revokedAt: expect.any(Date), revokedReason: "SIGNED_OUT" },
    });
    expect((await response.json()).data.revokedCount).toBe(2);
    // The account-wide cutoff is NOT touched: this is one device, not all.
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("answers an honest zero for a token this account does not hold", async () => {
    cookieSignedIn();
    mocks.findUniqueToken.mockResolvedValue({ familyId: "rt_other", userId: "usr_OTHER" });
    const response = await POST(post({ refreshToken: VALUE }));

    expect(AuthRevokeResponseSchema.parse(await response.json()).data.revokedCount).toBe(0);
    // Never revoke another account's family on the say-so of a caller who
    // merely knows a token value: that would be a denial of service.
    expect(mocks.updateManyToken).not.toHaveBeenCalled();
  });

  it("answers the same zero for a token that does not exist", async () => {
    cookieSignedIn();
    mocks.findUniqueToken.mockResolvedValue(null);
    const response = await POST(post({ refreshToken: VALUE }));
    expect((await response.json()).data.revokedCount).toBe(0);
  });
});

describe("the contract's exclusive choice", () => {
  it.each([
    ["neither", {}],
    ["both", { refreshToken: "abc", allSessions: true }],
  ])("rejects a request naming %s", async (_label, body) => {
    cookieSignedIn();
    const response = await POST(post(body));
    expect(response.status).toBe(400);
    expect((await errorOf(response)).code).toBe("validation_failed");
  });
});

describe("which credentials this route accepts", () => {
  it("serves a bearer token, because this route opted in", async () => {
    mocks.auth.mockResolvedValue(null);
    const response = await POST(post({ allSessions: true }, { authorization: bearer() }));
    expect(response.status).toBe(200);
  });

  it("refuses a guest", async () => {
    mocks.auth.mockResolvedValue(null);
    const response = await POST(post({ allSessions: true }));
    expect(response.status).toBe(401);
    expect((await errorOf(response)).code).toBe("unauthenticated");
  });

  it("refuses a forged bearer token", async () => {
    mocks.auth.mockResolvedValue(null);
    const response = await POST(
      post({ allSessions: true }, { authorization: "Bearer not.a.token" }),
    );
    expect(response.status).toBe(401);
  });
});

describe("sessionsValidAfter on the /v1 surface", () => {
  it("refuses a COOKIE session issued before the cutoff", async () => {
    // The web path, on the mobile surface: the same stolen cookie, the same
    // answer as `guarded()` gives on /api.
    cookieSignedIn(SIGNED_IN_AT);
    mocks.findUniqueUser.mockResolvedValue({
      ...PRINCIPAL_ROW,
      sessionsValidAfter: new Date("2026-09-05T00:00:00.000Z"),
    });
    const response = await POST(post({ allSessions: true }));
    expect(response.status).toBe(401);
    expect((await errorOf(response)).message).toMatch(/session has ended/i);
  });

  it("refuses a BEARER token issued before the cutoff", async () => {
    mocks.auth.mockResolvedValue(null);
    mocks.findUniqueUser.mockResolvedValue({
      ...PRINCIPAL_ROW,
      sessionsValidAfter: new Date("2026-09-05T00:00:00.000Z"),
    });
    const response = await POST(post({ allSessions: true }, { authorization: bearer() }));
    expect(response.status).toBe(401);
    expect((await errorOf(response)).message).toMatch(/session has ended/i);
  });

  it("admits a cookie session issued after the cutoff", async () => {
    cookieSignedIn(Date.UTC(2026, 8, 6, 0, 0, 0));
    mocks.findUniqueUser.mockResolvedValue({
      ...PRINCIPAL_ROW,
      sessionsValidAfter: new Date("2026-09-05T00:00:00.000Z"),
    });
    expect((await POST(post({ allSessions: true }))).status).toBe(200);
  });

  it("refuses a cookie session it cannot date once a cutoff exists", async () => {
    cookieSignedIn(null);
    mocks.findUniqueUser.mockResolvedValue({
      ...PRINCIPAL_ROW,
      sessionsValidAfter: new Date("2026-09-05T00:00:00.000Z"),
    });
    expect((await POST(post({ allSessions: true }))).status).toBe(401);
  });

  it("leaves an undated cookie session alone while the cutoff is NULL", async () => {
    cookieSignedIn(null);
    expect((await POST(post({ allSessions: true }))).status).toBe(200);
  });

  it("still refuses a suspended account with 403, not 401", async () => {
    // An account that is not permitted is a different answer from a session
    // that has ended, and a client acts on them differently.
    cookieSignedIn();
    mocks.findUniqueUser.mockResolvedValue({ ...PRINCIPAL_ROW, status: "SUSPENDED" });
    const response = await POST(post({ allSessions: true }));
    expect(response.status).toBe(403);
    expect((await errorOf(response)).code).toBe("forbidden");
  });
});
