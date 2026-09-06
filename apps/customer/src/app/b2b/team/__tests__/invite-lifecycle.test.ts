import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * An invitation had exactly one attempt in it. `inviteMember` writes the User
 * and CompanyMember rows and mails a link, and from that moment the address is
 * taken — so re-inviting was refused with "already registered", and there was
 * no second lever anywhere on the screen. A colleague who deleted the message
 * was stuck, and the administrator was told the address belonged to a stranger.
 *
 * These pin the resend path's refusals rather than its happy path alone,
 * because every one of them exists to stop a STALE page from mailing an
 * invitation to somebody no longer entitled to one: the row an administrator
 * clicks was rendered at some earlier moment, and the invitee may have accepted,
 * been revoked or been erased since.
 *
 * No database: the point under test is which state is re-read and what is
 * decided from it, and the queries are mocked so each state can be posed
 * directly. The governed writes have their own integration cover in
 * ./b2b-iam-audit.security.integration.test.ts.
 */
const state = vi.hoisted(() => ({
  ctx: null as null | { userId: string; companyId: string; company: { nameEn: string }; member: { role: string } },
  member: null as null | Record<string, unknown>,
  existingUser: null as null | Record<string, unknown>,
  delivered: true,
  skipReason: "provider-not-configured" as string,
}));

const auditCreate = vi.hoisted(() => vi.fn(async () => ({})));
const deliver = vi.hoisted(() =>
  vi.fn(async () => (state.delivered ? { sent: true } : { sent: false, reason: state.skipReason })),
);

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// The real redirect() throws by design — every guard below relies on control
// stopping there, so a mock that returned would test a different function.
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));
vi.mock("@/lib/b2b", () => ({ getB2BContext: vi.fn(async () => state.ctx) }));
vi.mock("@/components/b2b/action-i18n", () => ({ actionT: () => (key: string) => key }));
vi.mock("@/lib/email", () => ({ sendInviteEmail: deliver }));
vi.mock("@avenick/database", () => ({
  updateGovernedCompanyMember: vi.fn(),
  db: {
    companyMember: { findUnique: vi.fn(async () => state.member) },
    user: { findUnique: vi.fn(async () => state.existingUser) },
    auditLog: { create: auditCreate },
    $transaction: vi.fn(),
  },
}));

import { inviteMember, resendInvite } from "../actions";

const ADMIN = {
  userId: "user-admin",
  companyId: "company-1",
  company: { nameEn: "Ostora Trading" },
  member: { role: "COMPANY_ADMIN" },
};

/** A membership whose invitation is still outstanding: live row, no password. */
const PENDING_MEMBER = {
  id: "member-1",
  userId: "user-invitee",
  companyId: "company-1",
  role: "COMPANY_BUYER",
  isActive: true,
  user: { email: "colleague@example.test", status: "PENDING", passwordHash: null, deletedAt: null },
};

/** The url a refusal or a receipt landed on, from the thrown redirect. */
async function outcomeOf(run: Promise<unknown>): Promise<string> {
  try {
    await run;
  } catch (error) {
    return String(error instanceof Error ? error.message : error).replace("REDIRECT ", "");
  }
  throw new Error("the action returned without redirecting");
}

beforeEach(() => {
  state.ctx = ADMIN;
  state.member = { ...PENDING_MEMBER };
  state.existingUser = null;
  state.delivered = true;
  state.skipReason = "provider-not-configured";
  auditCreate.mockClear();
  deliver.mockClear();
});

