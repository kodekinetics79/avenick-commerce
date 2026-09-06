import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  transaction: vi.fn(),
  updateMany: vi.fn(),
  auditCreate: vi.fn(),
  hash: vi.fn(),
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

import { acceptInvite, inviteAcceptUrl } from "../invite-acceptance";
import { mintInviteToken } from "../invite-token";
import { passwordHashFingerprint } from "../password-reset";

const SECRET = "test-signing-secret-that-is-long-enough";
const NOW = Date.UTC(2026, 0, 1, 12, 0, 0);
const UID = "cinvitee0000001";
const NEW_HASH = "$2a$12$freshly-written-hash-for-the-invitee-0000000000000000000";
const PASSWORD = "Password1";

/** The row `inviteMember` leaves behind: PENDING, no password, live membership. */
function invitee(overrides: Record<string, unknown> = {}, memberOverrides: Record<string, unknown> = {}) {
  return {
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
      ...memberOverrides,
    },
    ...overrides,
  };
}

const goodToken = () => mintInviteToken({ uid: UID, passwordHash: null }, NOW);
const accept = (token: string, nowMs = NOW) =>
  acceptInvite({ token, password: PASSWORD, ipAddress: "127.0.0.1", nowMs });

/** What the transaction wrote, if it ran. */
const written = () => mocks.updateMany.mock.calls[0]?.[0] as { where: Record<string, unknown>; data: Record<string, unknown> } | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AUTH_SECRET", SECRET);
  vi.stubEnv("NEXTAUTH_SECRET", "");
  mocks.hash.mockResolvedValue(NEW_HASH);
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.auditCreate.mockResolvedValue({});
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
    fn({ user: { updateMany: mocks.updateMany }, auditLog: { create: mocks.auditCreate } }),
  );
  mocks.findUnique.mockResolvedValue(invitee());
});
afterEach(() => vi.unstubAllEnvs());

