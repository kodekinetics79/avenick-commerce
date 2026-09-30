import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthTokenResponseSchema, ErrorEnvelopeSchema } from "@avenick/contracts";

/**
 * POST /api/v1/auth/token — the password grant.
 *
 * The interesting assertions are not "a good password works". They are that the
 * password is checked by the SAME function the web sign-in uses, that failures
 * are indistinguishable from each other, and that this route spends the SAME
 * throttle budget as the login form — because a second allowance would be a way
 * to keep brute-forcing after the website locked you out.
 */
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  verifyCredentials: vi.fn(),
  checkRateLimit: vi.fn(),
  createRefreshToken: vi.fn(),
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@/lib/auth-instance", () => ({ auth: mocks.auth }));
vi.mock("@avenick/auth/credentials", () => ({ verifyCredentials: mocks.verifyCredentials }));
vi.mock("@avenick/auth/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  clientIpFrom: () => "203.0.113.7",
  RATE_LIMITS: {
    login: { name: "login", limit: 10, windowMs: 900_000 },
    loginIp: { name: "login-ip", limit: 30, windowMs: 900_000 },
  },
}));
vi.mock("@avenick/observability", () => {
  const log = { error: mocks.logError, info: mocks.logInfo, warn: vi.fn(), debug: vi.fn(), with: () => log };
  return { log, instrumentRequest: () => ({ ctx: { log }, finish: vi.fn() }) };
});
vi.mock("@avenick/database", () => ({
  db: { refreshToken: { create: mocks.createRefreshToken } },
  RefreshTokenRevokedReason: { ROTATED: "ROTATED" },
  OtpPurpose: { SIGN_IN: "SIGN_IN" },
}));

import { POST } from "../token/route";

const USER = {
  id: "usr_1",
  email: "buyer@example.test",
  passwordHash: "$2a$12$whatever",
  firstName: "Layla",
  lastName: "Haddad",
  role: "CONSUMER",
  status: "ACTIVE",
  language: "EN",
  avatar: null,
  deletedAt: null,
  sessionsValidAfter: null,
};

const CREATED_AT = new Date("2026-09-08T12:00:00.000Z");

function post(body: unknown) {
  return new NextRequest("https://customer.test/api/v1/auth/token", {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "Avenick/1.0 (iOS)" },
    body: JSON.stringify(body),
  });
}

const GOOD_BODY = { email: "buyer@example.test", password: "correct-horse", deviceId: "dev_1" };

async function errorOf(response: Response) {
  return ErrorEnvelopeSchema.parse(await response.json()).error;
}

beforeEach(() => {
  vi.resetAllMocks();
  process.env.AUTH_SECRET = "v1-auth-token-route-test-secret";
  mocks.checkRateLimit.mockResolvedValue({ ok: true, count: 1, limit: 30, resetAt: Date.now() + 60_000 });
  mocks.createRefreshToken.mockResolvedValue({
    createdAt: CREATED_AT,
    expiresAt: new Date(CREATED_AT.getTime() + 60 * 24 * 3600 * 1000),
  });
});

afterEach(() => {
  delete process.env.AUTH_SECRET;
});

