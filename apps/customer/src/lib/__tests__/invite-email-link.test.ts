import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), transaction: vi.fn(), fetch: vi.fn() }));

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
vi.mock("@avenick/utils/portal-config", () => ({
  emailSender: () => "Avenick <no-reply@example.test>",
  platformName: () => "Avenick",
  selfOrigin: () => "https://shop.example",
}));
vi.mock("@avenick/auth/rate-limit", () => ({
  checkRateLimit: async () => ({ ok: true, resetAt: Date.now() + 1000 }),
  RATE_LIMITS: { alreadyRegisteredNotice: { name: "n", limit: 1, windowMs: 1000 } },
}));
vi.mock("@avenick/observability", () => ({ log: { info: () => {}, warn: () => {}, error: () => {} } }));

import { sendInviteEmail } from "../email";
import { verifyInviteToken } from "../invite-token";

const UID = "cinvitee0000001";

const invitee = (overrides: Record<string, unknown> = {}) => ({
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
  ...overrides,
});

const send = () =>
  sendInviteEmail({ to: "colleague@example.test", companyName: "Gulf Supply Co", inviterName: "Sara Admin", role: "COMPANY_BUYER" });

/** The HTML body the provider was asked to send. */
function sentHtml(): string {
  const body = JSON.parse((mocks.fetch.mock.calls[0]?.[1] as { body: string }).body) as { html: string };
  return body.html;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AUTH_SECRET", "test-signing-secret-that-is-long-enough");
  vi.stubEnv("NEXTAUTH_SECRET", "");
  vi.stubEnv("RESEND_API_KEY", "re_test_key");
  mocks.findUnique.mockResolvedValue(invitee());
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ id: "msg_1" }) });
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/**
 * The one line that WAS the whole defect: `${appUrl}/register?email=<address>`.
 * An address in a query string that /register never even read, mailed to a
 * person every other door was correctly refusing. These pin that it is gone and
 * that what replaced it is redeemable.
 */
describe("the invitation email carries a credential, not an address", () => {
  it("links to the acceptance page with a token that verifies", async () => {
    expect(await send()).toEqual({ sent: true });
    const html = sentHtml();

    expect(html).not.toContain("/register?email=");
    expect(html).not.toContain(encodeURIComponent("colleague@example.test"));

    const href = /href="([^"]*accept-invite[^"]*)"/.exec(html)?.[1];
    expect(href).toBeTruthy();
    const url = new URL(href as string);
    expect(url.origin + url.pathname).toBe("https://shop.example/auth/accept-invite");

    const verified = verifyInviteToken(decodeURIComponent(url.searchParams.get("token") as string));
    expect(verified.ok).toBe(true);
    if (!verified.ok) return;
    expect(verified.payload.uid).toBe(UID);
    expect(verified.payload.p).toBe("invite");
  });

  it("states the expiry it actually enforces, and that the link is single use", async () => {
    await send();
    expect(sentHtml()).toContain("This link expires in 7 days and can only be used once.");
  });

  it("sends nothing at all rather than a link that could never work", async () => {
    // An address that is not an open invitation — already accepted, revoked, or
    // simply somebody's working account. A tokenless invitation mail is exactly
    // what left every invitee stranded; not sending is the honest answer.
    mocks.findUnique.mockResolvedValue(invitee({ status: "ACTIVE", passwordHash: "$2a$12$existing" }));
    expect(await send()).toEqual({ sent: false, reason: "invite-not-open" });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("sends nothing when the deployment has no signing key", async () => {
    vi.stubEnv("AUTH_SECRET", "");
    vi.stubEnv("NEXTAUTH_SECRET", "");
    expect(await send()).toEqual({ sent: false, reason: "invite-not-open" });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
