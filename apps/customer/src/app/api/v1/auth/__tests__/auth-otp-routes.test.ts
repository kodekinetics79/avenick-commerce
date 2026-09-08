import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorEnvelopeSchema, OtpRequestResponseSchema, OtpVerifyResponseSchema } from "@avenick/contracts";

/**
 * POST /api/v1/auth/otp/request and /verify — the phone-first flow.
 *
 * Three properties are worth more than the happy path here:
 *
 *   · the request endpoint never looks an account up, so it cannot answer
 *     differently for a registered and an unregistered number;
 *   · the code is stored under a KEYED hash. A six-digit code under SHA-256 is
 *     exhausted in milliseconds by anyone who can read the table, so a test
 *     that the stored value is not a bare digest of the code is a test of the
 *     one thing the schema comment insists on;
 *   · nothing is delivered, and the endpoint SAYS so with a 503 rather than
 *     handing back a challenge id for a code that will never arrive.
 */
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  checkRateLimit: vi.fn(),
  findFirstChallenge: vi.fn(),
  findUniqueChallenge: vi.fn(),
  createChallenge: vi.fn(),
  updateManyChallenge: vi.fn(),
  findUniqueUser: vi.fn(),
  updateManyUser: vi.fn(),
  createToken: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@/lib/auth-instance", () => ({ auth: mocks.auth }));
vi.mock("@avenick/auth/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
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
    otpChallenge: {
      findFirst: mocks.findFirstChallenge,
      findUnique: mocks.findUniqueChallenge,
      create: mocks.createChallenge,
      updateMany: mocks.updateManyChallenge,
    },
    user: { findUnique: mocks.findUniqueUser, updateMany: mocks.updateManyUser },
    refreshToken: { create: mocks.createToken },
  },
  OtpPurpose: { SIGN_IN: "SIGN_IN", VERIFY_PHONE: "VERIFY_PHONE" },
  RefreshTokenRevokedReason: { ROTATED: "ROTATED" },
}));

const { hashOtpCode, OTP_MAX_ATTEMPTS } = await import("../_lib/otp");
const { setSmsSender } = await import("../_lib/sms");
const { POST: REQUEST } = await import("../otp/request/route");
const { POST: VERIFY } = await import("../otp/verify/route");

const PHONE = "+971501234567";
const SECRET = "v1-otp-route-test-secret";
const CREATED_AT = new Date("2026-09-08T12:00:00.000Z");

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

