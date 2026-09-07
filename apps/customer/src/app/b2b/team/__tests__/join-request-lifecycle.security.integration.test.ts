import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@avenick/database";
import { integrationSuite, integrationDbEnabled } from "@avenick/database/testing";

/**
 * Approving a join request is the ONE moment an application becomes authority.
 *
 * Everything before it narrows who may ask — the CR must match a real company,
 * the address must be at that company's domain, the mailbox must be proven — and
 * none of it admits anybody. This transaction does: it writes the CompanyMember
 * row getB2BContext reads, and flips the account from PENDING (which sign-in
 * refuses) to ACTIVE. So it is tested against a real database rather than
 * mocks, because what is under test is the transaction and its compare-and-swap,
 * not the branching around it.
 *
 * The refusals matter more than the happy path. Each one below is a way an
 * applicant could otherwise be admitted without a human having decided it.
 */
const actor = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/auth-instance", () => ({ auth: vi.fn(async () => ({ user: { id: actor.id } })) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/components/b2b/action-i18n", () => ({ actionT: () => (key: string) => key }));
// No mail from a test. The approval mail is best-effort and its own concern;
// what is under test here is what the database is left holding.
vi.mock("@/lib/email", () => ({ sendJoinApprovedEmail: vi.fn(async () => ({ sent: true })) }));

import { approveJoinRequest, rejectJoinRequest } from "../actions";

const run = integrationSuite();
const stamp = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

let companyId = "", otherCompanyId = "", adminId = "";
const userIds: string[] = [];
const companyIds: string[] = [];

/** A fresh applicant plus their request, so each test starts from a known state. */
async function makeApplicant(opts: {
  status?: "PENDING_EMAIL_VERIFICATION" | "PENDING_ADMIN_APPROVAL" | "REJECTED";
  companyId?: string;
  requestedRole?: "COMPANY_BUYER" | "COMPANY_APPROVER";
  suffix: string;
}) {
  const user = await db.user.create({
    data: {
      email: `join-${opts.suffix}-${stamp}@aramco.test`,
      firstName: "Applicant",
      lastName: opts.suffix,
      role: opts.requestedRole ?? "COMPANY_BUYER",
      status: "PENDING",
      passwordHash: "$2a$12$notarealhashbutthecolumnisnotnullable000000000000000000000",
    },
  });
  userIds.push(user.id);
  const request = await db.companyJoinRequest.create({
    data: {
      companyId: opts.companyId ?? companyId,
      userId: user.id,
      status: opts.status ?? "PENDING_ADMIN_APPROVAL",
      requestedRole: opts.requestedRole ?? "COMPANY_BUYER",
      emailDomain: "aramco.test",
      emailVerifiedAt: opts.status === "PENDING_EMAIL_VERIFICATION" ? null : new Date(),
    },
  });
  return { user, request };
}

beforeAll(async () => {
  if (!integrationDbEnabled()) return;
  const [company, other] = await Promise.all([
    db.company.create({
      data: {
        nameEn: `Join Co ${stamp}`, crNumber: `JOIN-${stamp}`, industry: "INDUSTRIAL_SUPPLIES",
        size: "LARGE", country: "SA", city: "Dhahran", status: "ACTIVE", emailDomains: ["aramco.test"],
      },
    }),
    db.company.create({
      data: {
        nameEn: `Other Co ${stamp}`, crNumber: `OTHER-${stamp}`, industry: "RETAIL",
        size: "SMALL", country: "AE", city: "Dubai", status: "ACTIVE", emailDomains: ["other.test"],
      },
    }),
  ]);
  companyId = company.id; otherCompanyId = other.id;
  companyIds.push(company.id, other.id);

  const admin = await db.user.create({
    data: { email: `join-admin-${stamp}@aramco.test`, firstName: "Company", lastName: "Admin", role: "COMPANY_ADMIN", status: "ACTIVE" },
  });
  userIds.push(admin.id); actor.id = admin.id; adminId = admin.id;
  await db.companyMember.create({ data: { companyId, userId: admin.id, role: "COMPANY_ADMIN" } });
});

