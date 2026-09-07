import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  findUnique: vi.fn(),
  transaction: vi.fn(),
  updateMany: vi.fn(),
  auditCreate: vi.fn(),
  hash: vi.fn(),
}));

vi.mock("@avenick/auth/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  clientIpFrom: () => "127.0.0.1",
  RATE_LIMITS: { inviteAccept: { name: "invite-accept", limit: 10, windowMs: 900_000 } },
}));
vi.mock("@avenick/database", () => ({
  db: { user: { findUnique: mocks.findUnique }, $transaction: mocks.transaction },
  UserRole: {
    CONSUMER: "CONSUMER",
    COMPANY_ADMIN: "COMPANY_ADMIN",
    COMPANY_BUYER: "COMPANY_BUYER",
    COMPANY_APPROVER: "COMPANY_APPROVER",
    SELLER_OWNER: "SELLER_OWNER",
    SELLER_STAFF: "SELLER_STAFF",
    ADMIN: "ADMIN",
    SUPER_ADMIN: "SUPER_ADMIN",
  },
  UserStatus: { PENDING: "PENDING", ACTIVE: "ACTIVE", SUSPENDED: "SUSPENDED", BANNED: "BANNED" },
  CompanyStatus: { PENDING_VERIFICATION: "PENDING_VERIFICATION", ACTIVE: "ACTIVE", SUSPENDED: "SUSPENDED" },
  AuditAction: { CREATE: "CREATE", UPDATE: "UPDATE", DELETE: "DELETE" },
}));
vi.mock("bcryptjs", () => ({ default: { hash: mocks.hash }, hash: mocks.hash }));
vi.mock("@avenick/observability", () => ({ log: { info: () => {}, warn: () => {}, error: () => {} } }));

import { POST } from "./route";
import { mintInviteToken } from "@/lib/invite-token";

const SECRET = "test-signing-secret-that-is-long-enough";
const UID = "cinvitee0000001";
const PASSWORD = "Password1";

const invitee = () => ({
  id: UID,
  email: "colleague@example.test",
  passwordHash: null,
  role: "COMPANY_BUYER",
  status: "PENDING",
  deletedAt: null,
  emailVerified: null,
  companyMember: {
    id: "cmember00000001",
    role: "COMPANY_BUYER",
    isActive: true,
    companyId: "ccompany0000001",
    company: { id: "ccompany0000001", status: "ACTIVE", deletedAt: null },
  },
});

const post = (body: Record<string, unknown>) =>
  POST(new NextRequest("http://localhost/api/auth/invite/redeem", { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AUTH_SECRET", SECRET);
  vi.stubEnv("NEXTAUTH_SECRET", "");
  mocks.checkRateLimit.mockResolvedValue({ ok: true, resetAt: Date.now() + 1000 });
  mocks.hash.mockResolvedValue("$2a$12$freshly-written-hash");
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.auditCreate.mockResolvedValue({});
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
    fn({ user: { updateMany: mocks.updateMany }, auditLog: { create: mocks.auditCreate } }),
  );
  mocks.findUnique.mockResolvedValue(invitee());
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/auth/invite/redeem", () => {
  it("accepts a live invitation", async () => {
    const res = await post({ token: mintInviteToken({ uid: UID, passwordHash: null }), password: PASSWORD });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, portal: "customer" });
  });

  /**
   * The neutrality rule, pinned byte for byte. If "no such account" and "that
   * link has expired" answered differently, anyone holding a token could probe
   * account state — the oracle every other surface in this track refuses to be.
   */
  it("answers an unknown token and an expired one identically", async () => {
    const expired = mintInviteToken({ uid: UID, passwordHash: null }, Date.now() - 30 * 86_400_000);
    const unknown = mintInviteToken({ uid: "cnobody00000001", passwordHash: null });
    mocks.findUnique.mockResolvedValue(null);

    const [a, b] = [await post({ token: expired, password: PASSWORD }), await post({ token: unknown, password: PASSWORD })];
    expect(a.status).toBe(b.status);
    expect(a.status).toBe(400);
    expect(await a.text()).toBe(await b.text());
  });

  it("answers a garbage token, a revoked membership and an already-accepted link the same way", async () => {
    const token = mintInviteToken({ uid: UID, passwordHash: null });
    const bodies: string[] = [];

    bodies.push(await (await post({ token: "not-a-real-token", password: PASSWORD })).text());

    const revoked = invitee();
    revoked.companyMember.isActive = false;
    mocks.findUnique.mockResolvedValue(revoked);
    bodies.push(await (await post({ token, password: PASSWORD })).text());

    const accepted = { ...invitee(), passwordHash: "$2a$12$already", status: "ACTIVE" };
    mocks.findUnique.mockResolvedValue(accepted);
    bodies.push(await (await post({ token, password: PASSWORD })).text());

    expect(new Set(bodies).size).toBe(1);
    expect(bodies[0]).toContain("invalid-token");
    // Nothing in the sentence names a status, a company or an address.
    expect(bodies[0]).not.toMatch(/PENDING|ACTIVE|SUSPENDED|example\.test|company member/i);
  });

  it("never lets the request choose a role, a company or an account", async () => {
    const res = await post({
      token: mintInviteToken({ uid: UID, passwordHash: null }),
      password: PASSWORD,
      role: "COMPANY_ADMIN",
      companyId: "csomeone-elses",
      email: "victim@example.test",
      status: "ACTIVE",
    });
    expect(res.status).toBe(200);
    const written = mocks.updateMany.mock.calls[0]?.[0] as { where: Record<string, unknown>; data: Record<string, unknown> };
    // The role written is the invited one, and the row touched is the one the
    // signed token named — not the one the body asked for.
    expect(written.data.role).toBe("COMPANY_BUYER");
    expect(written.where).toEqual({ id: UID, passwordHash: null, status: "PENDING" });
  });

  /**
   * The rule the acceptance page prints is the rule this route enforces — the
   * registration schema itself, never a copy of it. A weaker one here would be
   * the easy way around the registration rule; a stricter one would refuse a
   * password the screen had just told the person was fine.
   */
  it.each([
    ["short", "under eight characters"],
    ["alllowercase1", "no uppercase letter"],
    ["NoDigitsAtAll", "no digit"],
  ])("refuses %s (%s), and says so instead of answering invalid-token", async (password) => {
    const res = await post({ token: mintInviteToken({ uid: UID, passwordHash: null }), password });
    expect(res.status).toBe(400);
    expect(mocks.updateMany).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.success).toBe(false);
    // A bad password is the caller's to fix and is NOT a dead link; collapsing
    // it into invalid-token would send them off to ask for a new invitation.
    expect(body.code).toBeUndefined();
    expect(body.error).toBeTruthy();
  });

  it("accepts the passwords that rule allows", async () => {
    for (const password of ["Ab3cdefg", `A1${"b".repeat(126)}`]) {
      mocks.updateMany.mockClear();
      const res = await post({ token: mintInviteToken({ uid: UID, passwordHash: null }), password });
      expect(res.status).toBe(200);
    }
  });

  it("throttles by IP and says when to come back", async () => {
    mocks.checkRateLimit.mockResolvedValue({ ok: false, resetAt: Date.now() + 60_000 });
    const res = await post({ token: mintInviteToken({ uid: UID, passwordHash: null }), password: PASSWORD });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("is loud, not vague, when the deployment has no signing key", async () => {
    vi.stubEnv("AUTH_SECRET", "");
    vi.stubEnv("NEXTAUTH_SECRET", "");
    const res = await post({ token: "anything.at-all", password: PASSWORD });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/environment/i);
  });
});