function requestPost(body: unknown) {
  return new NextRequest("https://customer.test/api/v1/auth/otp/request", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function verifyPost(body: unknown) {
  return new NextRequest("https://customer.test/api/v1/auth/otp/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function errorOf(response: Response) {
  return ErrorEnvelopeSchema.parse(await response.json()).error;
}

/** A sender that reports itself configured, and records what it was asked to send. */
function fakeSender() {
  const sent: { to: string; body: string }[] = [];
  setSmsSender({
    name: "fake",
    configured: true,
    async send(message) {
      sent.push(message);
    },
  });
  return sent;
}

beforeEach(() => {
  vi.resetAllMocks();
  process.env.AUTH_SECRET = SECRET;
  delete process.env.OTP_DEV_ECHO;
  setSmsSender(null);
  mocks.auth.mockResolvedValue(null);
  mocks.checkRateLimit.mockResolvedValue({ ok: true, count: 1, limit: 20, resetAt: Date.now() + 60_000 });
  mocks.findFirstChallenge.mockResolvedValue(null);
  mocks.createChallenge.mockResolvedValue({
    id: "otp_1",
    createdAt: CREATED_AT,
    expiresAt: new Date(CREATED_AT.getTime() + 300_000),
  });
  mocks.updateManyChallenge.mockResolvedValue({ count: 1 });
  mocks.updateManyUser.mockResolvedValue({ count: 1 });
  mocks.createToken.mockResolvedValue({
    id: "rt_1",
    createdAt: CREATED_AT,
    expiresAt: new Date(CREATED_AT.getTime() + 60 * 24 * 3600 * 1000),
  });
});

afterEach(() => {
  setSmsSender(null);
  delete process.env.AUTH_SECRET;
  delete process.env.OTP_DEV_ECHO;
});

describe("requesting a code with no SMS provider wired", () => {
  it("answers 503 rather than handing back a challenge for a code nobody will get", async () => {
    const response = await REQUEST(requestPost({ phone: PHONE, deviceId: "dev_1" }));
    expect(response.status).toBe(503);
    expect((await errorOf(response)).code).toBe("upstream_unavailable");
    // Nothing is minted: an undeliverable challenge is a row holding a hash of
    // a live credential for no reason.
    expect(mocks.createChallenge).not.toHaveBeenCalled();
    expect(mocks.logError).toHaveBeenCalled();
  });

  it("mints anyway under an explicit non-production dev echo, and says it was not delivered", async () => {
    process.env.OTP_DEV_ECHO = "1";
    const response = await REQUEST(requestPost({ phone: PHONE, deviceId: "dev_1" }));
    expect(response.status).toBe(200);
    expect(mocks.logWarn).toHaveBeenCalledWith(
      expect.stringContaining("NOT delivered"),
      expect.objectContaining({ challengeId: "otp_1" }),
    );
  });
});

describe("requesting a code", () => {
  it("answers the contract's challenge, with a resend countdown", async () => {
    fakeSender();
    const response = await REQUEST(requestPost({ phone: PHONE, deviceId: "dev_1" }));
    expect(response.status).toBe(200);

    const { data } = OtpRequestResponseSchema.parse(await response.json());
    expect(data.challengeId).toBe("otp_1");
    expect(data.codeLength).toBe(6);
    expect(new Date(data.resendAfter).getTime()).toBe(CREATED_AT.getTime() + 60_000);
    expect(new Date(data.expiresAt).getTime()).toBeGreaterThan(new Date(data.resendAfter).getTime());
  });

  it("NEVER looks an account up — the reason it cannot be an enumeration oracle", async () => {
    fakeSender();
    await REQUEST(requestPost({ phone: PHONE, deviceId: "dev_1" }));
    expect(mocks.findUniqueUser).not.toHaveBeenCalled();
  });

  it("stores the code under a KEYED hash, not a bare digest of it", async () => {
    const sent = fakeSender();
    await REQUEST(requestPost({ phone: PHONE, deviceId: "dev_1" }));

    const written = mocks.createChallenge.mock.calls[0]![0].data;
    const code = /(\d{6})/.exec(sent[0]!.body)![1]!;

    // The stored value is not the code, and it is not any unkeyed digest of it.
    expect(written.codeHash).not.toContain(code);
    expect(written.codeHash).toMatch(/^[0-9a-f]{64}$/);
    // It IS the HMAC under the server key, bound to this phone and purpose.
    expect(written.codeHash).toBe(hashOtpCode(PHONE, "SIGN_IN" as never, code));

    // The same code for a different number hashes differently, so a row cannot
    // be lifted from one challenge to another.
    expect(hashOtpCode("+971509999999", "SIGN_IN" as never, code)).not.toBe(written.codeHash);

    // And without the key the digest is not reproducible at all.
    delete process.env.AUTH_SECRET;
    expect(() => hashOtpCode(PHONE, "SIGN_IN" as never, code)).toThrow();
    process.env.AUTH_SECRET = SECRET;
  });

  it("binds the challenge to the installation that asked for it", async () => {
    fakeSender();
    await REQUEST(requestPost({ phone: PHONE, deviceId: "dev_1" }));
    expect(mocks.createChallenge.mock.calls[0]![0].data).toMatchObject({
      phone: PHONE,
      deviceId: "dev_1",
      purpose: "SIGN_IN",
      ipAddress: "203.0.113.7",
    });
  });

  it("throttles per phone as well as per IP", async () => {
    fakeSender();
    mocks.checkRateLimit.mockImplementation(async (rule: { name: string }) =>
      rule.name === "v1-otp-request-phone"
        ? { ok: false, count: 6, limit: 5, resetAt: Date.now() + 600_000 }
        : { ok: true, count: 1, limit: 20, resetAt: Date.now() + 60_000 },
    );
    const response = await REQUEST(requestPost({ phone: PHONE, deviceId: "dev_1" }));
    expect(response.status).toBe(429);
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(mocks.createChallenge).not.toHaveBeenCalled();
  });

  it("enforces the resend interval it advertises", async () => {
    fakeSender();
    mocks.findFirstChallenge.mockResolvedValue({ createdAt: new Date(Date.now() - 10_000) });
    const response = await REQUEST(requestPost({ phone: PHONE, deviceId: "dev_1" }));
    expect(response.status).toBe(429);
    expect(mocks.createChallenge).not.toHaveBeenCalled();
  });
});

describe("verifying a code", () => {
  const CODE = "123456";
  const challengeRow = (overrides: Record<string, unknown> = {}) => ({
    id: "otp_1",
    phone: PHONE,
    codeHash: hashOtpCode(PHONE, "SIGN_IN" as never, CODE),
    purpose: "SIGN_IN",
    expiresAt: new Date(Date.now() + 120_000),
    deviceId: "dev_1",
    ...overrides,
  });

  const body = (overrides: Record<string, unknown> = {}) => ({
    challengeId: "otp_1",
    code: CODE,
    deviceId: "dev_1",
    ...overrides,
  });

  it("signs the account in and issues a token pair", async () => {
    mocks.findUniqueChallenge.mockResolvedValue(challengeRow());
    mocks.findUniqueUser.mockResolvedValue({ ...USER });

    const response = await VERIFY(verifyPost(body()));
    expect(response.status).toBe(200);
    const { data } = OtpVerifyResponseSchema.parse(await response.json());
    expect(data.principal.id).toBe("usr_1");
    expect(data.tokenType).toBe("Bearer");
    // The refresh token is stored hashed, exactly as the password grant stores it.
    expect(mocks.createToken.mock.calls[0]![0].data.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("spends an attempt BEFORE comparing, and lets the database enforce the cap", async () => {
    mocks.findUniqueChallenge.mockResolvedValue(challengeRow());
    mocks.findUniqueUser.mockResolvedValue({ ...USER });
    await VERIFY(verifyPost(body()));

    const spend = mocks.updateManyChallenge.mock.calls[0]![0];
    expect(spend.where).toEqual({
      id: "otp_1",
      consumedAt: null,
      attempts: { lt: OTP_MAX_ATTEMPTS },
    });
    expect(spend.data).toEqual({ attempts: { increment: 1 } });
  });

  it("consumes the challenge conditionally, so one code cannot mint two sessions", async () => {
    mocks.findUniqueChallenge.mockResolvedValue(challengeRow());
    mocks.findUniqueUser.mockResolvedValue({ ...USER });
    await VERIFY(verifyPost(body()));
    expect(mocks.updateManyChallenge.mock.calls[1]![0].where).toEqual({
      id: "otp_1",
      consumedAt: null,
    });
  });

  it("marks the number verified, because answering the code proved it", async () => {
    mocks.findUniqueChallenge.mockResolvedValue(challengeRow());
    mocks.findUniqueUser.mockResolvedValue({ ...USER });
    await VERIFY(verifyPost(body()));
    expect(mocks.updateManyUser).toHaveBeenCalledWith({
      where: { id: "usr_1", phoneVerified: null },
      data: { phoneVerified: expect.any(Date) },
    });
  });

  it.each([
    ["a wrong code", () => mocks.findUniqueChallenge.mockResolvedValue(challengeRow()), { code: "000000" }],
    ["an expired challenge", () =>
      mocks.findUniqueChallenge.mockResolvedValue(
        challengeRow({ expiresAt: new Date(Date.now() - 1000) }),
      ), {}],
    ["a different installation", () => mocks.findUniqueChallenge.mockResolvedValue(challengeRow()), {
      deviceId: "dev_OTHER",
    }],
    ["a challenge for another purpose", () =>
      mocks.findUniqueChallenge.mockResolvedValue(challengeRow({ purpose: "VERIFY_PHONE" })), {}],
    ["an unknown challenge", () => mocks.findUniqueChallenge.mockResolvedValue(null), {}],
  ])("answers one indistinguishable 401 for %s", async (_label, arrange, overrides) => {
    arrange();
    mocks.findUniqueUser.mockResolvedValue({ ...USER });
    const response = await VERIFY(verifyPost(body(overrides)));
    expect(response.status).toBe(401);
    expect((await errorOf(response)).message).toBe("That code is not valid. Request a new one.");
    expect(mocks.createToken).not.toHaveBeenCalled();
  });

  it("refuses once the attempt cap is spent, without reading the row", async () => {
    mocks.updateManyChallenge.mockResolvedValue({ count: 0 });
    const response = await VERIFY(verifyPost(body()));
    expect(response.status).toBe(401);
    expect(mocks.findUniqueChallenge).not.toHaveBeenCalled();
  });

  it("gives a verified number with no account the same refusal, and mints nothing", async () => {
    mocks.findUniqueChallenge.mockResolvedValue(challengeRow());
    mocks.findUniqueUser.mockResolvedValue(null);
    const response = await VERIFY(verifyPost(body()));
    expect(response.status).toBe(401);
    expect(mocks.createToken).not.toHaveBeenCalled();
  });

  it("refuses a suspended account", async () => {
    mocks.findUniqueChallenge.mockResolvedValue(challengeRow());
    mocks.findUniqueUser.mockResolvedValue({ ...USER, status: "SUSPENDED" });
    expect((await VERIFY(verifyPost(body()))).status).toBe(401);
    expect(mocks.createToken).not.toHaveBeenCalled();
  });

  it("never logs the code or the token", async () => {
    mocks.findUniqueChallenge.mockResolvedValue(challengeRow());
    mocks.findUniqueUser.mockResolvedValue({ ...USER });
    const response = await VERIFY(verifyPost(body()));
    const { data } = OtpVerifyResponseSchema.parse(await response.json());
    const logged = JSON.stringify([mocks.logInfo.mock.calls, mocks.logWarn.mock.calls]);
    expect(logged).not.toContain(CODE);
    expect(logged).not.toContain(data.refreshToken);
  });
});
