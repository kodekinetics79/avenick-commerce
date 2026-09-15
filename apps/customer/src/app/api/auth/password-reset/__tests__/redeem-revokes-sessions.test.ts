import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POST /api/auth/password-reset/redeem — the live hole, closed.
 *
 * This route's own comment used to say it: browser sessions are NextAuth JWTs,
 * they "carry no server-side row and stay valid until they expire, which no
 * schema-free change can revoke". With a thirty-day maxAge that meant a cookie
 * an attacker copied yesterday kept working for another month, no matter how
 * many times the owner reset their password. The column to fix it existed and
 * nothing wrote to it.
 *
 * These tests assert the two writes that close it, and that both land inside
 * the SAME conditional update as the new password — so a reset cannot succeed
 * while leaving the old sessions alive.
 */
const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  clientIpFrom: vi.fn(() => "203.0.113.7"),
  findUniqueUser: vi.fn(),
  updateManyUser: vi.fn(),
  createAudit: vi.fn(),
  deleteManySession: vi.fn(),
  updateManyRefreshToken: vi.fn(),
  transaction: vi.fn(),
  hash: vi.fn(async () => "$2a$12$newhash"),
  verifyToken: vi.fn(),
  fingerprintMatches: vi.fn(() => true),
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("bcryptjs", () => ({ default: { hash: mocks.hash, compare: vi.fn() } }));
vi.mock("@avenick/auth/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  clientIpFrom: mocks.clientIpFrom,
  RATE_LIMITS: { passwordResetRedeem: { name: "prr", limit: 10, windowMs: 900_000 } },
}));
vi.mock("@avenick/observability", () => ({
  log: { info: mocks.logInfo, error: mocks.logError, warn: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/lib/password-reset", () => ({
  verifyPasswordResetToken: mocks.verifyToken,
  fingerprintMatches: mocks.fingerprintMatches,
}));
vi.mock("@avenick/database", () => ({
  db: { $transaction: mocks.transaction },
  AuditAction: { UPDATE: "UPDATE" },
  UserRole: {
    ADMIN: "ADMIN",
    SUPER_ADMIN: "SUPER_ADMIN",
    SELLER_OWNER: "SELLER_OWNER",
    SELLER_STAFF: "SELLER_STAFF",
  },
  UserStatus: { ACTIVE: "ACTIVE" },
  RefreshTokenRevokedReason: { PASSWORD_RESET: "PASSWORD_RESET" },
}));

// The user read happens on `db.user.findUnique` before the transaction; the
// module mock above replaces `db` wholesale, so it is patched in here.
const { db } = await import("@avenick/database");
(db as unknown as Record<string, unknown>)["user"] = { findUnique: mocks.findUniqueUser };

const { POST } = await import("../redeem/route");

const USER = {
  id: "usr_1",
  passwordHash: "$2a$12$oldhash",
  role: "CONSUMER",
  status: "ACTIVE",
  deletedAt: null,
  emailVerified: new Date("2026-01-01T00:00:00.000Z"),
};

function post(body: unknown = { token: "tok", password: "Str0ng-passw0rd!" }) {
  return new NextRequest("https://customer.test/api/auth/password-reset/redeem", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.checkRateLimit.mockResolvedValue({ ok: true, count: 1, limit: 10, resetAt: Date.now() + 1000 });
  mocks.verifyToken.mockReturnValue({ ok: true, payload: { uid: "usr_1", hf: "abc" } });
  mocks.fingerprintMatches.mockReturnValue(true);
  mocks.findUniqueUser.mockResolvedValue({ ...USER });
  mocks.updateManyUser.mockResolvedValue({ count: 1 });
  mocks.createAudit.mockResolvedValue({});
  mocks.deleteManySession.mockResolvedValue({ count: 0 });
  mocks.updateManyRefreshToken.mockResolvedValue({ count: 3 });
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      user: { updateMany: mocks.updateManyUser },
      auditLog: { create: mocks.createAudit },
      session: { deleteMany: mocks.deleteManySession },
      refreshToken: { updateMany: mocks.updateManyRefreshToken },
    }),
  );
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("a password reset now ends every existing session", () => {
  it("stamps sessionsValidAfter alongside the new password hash", async () => {
    const response = await POST(post());
    expect(response.status).toBe(200);

    const update = mocks.updateManyUser.mock.calls[0]![0];
    expect(update.data.passwordHash).toBe("$2a$12$newhash");
    // The cutoff every session's issued-at is compared against.
    expect(update.data.sessionsValidAfter).toBeInstanceOf(Date);
  });

  it("writes the cutoff inside the SAME conditional update as the hash", async () => {
    // Two statements could leave the password changed and the sessions alive.
    // One `updateMany`, still guarded by the old hash, cannot.
    await POST(post());
    const update = mocks.updateManyUser.mock.calls[0]![0];
    expect(update.where).toMatchObject({ id: "usr_1", passwordHash: "$2a$12$oldhash" });
    expect(update.data).toHaveProperty("sessionsValidAfter");
    expect(update.data).toHaveProperty("passwordHash");
  });

  it("uses the same instant for the cutoff and the audited change", async () => {
    await POST(post());
    const stamped = mocks.updateManyUser.mock.calls[0]![0].data.sessionsValidAfter as Date;
    const revokedAt = mocks.updateManyRefreshToken.mock.calls[0]![0].data.revokedAt as Date;
    expect(revokedAt.getTime()).toBe(stamped.getTime());
  });

  it("revokes the account's live refresh tokens, with a readable reason", async () => {
    await POST(post());
    expect(mocks.updateManyRefreshToken).toHaveBeenCalledWith({
      where: { userId: "usr_1", revokedAt: null },
      data: { revokedAt: expect.any(Date), revokedReason: "PASSWORD_RESET" },
    });
  });

  it("only touches tokens that are still live, so a REUSE_DETECTED stamp survives", async () => {
    // That stamp is the only record that a replay ever happened; overwriting it
    // with a routine reason erases the evidence.
    await POST(post());
    expect(mocks.updateManyRefreshToken.mock.calls[0]![0].where).toHaveProperty("revokedAt", null);
  });

  it("changes nothing when the conditional update loses its race", async () => {
    mocks.updateManyUser.mockResolvedValue({ count: 0 });
    const response = await POST(post());
    expect(response.status).toBe(400);
    expect(mocks.updateManyRefreshToken).not.toHaveBeenCalled();
  });
});