describe("accepting an invitation", () => {
  it("sets the first password and moves the invitee from PENDING to ACTIVE", async () => {
    const result = await accept(goodToken());
    expect(result).toEqual({ ok: true, userId: UID, role: "COMPANY_BUYER", companyId: "ccompany0000001" });

    const update = written();
    expect(update?.data.passwordHash).toBe(NEW_HASH);
    expect(update?.data.status).toBe("ACTIVE");
    // Following the link proved the mailbox, which the invitee never had a
    // chance to prove before.
    expect(update?.data.emailVerified).toBeInstanceOf(Date);
    expect(mocks.auditCreate).toHaveBeenCalledTimes(1);
  });

  /**
   * The role is the administrator's decision, carried on the CompanyMember row
   * `inviteMember` wrote. Nothing in the request can influence it, and
   * CompanyMember itself is never written here — only User.role is re-asserted
   * from it, so `isDurableB2BMember`'s `user.role === member.role` holds at the
   * instant this person first becomes able to sign in.
   */
  it("inherits the invited role and never writes the membership row", async () => {
    mocks.findUnique.mockResolvedValue(invitee({ role: "COMPANY_APPROVER" }, { role: "COMPANY_APPROVER" }));
    const result = await accept(goodToken());
    expect(result).toEqual({ ok: true, userId: UID, role: "COMPANY_APPROVER", companyId: "ccompany0000001" });
    expect(written()?.data.role).toBe("COMPANY_APPROVER");
  });

  it("re-asserts User.role from the invite when the two have drifted apart", async () => {
    // A member whose governance row says APPROVER but whose User row says BUYER
    // would pass login and then fail every B2B surface. Activation must not be
    // the moment that becomes true.
    mocks.findUnique.mockResolvedValue(invitee({ role: "COMPANY_BUYER" }, { role: "COMPANY_APPROVER" }));
    const result = await accept(goodToken());
    expect(result.ok).toBe(true);
    expect(written()?.data.role).toBe("COMPANY_APPROVER");
  });

  it("is single-use: the same link fails once a password has been written", async () => {
    expect((await accept(goodToken())).ok).toBe(true);

    // Second click, same link — the account now has the hash acceptance wrote,
    // so the fingerprint the token carries no longer describes it.
    mocks.findUnique.mockResolvedValue(invitee({ passwordHash: NEW_HASH, status: "ACTIVE" }));
    expect(await accept(goodToken())).toEqual({ ok: false, reason: "invalid" });
    expect(mocks.updateMany).toHaveBeenCalledTimes(1);
  });

  it("loses a race rather than letting two clicks both win", async () => {
    // Both redemptions got past the fingerprint check; the CAS on
    // `passwordHash: null, status: PENDING` is what settles it.
    mocks.updateMany.mockResolvedValue({ count: 0 });
    expect(await accept(goodToken())).toEqual({ ok: false, reason: "invalid" });
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("expires", async () => {
    const token = goodToken();
    expect(await accept(token, NOW + 6 * 86_400_000)).toEqual({ ok: true, userId: UID, role: "COMPANY_BUYER", companyId: "ccompany0000001" });
    expect(await accept(token, NOW + 8 * 86_400_000)).toEqual({ ok: false, reason: "invalid" });
  });

  it("refuses a forged or foreign token without reading the database", async () => {
    for (const bad of ["", "not-a-token", `${goodToken()}x`]) {
      expect(await accept(bad)).toEqual({ ok: false, reason: "invalid" });
    }
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("says so loudly when the deployment has lost its signing key", async () => {
    vi.stubEnv("AUTH_SECRET", "");
    vi.stubEnv("NEXTAUTH_SECRET", "");
    expect(await accept("anything.at-all")).toEqual({ ok: false, reason: "no-secret" });
  });
});

/**
 * The rule that keeps this from being an account-takeover path. Password reset
 * is the flow for an account that already has a password; acceptance is only
 * ever the flow for one that does not.
 */
describe("acceptance refuses anything that is not an open invitation", () => {
  const cases: Array<[string, ReturnType<typeof invitee>]> = [
    ["an ACTIVE colleague with a real password", invitee({ status: "ACTIVE", passwordHash: "$2a$12$existing" })],
    ["a PENDING row that somehow already has a password", invitee({ passwordHash: "$2a$12$existing" })],
    ["a suspended account", invitee({ status: "SUSPENDED" })],
    ["a banned account", invitee({ status: "BANNED" })],
    ["an erased account", invitee({ deletedAt: new Date() })],
    ["an admin account left pending", invitee({ role: "ADMIN" }, { role: "ADMIN" })],
    ["a seller account left pending", invitee({ role: "SELLER_OWNER" }, { role: "SELLER_OWNER" })],
    ["a user with no membership at all", invitee({ companyMember: null })],
    ["a membership the administrator has since deactivated", invitee({}, { isActive: false })],
    ["a suspended company", invitee({}, { company: { id: "c", status: "SUSPENDED", deletedAt: null } })],
    ["a deleted company", invitee({}, { company: { id: "c", status: "ACTIVE", deletedAt: new Date() } })],
  ];

  for (const [label, row] of cases) {
    it(`refuses ${label}`, async () => {
      mocks.findUnique.mockResolvedValue(row);
      expect(await accept(goodToken())).toEqual({ ok: false, reason: "invalid" });
      expect(mocks.updateMany).not.toHaveBeenCalled();
    });
  }

  it("refuses an address that never existed", async () => {
    mocks.findUnique.mockResolvedValue(null);
    expect(await accept(goodToken())).toEqual({ ok: false, reason: "invalid" });
  });

  /**
   * A company can slip out of ACTIVE between the invitation and the click, and
   * refusing there would rebuild the very lockout this flow exists to fix. They
   * get in and meet /b2b/register's honest "still being verified" page instead;
   * isDurableB2BMember keeps the B2B surfaces shut either way.
   */
  it("still lets in an invitee whose company is awaiting verification", async () => {
    mocks.findUnique.mockResolvedValue(invitee({}, { company: { id: "c", status: "PENDING_VERIFICATION", deletedAt: null } }));
    expect((await accept(goodToken())).ok).toBe(true);
  });
});

describe("minting the link that goes in the invitation mail", () => {
  it("mints for an open invitation, against the null hash the token is bound to", async () => {
    const url = await inviteAcceptUrl({ email: "Colleague@Example.test ", origin: "https://shop.example" });
    expect(mocks.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { email: "colleague@example.test" } }));
    expect(url).toMatch(/^https:\/\/shop\.example\/auth\/accept-invite\?token=/);
    const token = decodeURIComponent(new URL(url as string).searchParams.get("token") as string);
    // The link the mail carries is exactly the one the redeem side accepts.
    mocks.findUnique.mockResolvedValue(invitee());
    expect((await accept(token)).ok).toBe(true);
    expect(passwordHashFingerprint(null)).toHaveLength(16);
  });

  it("mints nothing for an account that is not an open invitation", async () => {
    mocks.findUnique.mockResolvedValue(invitee({ status: "ACTIVE", passwordHash: "$2a$12$existing" }));
    expect(await inviteAcceptUrl({ email: "boss@example.test", origin: "https://shop.example" })).toBeNull();

    mocks.findUnique.mockResolvedValue(null);
    expect(await inviteAcceptUrl({ email: "nobody@example.test", origin: "https://shop.example" })).toBeNull();
  });

  it("mints nothing rather than signing with an empty key", async () => {
    vi.stubEnv("AUTH_SECRET", "");
    vi.stubEnv("NEXTAUTH_SECRET", "");
    expect(await inviteAcceptUrl({ email: "colleague@example.test", origin: "https://shop.example" })).toBeNull();
  });
});