describe("resending an outstanding invitation", () => {
  it("posts it again and leaves the only record there is of having done so", async () => {
    expect(await outcomeOf(resendInvite("member-1"))).toBe("/b2b/team?invite=sent");
    expect(deliver).toHaveBeenCalledWith(
      expect.objectContaining({ to: "colleague@example.test", role: "COMPANY_BUYER" }),
    );
    // Nothing on the row changes, so this entry is the whole audit trail of a
    // second invitation having been posted, by whom, and whether it went.
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: "user-admin",
          entityId: "member-1",
          after: expect.objectContaining({ event: "invite-resent", sent: true }),
        }),
      }),
    );
  });

  it("says so when the deployment cannot send mail, rather than claiming it did", async () => {
    state.delivered = false;
    expect(await outcomeOf(resendInvite("member-1"))).toBe("/b2b/team?invite=notSent");
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ after: expect.objectContaining({ sent: false }) }) }),
    );
  });

  it("distinguishes an unconfigured mailer from an invitation that is no longer open", async () => {
    // The mail layer re-judges the invitation when it mints the link
    // (lib/invite-acceptance), and it refuses cases this action cannot see —
    // a suspended company, most of all. Flattening that into "email is not
    // configured" would send an administrator to check an environment variable
    // over a colleague whose company account was suspended this morning.
    state.delivered = false;
    state.skipReason = "invite-not-open";
    expect(await outcomeOf(resendInvite("member-1"))).toBe("/b2b/team?invite=notOpen");
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ after: expect.objectContaining({ reason: "invite-not-open" }) }),
      }),
    );
  });

  it("refuses anyone but a company administrator", async () => {
    state.ctx = { ...ADMIN, member: { role: "COMPANY_APPROVER" } };
    expect(await outcomeOf(resendInvite("member-1"))).toBe("/b2b/team?invite=adminOnly");
    expect(deliver).not.toHaveBeenCalled();
  });

  it("refuses a membership belonging to another company", async () => {
    // The id comes off a form and a form can be forged; the company on the
    // CURRENT session decides, never the id.
    state.member = { ...PENDING_MEMBER, companyId: "company-2" };
    expect(await outcomeOf(resendInvite("member-1"))).toBe("/b2b/team?invite=notFound");
    expect(deliver).not.toHaveBeenCalled();
  });

  it("refuses once the colleague has set a password, whatever their status says", async () => {
    state.member = {
      ...PENDING_MEMBER,
      user: { ...PENDING_MEMBER.user, status: "PENDING", passwordHash: "$2a$12$ok" },
    };
    expect(await outcomeOf(resendInvite("member-1"))).toBe("/b2b/team?invite=accepted");
    expect(deliver).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("refuses a revoked or erased membership instead of re-opening the door", async () => {
    state.member = { ...PENDING_MEMBER, isActive: false };
    expect(await outcomeOf(resendInvite("member-1"))).toBe("/b2b/team?invite=notPending");

    state.member = {
      ...PENDING_MEMBER,
      user: { ...PENDING_MEMBER.user, deletedAt: new Date() },
    };
    expect(await outcomeOf(resendInvite("member-1"))).toBe("/b2b/team?invite=notPending");
    expect(deliver).not.toHaveBeenCalled();
  });
});

describe("inviting an address that is already taken", () => {
  it("points the administrator at the resend button when it is their own outstanding invitee", async () => {
    state.existingUser = {
      id: "user-invitee",
      status: "PENDING",
      companyMember: { companyId: "company-1" },
    };
    const form = new FormData();
    form.set("name", "Sara Aziz");
    form.set("email", "colleague@example.test");
    form.set("role", "COMPANY_BUYER");
    expect(await inviteMember({}, form)).toEqual({ error: "act.team.alreadyInvited" });
  });

  it("still says nothing about an address held outside this company", async () => {
    // A stranger's registration is not this administrator's business, and the
    // answer must not become a way to test whether an address is registered.
    state.existingUser = { id: "user-elsewhere", status: "ACTIVE", companyMember: null };
    const form = new FormData();
    form.set("name", "Sara Aziz");
    form.set("email", "stranger@example.test");
    form.set("role", "COMPANY_BUYER");
    expect(await inviteMember({}, form)).toEqual({ error: "act.team.emailTaken" });
  });
});