describe("issuing a pair", () => {
  it("answers a token pair that conforms to the published contract", async () => {
    mocks.verifyCredentials.mockResolvedValue(USER);
    const response = await POST(post(GOOD_BODY));
    expect(response.status).toBe(200);

    const { data } = AuthTokenResponseSchema.parse(await response.json());
    expect(data.tokenType).toBe("Bearer");
    expect(data.expiresIn).toBe(15 * 60);
    expect(data.principal).toEqual({
      id: "usr_1",
      email: "buyer@example.test",
      firstName: "Layla",
      lastName: "Haddad",
      role: "CONSUMER",
      language: "EN",
    });
    // A refresh token is returned on EVERY exchange, and it is not the access
    // token: a client that stored one for the other would be pinned to a
    // fifteen-minute session.
    expect(data.refreshToken).not.toBe(data.accessToken);
    expect(data.refreshExpiresIn).toBeGreaterThan(data.expiresIn);
  });

  it("stores the refresh token HASHED, never in plaintext, and binds it to the device", async () => {
    mocks.verifyCredentials.mockResolvedValue(USER);
    const response = await POST(post(GOOD_BODY));
    const { data } = AuthTokenResponseSchema.parse(await response.json());

    const written = mocks.createRefreshToken.mock.calls[0]![0].data;
    expect(written.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(written.tokenHash).not.toBe(data.refreshToken);
    expect(JSON.stringify(written)).not.toContain(data.refreshToken);
    expect(written.deviceId).toBe("dev_1");
    // The family's first token IS the family: `familyId` is its own id, so the
    // origin of the lineage can be found by primary key later.
    expect(written.familyId).toBe(written.id);
    expect(written.userAgent).toBe("Avenick/1.0 (iOS)");
  });

  it("never logs a token", async () => {
    mocks.verifyCredentials.mockResolvedValue(USER);
    const response = await POST(post(GOOD_BODY));
    const { data } = AuthTokenResponseSchema.parse(await response.json());
    const logged = JSON.stringify(mocks.logInfo.mock.calls);
    expect(logged).not.toContain(data.refreshToken);
    expect(logged).not.toContain(data.accessToken);
    expect(logged).toContain("dev_1");
  });

  it("delegates the password check rather than re-implementing it", async () => {
    mocks.verifyCredentials.mockResolvedValue(USER);
    await POST(post(GOOD_BODY));
    expect(mocks.verifyCredentials).toHaveBeenCalledWith({
      email: "buyer@example.test",
      password: "correct-horse",
    });
  });
});

describe("refusing", () => {
  it("answers one indistinguishable 401 for every credential failure", async () => {
    // verifyCredentials returns null for an unknown address, a wrong password,
    // a passwordless account and a suspended one alike.
    mocks.verifyCredentials.mockResolvedValue(null);
    const response = await POST(post(GOOD_BODY));
    expect(response.status).toBe(401);
    const error = await errorOf(response);
    expect(error.code).toBe("unauthenticated");
    expect(error.message).toBe("Those credentials are not valid.");
    expect(mocks.createRefreshToken).not.toHaveBeenCalled();
  });

  it("rejects a malformed body against the contract, naming the field", async () => {
    const response = await POST(post({ email: "not-an-email", password: "x", deviceId: "" }));
    expect(response.status).toBe(400);
    const error = await errorOf(response);
    expect(error.code).toBe("validation_failed");
    expect(Object.keys(error.fieldErrors ?? {})).toEqual(
      expect.arrayContaining(["email", "password", "deviceId"]),
    );
    expect(mocks.verifyCredentials).not.toHaveBeenCalled();
  });
});

describe("the throttle budget is the web sign-in's", () => {
  it("keys the per-IP rule exactly as config.ts does, so the budget is shared", async () => {
    mocks.verifyCredentials.mockResolvedValue(USER);
    await POST(post(GOOD_BODY));
    // The bare IP, not "ip:<addr>": a different key is a different bucket, and
    // a different bucket is a second allowance.
    expect(mocks.checkRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ name: "login-ip" }),
      "203.0.113.7",
    );
    expect(mocks.checkRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ name: "login" }),
      "buyer@example.test",
    );
  });

  it("normalises the address before spending the per-identifier budget", async () => {
    mocks.verifyCredentials.mockResolvedValue(USER);
    await POST(post({ ...GOOD_BODY, email: "Buyer@Example.Test" }));
    expect(mocks.checkRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ name: "login" }),
      "buyer@example.test",
    );
  });

  it("answers 429 with a Retry-After when the address is exhausted", async () => {
    mocks.checkRateLimit.mockImplementation(async (rule: { name: string }) =>
      rule.name === "login"
        ? { ok: false, count: 11, limit: 10, resetAt: Date.now() + 300_000 }
        : { ok: true, count: 1, limit: 30, resetAt: Date.now() + 60_000 },
    );
    const response = await POST(post(GOOD_BODY));
    expect(response.status).toBe(429);
    expect((await errorOf(response)).code).toBe("rate_limited");
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(mocks.verifyCredentials).not.toHaveBeenCalled();
  });
});

describe("a deployment with no signing secret", () => {
  it("refuses loudly rather than signing a forgeable token", async () => {
    delete process.env.AUTH_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    mocks.verifyCredentials.mockResolvedValue(USER);
    const response = await POST(post(GOOD_BODY));
    expect(response.status).toBe(503);
    expect((await errorOf(response)).code).toBe("upstream_unavailable");
    expect(mocks.logError).toHaveBeenCalled();
  });
});