afterAll(async () => {
  if (!integrationDbEnabled()) return;
  await db.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
  await db.companyJoinRequest.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.companyMember.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.company.deleteMany({ where: { id: { in: companyIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
});

beforeEach(() => {
  actor.id = adminId;
});

run("company join request approval", () => {
  it("admits the applicant: membership written, account activated, request decided", async () => {
    const { user, request } = await makeApplicant({ suffix: "admit" });
    const form = new FormData();
    form.set("role", "COMPANY_BUYER");

    const result = await approveJoinRequest(request.id, {}, form);
    expect(result.ok).toBe(true);

    const [member, after, decided] = await Promise.all([
      db.companyMember.findUnique({ where: { userId: user.id } }),
      db.user.findUnique({ where: { id: user.id }, select: { status: true } }),
      db.companyJoinRequest.findUnique({ where: { id: request.id } }),
    ]);
    // All three or none: the membership is the authority, the ACTIVE status is
    // what lets sign-in through, and the decided request is what stops it
    // happening twice.
    expect(member?.companyId).toBe(companyId);
    expect(after?.status).toBe("ACTIVE");
    expect(decided?.status).toBe("APPROVED");
    expect(decided?.decidedById).toBe(adminId);
    expect(decided?.decidedAt).toBeTruthy();
  });

  it("grants the ADMINISTRATOR'S role, never the one the applicant asked for", async () => {
    // The privilege-escalation guard. requestedRole comes off a public form, so
    // if it were trusted an applicant could admit themselves as an approver —
    // or, but for the schema, as an administrator.
    const { user, request } = await makeApplicant({ suffix: "role", requestedRole: "COMPANY_APPROVER" });
    const form = new FormData();
    form.set("role", "COMPANY_BUYER");

    expect((await approveJoinRequest(request.id, {}, form)).ok).toBe(true);

    const [member, after] = await Promise.all([
      db.companyMember.findUnique({ where: { userId: user.id } }),
      db.user.findUnique({ where: { id: user.id }, select: { role: true } }),
    ]);
    expect(member?.role).toBe("COMPANY_BUYER");
    expect(after?.role).toBe("COMPANY_BUYER");
  });

  it("refuses an applicant who has not confirmed their email address", async () => {
    // The confirmation is what makes the domain match mean anything. An
    // administrator must not be able to admit somebody on the strength of an
    // address nobody has proved receives mail.
    const { user, request } = await makeApplicant({ suffix: "unconfirmed", status: "PENDING_EMAIL_VERIFICATION" });
    const form = new FormData();
    form.set("role", "COMPANY_BUYER");

    const result = await approveJoinRequest(request.id, {}, form);
    expect(result.ok).toBeFalsy();
    expect(await db.companyMember.findUnique({ where: { userId: user.id } })).toBeNull();
    expect((await db.user.findUnique({ where: { id: user.id }, select: { status: true } }))?.status).toBe("PENDING");
  });

  it("cannot reach a request belonging to another company", async () => {
    // Company scope before anything else: a request id from elsewhere must be
    // as invisible as one that does not exist.
    const { user, request } = await makeApplicant({ suffix: "crosscompany", companyId: otherCompanyId });
    const form = new FormData();
    form.set("role", "COMPANY_ADMIN");

    const result = await approveJoinRequest(request.id, {}, form);
    expect(result.ok).toBeFalsy();
    expect(await db.companyMember.findUnique({ where: { userId: user.id } })).toBeNull();
    expect((await db.companyJoinRequest.findUnique({ where: { id: request.id } }))?.status).toBe("PENDING_ADMIN_APPROVAL");
  });

  it("refuses a non-administrator", async () => {
    const { user, request } = await makeApplicant({ suffix: "notadmin" });
    const buyer = await db.user.create({
      data: { email: `join-buyer-${stamp}@aramco.test`, firstName: "Plain", lastName: "Buyer", role: "COMPANY_BUYER", status: "ACTIVE" },
    });
    userIds.push(buyer.id);
    await db.companyMember.create({ data: { companyId, userId: buyer.id, role: "COMPANY_BUYER" } });
    actor.id = buyer.id;

    const form = new FormData();
    form.set("role", "COMPANY_ADMIN");
    const result = await approveJoinRequest(request.id, {}, form);

    expect(result.ok).toBeFalsy();
    expect(await db.companyMember.findUnique({ where: { userId: user.id } })).toBeNull();
  });

  it("two administrators approving at once produce exactly one membership", async () => {
    // The compare-and-swap. Both calls pass the status check by reading before
    // either writes; only the UPDATE ... WHERE status IN (...) can settle it.
    const { user, request } = await makeApplicant({ suffix: "race" });
    const form = () => {
      const f = new FormData();
      f.set("role", "COMPANY_BUYER");
      return f;
    };

    const results = await Promise.all([
      approveJoinRequest(request.id, {}, form()),
      approveJoinRequest(request.id, {}, form()),
    ]);

    expect(results.filter((r) => r.ok === true)).toHaveLength(1);
    expect(await db.companyMember.count({ where: { userId: user.id } })).toBe(1);
  });
});

run("company join request rejection", () => {
  it("grants nothing and records who decided and why", async () => {
    const { user, request } = await makeApplicant({ suffix: "reject" });
    const form = new FormData();
    form.set("reason", "Not known to the procurement team");

    expect((await rejectJoinRequest(request.id, {}, form)).ok).toBe(true);

    const [member, after, decided] = await Promise.all([
      db.companyMember.findUnique({ where: { userId: user.id } }),
      db.user.findUnique({ where: { id: user.id }, select: { status: true } }),
      db.companyJoinRequest.findUnique({ where: { id: request.id } }),
    ]);
    expect(member).toBeNull();
    // Still PENDING, which is what sign-in refuses. A rejection must not leave
    // an account that can do anything at all.
    expect(after?.status).toBe("PENDING");
    expect(decided?.status).toBe("REJECTED");
    expect(decided?.decidedById).toBe(adminId);
    expect(decided?.rejectionReason).toBe("Not known to the procurement team");
  });

  it("is reversible: an administrator can still admit somebody they rejected", async () => {
    // Deliberate, and the reason approveJoinRequest accepts REJECTED. One
    // person has one request by construction, so if rejection were final a
    // mis-click would lock a colleague out permanently — and an invitation
    // would then fail too, on "that address is already registered".
    const { user, request } = await makeApplicant({ suffix: "reversible", status: "REJECTED" });
    const form = new FormData();
    form.set("role", "COMPANY_APPROVER");

    expect((await approveJoinRequest(request.id, {}, form)).ok).toBe(true);

    const [member, after, decided] = await Promise.all([
      db.companyMember.findUnique({ where: { userId: user.id } }),
      db.user.findUnique({ where: { id: user.id }, select: { status: true } }),
      db.companyJoinRequest.findUnique({ where: { id: request.id } }),
    ]);
    expect(member?.role).toBe("COMPANY_APPROVER");
    expect(after?.status).toBe("ACTIVE");
    expect(decided?.status).toBe("APPROVED");
    // The stale refusal must not survive the reversal.
    expect(decided?.rejectionReason).toBeNull();
  });

  it("cannot reject a request belonging to another company", async () => {
    const { request } = await makeApplicant({ suffix: "rejectcross", companyId: otherCompanyId });
    const result = await rejectJoinRequest(request.id, {}, new FormData());
    expect(result.ok).toBeFalsy();
    expect((await db.companyJoinRequest.findUnique({ where: { id: request.id } }))?.status).toBe("PENDING_ADMIN_APPROVAL");
  });
});
